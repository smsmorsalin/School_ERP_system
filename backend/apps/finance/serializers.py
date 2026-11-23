"""Finance serializers with UUID relations and amount guards."""

from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from apps.academics.models import AcademicYear, SchoolClass, Section, StudentProfile
from apps.finance.models import (
    FeeCategory,
    FeeStructure,
    Invoice,
    Payment,
    PaymentIntent,
)
from apps.finance.payment_gateways import GATEWAY_CHOICES
from apps.finance.payment_service import checkout_url_for


class FeeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeCategory
        fields = ["uuid", "name", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["uuid", "created_at", "updated_at"]


class FeeStructureSerializer(serializers.ModelSerializer):
    academic_year = serializers.SlugRelatedField(
        slug_field="uuid", queryset=AcademicYear.objects.all()
    )
    school_class = serializers.SlugRelatedField(
        slug_field="uuid", queryset=SchoolClass.objects.all()
    )
    category = serializers.SlugRelatedField(
        slug_field="uuid", queryset=FeeCategory.objects.filter(is_active=True)
    )
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = FeeStructure
        fields = [
            "uuid", "academic_year", "academic_year_name", "school_class",
            "class_name", "category", "category_name", "title", "amount",
            "due_date", "description", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class PaymentSerializer(serializers.ModelSerializer):
    invoice = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Invoice.objects.all()
    )
    received_by_name = serializers.CharField(source="received_by.get_full_name", read_only=True)
    student_name = serializers.CharField(source="invoice.student.user.get_full_name", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "uuid", "invoice", "invoice_number", "student_name", "receipt_number",
            "amount", "method", "reference", "paid_at", "notes",
            "received_by", "received_by_name", "is_active", "created_at",
        ]
        read_only_fields = ["uuid", "receipt_number", "received_by", "created_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment must be greater than zero.")
        return value

    def validate(self, attrs):
        invoice = attrs.get("invoice", getattr(self.instance, "invoice", None))
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        if not invoice:
            return attrs
        if invoice.status == "cancelled":
            raise serializers.ValidationError({"invoice": "This invoice is cancelled."})
        if invoice.is_active is False:
            raise serializers.ValidationError({"invoice": "This invoice is inactive."})

        already_paid = invoice.payments.filter(is_active=True).exclude(
            pk=getattr(self.instance, "pk", None)
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        remaining = invoice.amount - already_paid
        if amount and amount > remaining:
            raise serializers.ValidationError(
                {"amount": f"Payment exceeds the outstanding balance of {remaining}."}
            )
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    student = serializers.SlugRelatedField(
        slug_field="uuid", queryset=StudentProfile.objects.filter(is_active=True)
    )
    fee_structure = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=FeeStructure.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)
    class_name = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()
    balance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    effective_status = serializers.CharField(read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "uuid", "student", "student_name", "student_code", "section_name",
            "class_name", "fee_structure", "invoice_number", "title", "amount",
            "amount_paid", "balance", "due_date", "status", "effective_status",
            "is_overdue", "notes", "payments", "is_active", "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "uuid", "invoice_number", "amount_paid", "status",
            "created_at", "updated_at",
        ]

    def get_class_name(self, obj) -> str | None:
        if obj.student.current_section:
            return obj.student.current_section.school_class.name
        return None

    def get_section_name(self, obj) -> str | None:
        if obj.student.current_section:
            return obj.student.current_section.name
        return None

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate(self, attrs):
        student = attrs.get("student", getattr(self.instance, "student", None))
        structure = attrs.get("fee_structure", getattr(self.instance, "fee_structure", None))
        if student and structure:
            qs = Invoice.objects.filter(student=student, fee_structure=structure)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"fee_structure": "An invoice for this fee already exists for this student."}
                )
        if self.instance and self.instance.status == "paid":
            raise serializers.ValidationError(
                {"detail": "A fully paid invoice cannot be edited."}
            )
        return attrs


class PaymentIntentInvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)
    balance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    effective_status = serializers.CharField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "uuid", "invoice_number", "title", "student_name", "student_code",
            "amount", "amount_paid", "balance", "due_date", "status",
            "effective_status",
        ]
        read_only_fields = fields


class PaymentIntentSerializer(serializers.ModelSerializer):
    invoice = PaymentIntentInvoiceSerializer(read_only=True)
    gateway_label = serializers.SerializerMethodField()
    gateway_category = serializers.SerializerMethodField()
    gateway_brand_color = serializers.SerializerMethodField()
    checkout_url = serializers.SerializerMethodField()
    payment = PaymentSerializer(source="settled_payment", read_only=True)
    sandbox = serializers.SerializerMethodField()

    class Meta:
        model = PaymentIntent
        fields = [
            "uuid", "intent_number", "invoice", "gateway", "gateway_label",
            "gateway_category", "gateway_brand_color", "amount", "currency",
            "status", "checkout_url", "sandbox", "provider_reference",
            "payer_reference", "expires_at", "completed_at", "failure_reason",
            "payment", "created_at",
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        instance.expire_if_needed()
        return super().to_representation(instance)

    def _gateway(self, obj):
        from apps.finance.payment_gateways import GATEWAY_BY_CODE

        return GATEWAY_BY_CODE.get(obj.gateway, {})

    def get_gateway_label(self, obj) -> str:
        return self._gateway(obj).get("label", obj.gateway)

    def get_gateway_category(self, obj) -> str:
        return self._gateway(obj).get("category", "")

    def get_gateway_brand_color(self, obj) -> str:
        return self._gateway(obj).get("brand_color", "#4f46e5")

    def get_checkout_url(self, obj) -> str:
        return checkout_url_for(obj, self.context.get("request"))

    def get_sandbox(self, obj) -> bool:
        from django.conf import settings

        return bool(settings.PAYMENT_SANDBOX)


class PaymentIntentCreateSerializer(serializers.Serializer):
    invoice = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Invoice.objects.all()
    )
    gateway = serializers.ChoiceField(choices=GATEWAY_CHOICES)
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
        allow_null=True,
    )

    def validate_amount(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class SandboxConfirmSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(
        choices=("succeeded", "failed"), default="succeeded"
    )
    payer_reference = serializers.CharField(
        max_length=64, required=False, allow_blank=True
    )


class RecordPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    method = serializers.ChoiceField(choices=Payment.METHOD_CHOICES, default="cash")
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True)
    paid_at = serializers.DateTimeField(required=False)

    def validate_amount(self, value):
        invoice = self.context["invoice"]
        remaining = invoice.balance
        if value > remaining:
            raise serializers.ValidationError(
                f"Payment exceeds the outstanding balance of {remaining}."
            )
        return value


class InvoiceGenerateSerializer(serializers.Serializer):
    """Create invoices for every active student in a class or section."""

    fee_structure = serializers.SlugRelatedField(
        slug_field="uuid", queryset=FeeStructure.objects.filter(is_active=True)
    )
    section = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=Section.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    due_date = serializers.DateField(required=False)

    def validate(self, attrs):
        structure = attrs["fee_structure"]
        section = attrs.get("section")
        if section and section.school_class_id != structure.school_class_id:
            raise serializers.ValidationError(
                {"section": "The section does not belong to this fee's class."}
            )
        attrs["due_date"] = attrs.get("due_date") or structure.due_date
        return attrs
