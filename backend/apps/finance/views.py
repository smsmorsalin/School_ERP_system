"""Finance endpoints with per-family data scoping and atomic payments."""

from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import mixins, status, views, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.academics.access import children_of, student_profile_of
from apps.academics.models import StudentProfile
from apps.core.exceptions import ServiceUnavailable
from apps.core.permissions import CanViewFinance, IsAccountantOrAdmin, is_admin
from apps.core.utils import get_client_ip
from apps.finance.filters import FeeStructureFilter, InvoiceFilter, PaymentFilter
from apps.finance.models import (
    FeeCategory,
    FeeStructure,
    Invoice,
    Payment,
    PaymentIntent,
)
from apps.finance.payment_gateways import gateway_catalogue
from apps.finance.payment_service import (
    create_payment_intent,
    fail_payment_intent,
    process_webhook,
    sandbox_reference,
    settle_payment_intent,
)
from apps.finance.serializers import (
    FeeCategorySerializer,
    FeeStructureSerializer,
    InvoiceGenerateSerializer,
    InvoiceSerializer,
    PaymentIntentCreateSerializer,
    PaymentIntentSerializer,
    PaymentSerializer,
    RecordPaymentSerializer,
    SandboxConfirmSerializer,
)


def accessible_invoices(user):
    qs = Invoice.objects.select_related("student__user", "student__current_section__school_class")
    if is_admin(user) or "Accountant" in getattr(user, "role_names", []):
        return qs
    if "Student" in getattr(user, "role_names", []):
        return qs.filter(student__user=user)
    if "Parent" in getattr(user, "role_names", []):
        return qs.filter(student__in=children_of(user))
    return qs.none()


def accessible_payments(user):
    qs = Payment.objects.select_related("invoice__student__user", "received_by")
    if is_admin(user) or "Accountant" in getattr(user, "role_names", []):
        return qs
    if "Student" in getattr(user, "role_names", []):
        return qs.filter(invoice__student__user=user)
    if "Parent" in getattr(user, "role_names", []):
        return qs.filter(invoice__student__in=children_of(user))
    return qs.none()


def accessible_payment_intents(user):
    qs = PaymentIntent.objects.select_related(
        "invoice__student__user", "settled_payment", "created_by"
    )
    if is_admin(user) or "Accountant" in getattr(user, "role_names", []):
        return qs
    # Students and parents only see intents they created for invoices they can
    # access. They can never inspect another family member's checkout session.
    return qs.filter(invoice__in=accessible_invoices(user), created_by=user)


class FeeCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAccountantOrAdmin]
    serializer_class = FeeCategorySerializer
    lookup_field = "uuid"
    search_fields = ["name"]
    queryset = FeeCategory.objects.all()


class FeeStructureViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAccountantOrAdmin]
    serializer_class = FeeStructureSerializer
    lookup_field = "uuid"
    filterset_class = FeeStructureFilter
    search_fields = ["title", "category__name", "school_class__name"]
    ordering_fields = ["due_date", "amount"]

    def get_queryset(self):
        return FeeStructure.objects.select_related(
            "academic_year", "school_class", "category"
        ).filter(is_active=True)


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    lookup_field = "uuid"
    filterset_class = InvoiceFilter
    search_fields = ["invoice_number", "title", "student__user__first_name", "student__user__last_name", "student__student_id"]
    ordering_fields = ["due_date", "amount", "created_at"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_permissions(self):
        if self.request.method not in ("GET", "HEAD", "OPTIONS"):
            return [IsAccountantOrAdmin()]
        return [CanViewFinance()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Invoice.objects.none()
        return accessible_invoices(self.request.user).prefetch_related("payments")

    def perform_create(self, serializer):
        serializer.save(issued_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.payments.filter(is_active=True).exists():
            raise ValidationError(
                {"detail": "Invoices with payments cannot be deleted. Cancel instead."}
            )
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

    @action(detail=True, methods=["post"], url_path="payments")
    def record_payment(self, request, uuid=None):
        with transaction.atomic():
            invoice = (
                Invoice.objects.select_for_update()
                .select_related("student__user")
                .filter(uuid=uuid)
                .first()
            )
            if not invoice:
                raise ValidationError({"detail": "Invoice not found."})
            if invoice.status == "cancelled":
                raise ValidationError({"detail": "This invoice is cancelled."})
            if invoice.balance <= 0:
                raise ValidationError({"detail": "This invoice is already fully paid."})

            serializer = RecordPaymentSerializer(
                data=request.data, context={"invoice": invoice}
            )
            serializer.is_valid(raise_exception=True)
            payment = Payment.objects.create(
                invoice=invoice,
                amount=serializer.validated_data["amount"],
                method=serializer.validated_data["method"],
                reference=serializer.validated_data.get("reference", ""),
                notes=serializer.validated_data.get("notes", ""),
                paid_at=serializer.validated_data.get("paid_at", timezone.now()),
                received_by=request.user,
            )

        invoice.refresh_from_db()
        return Response(
            {
                "detail": "Payment recorded.",
                "payment": PaymentSerializer(payment).data,
                "invoice": InvoiceSerializer(invoice).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"])
    def generate(self, request):
        serializer = InvoiceGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        structure = serializer.validated_data["fee_structure"]
        section = serializer.validated_data.get("section")
        due_date = serializer.validated_data["due_date"]

        students = StudentProfile.objects.filter(
            is_active=True,
            status="active",
            current_section__school_class=structure.school_class,
        ).select_related("user")
        if section:
            students = students.filter(current_section=section)

        created = 0
        skipped = 0
        with transaction.atomic():
            for student in students:
                exists = Invoice.objects.filter(
                    student=student, fee_structure=structure
                ).exists()
                if exists:
                    skipped += 1
                    continue
                Invoice.objects.create(
                    student=student,
                    fee_structure=structure,
                    title=structure.title,
                    amount=structure.amount,
                    due_date=due_date,
                    issued_by=request.user,
                )
                created += 1

        return Response(
            {
                "detail": f"{created} invoice(s) generated, {skipped} already existed.",
                "created": created,
                "skipped": skipped,
            }
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, uuid=None):
        invoice = self.get_object()
        if invoice.payments.filter(is_active=True).exists():
            return Response(
                {"detail": "This invoice has payments and cannot be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = "cancelled"
        invoice.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Invoice cancelled."})

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt(self, request, uuid=None):
        invoice = self.get_object()
        payments = invoice.payments.filter(is_active=True)
        return Response(
            {
                "invoice": InvoiceSerializer(invoice).data,
                "payments": PaymentSerializer(payments, many=True).data,
                "school": "School ERP",
            }
        )


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    lookup_field = "uuid"
    filterset_class = PaymentFilter
    search_fields = ["receipt_number", "reference", "invoice__invoice_number"]
    ordering_fields = ["paid_at", "amount"]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_permissions(self):
        if self.request.method == "POST" or self.request.method == "DELETE":
            return [IsAccountantOrAdmin()]
        return [CanViewFinance()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Payment.objects.none()
        return accessible_payments(self.request.user)

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Collection totals for the finance dashboard."""
        if not (is_admin(request.user) or "Accountant" in request.user.role_names):
            raise PermissionDenied("Finance access required.")
        payments = Payment.objects.filter(is_active=True)
        days = min(int(request.query_params.get("days", 180)), 730)
        start = timezone.now() - timedelta(days=days)
        payments = payments.filter(paid_at__gte=start)

        totals = payments.aggregate(total=Sum("amount"), count=Count("id"))
        by_method = list(
            payments.values("method").annotate(total=Sum("amount"), count=Count("id")).order_by("-total")
        )
        monthly = (
            payments.annotate(month=TruncMonth("paid_at"))
            .values("month")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("month")
        )
        return Response(
            {
                "total_collected": totals["total"] or 0,
                "payment_count": totals["count"],
                "by_method": by_method,
                "monthly": [
                    {
                        "month": row["month"].strftime("%Y-%m") if row["month"] else None,
                        "total": row["total"],
                        "count": row["count"],
                    }
                    for row in monthly
                ],
                "range_days": days,
            }
        )


class PaymentGatewayListView(views.APIView):
    """Public gateway metadata for the student/parent checkout UI."""

    permission_classes = [CanViewFinance]

    def get(self, request):
        enabled = bool(settings.PAYMENT_ONLINE_ENABLED)
        return Response(
            {
                "enabled": enabled,
                "sandbox": bool(settings.PAYMENT_SANDBOX),
                "currency": settings.PAYMENT_CURRENCY,
                "intent_ttl_minutes": settings.PAYMENT_INTENT_TTL_MINUTES,
                "gateways": (
                    gateway_catalogue(sandbox=settings.PAYMENT_SANDBOX)
                    if enabled
                    else []
                ),
            }
        )


class PaymentIntentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Idempotent online payment intents for invoices."""

    permission_classes = [CanViewFinance]
    lookup_field = "uuid"
    ordering = ["-created_at"]
    throttle_scope = "payment_intent"

    def get_throttles(self):
        # Polling the checkout status must not consume the strict creation
        # budget, so only mutations use the scoped throttle.
        if self.action in ("create", "sandbox_confirm", "cancel"):
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PaymentIntent.objects.none()
        return accessible_payment_intents(self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return PaymentIntentCreateSerializer
        if self.action == "sandbox_confirm":
            return SandboxConfirmSerializer
        return PaymentIntentSerializer

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.validated_data["invoice"]

        if not accessible_invoices(request.user).filter(pk=invoice.pk).exists():
            # Do not reveal whether another family's invoice exists.
            raise NotFound("Invoice not found.")

        intent, created = create_payment_intent(
            user=request.user,
            invoice=invoice,
            gateway=serializer.validated_data["gateway"],
            amount=serializer.validated_data.get("amount"),
            idempotency_key=request.headers.get("Idempotency-Key", ""),
        )
        output = PaymentIntentSerializer(
            intent, context={"request": request}
        )
        response = Response(
            output.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
        if not created:
            response["Idempotency-Replayed"] = "true"
        return response

    @action(detail=True, methods=["post"], url_path="sandbox-confirm")
    def sandbox_confirm(self, request, uuid=None):
        if not settings.PAYMENT_ONLINE_ENABLED:
            raise ServiceUnavailable("Online fee payments are currently disabled.")
        if not settings.PAYMENT_SANDBOX:
            raise PermissionDenied(
                "Sandbox payments are disabled. Complete the payment on the gateway page."
            )

        intent = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if serializer.validated_data["outcome"] == "failed":
            fail_payment_intent(intent, "Sandbox payment declined by the payer.")
        else:
            settle_payment_intent(
                intent,
                provider_reference=sandbox_reference(),
                payer_reference=serializer.validated_data.get("payer_reference", ""),
                source="sandbox",
            )

        intent.refresh_from_db()
        refresh = PaymentIntentSerializer(intent, context={"request": request})
        return Response(refresh.data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, uuid=None):
        intent = self.get_object()
        if intent.status != "pending":
            raise ValidationError(
                {"detail": f"This payment intent is already {intent.status}."}
            )
        intent.status = "cancelled"
        intent.completed_at = timezone.now()
        intent.failure_reason = "Cancelled by the payer."
        intent.save(
            update_fields=["status", "completed_at", "failure_reason", "updated_at"]
        )
        return Response(
            PaymentIntentSerializer(intent, context={"request": request}).data
        )


class PaymentWebhookView(views.APIView):
    """Gateway callback endpoint.

    It is intentionally unauthenticated (gateways cannot hold a JWT) but every
    request must carry a valid HMAC-SHA256 signature over the raw body and a
    fresh timestamp. Replayed event ids are deduplicated.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment_webhook"

    def post(self, request, gateway):
        import json

        raw_body = request.body
        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except (ValueError, UnicodeDecodeError):
            return Response(
                {"detail": "Invalid JSON payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        status_code, body = process_webhook(
            gateway=gateway,
            payload=payload,
            raw_body=raw_body,
            signature=request.headers.get("X-Payment-Signature", ""),
            timestamp=request.headers.get("X-Payment-Timestamp", ""),
            source_ip=get_client_ip(request),
        )
        return Response(body, status=status_code)
