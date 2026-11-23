"""Online payment orchestration: intents, settlement and signed webhooks.

Security properties enforced here:

* amounts are always calculated on the server;
* every mutation locks the invoice row so two requests cannot overpay it;
* intent creation is idempotent per user and key;
* settlement is idempotent (a replayed callback cannot create a second
  ``Payment``);
* webhook callbacks are HMAC-SHA256 verified, timestamp-bounded and deduplicated;
* only masked wallet/card/bank references are persisted;
* sandbox confirmation is impossible unless ``PAYMENT_SANDBOX`` is enabled.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
import time
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.exceptions import ConflictError, ServiceUnavailable
from apps.finance.models import Invoice, Payment, PaymentIntent, PaymentWebhookEvent
from apps.finance.payment_gateways import (
    gateway_is_valid,
    gateway_label,
    ledger_method_for,
)

logger = logging.getLogger("apps.finance.payments")

IDEMPOTENCY_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{7,127}")
MONEY_QUANTUM = Decimal("0.01")
MAX_PAYMENT_INTENT_AMOUNT = Decimal("99999999.99")
WEBHOOK_STATUSES = {"succeeded", "failed"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _money(value) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(MONEY_QUANTUM)
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"amount": "Enter a valid payment amount."})
    return amount


def validate_idempotency_key(value: str) -> str:
    key = (value or "").strip()
    if not IDEMPOTENCY_PATTERN.fullmatch(key):
        raise ValidationError(
            {
                "idempotency_key": (
                    "Send an Idempotency-Key header of 8-128 characters using "
                    "letters, numbers, dot, underscore, colon or dash."
                )
            }
        )
    return key


def mask_reference(value: str) -> str:
    """Keep only the last four characters of a wallet/card/bank reference."""
    compact = re.sub(r"\s+", "", str(value or ""))
    if not compact:
        return ""
    compact = compact[-64:]
    if len(compact) <= 4:
        return "*" * len(compact)
    return f"{'*' * (len(compact) - 4)}{compact[-4:]}"


def checkout_url_for(intent: PaymentIntent, request=None) -> str:
    if settings.PAYMENT_SANDBOX:
        path = f"/checkout/{intent.uuid}"
        return request.build_absolute_uri(path) if request is not None else path

    base = settings.PAYMENT_LIVE_CHECKOUT_BASE
    if not base:
        return ""
    from urllib.parse import urlencode

    query = urlencode(
        {
            "intent": str(intent.uuid),
            "reference": intent.intent_number,
            "gateway": intent.gateway,
            "amount": f"{intent.amount:.2f}",
            "currency": intent.currency,
        }
    )
    return f"{base}{'&' if '?' in base else '?'}{query}"


# ---------------------------------------------------------------------------
# Intent creation
# ---------------------------------------------------------------------------
def create_payment_intent(
    *,
    user,
    invoice: Invoice,
    gateway: str,
    amount=None,
    idempotency_key: str,
):
    """Create (or replay) an idempotent online payment intent.

    Returns ``(intent, created)``. The invoice row is locked while the balance
    is checked so simultaneous requests cannot both pass validation.
    """
    if not settings.PAYMENT_ONLINE_ENABLED:
        raise ServiceUnavailable("Online fee payments are currently disabled.")
    if not gateway_is_valid(gateway):
        raise ValidationError({"gateway": "Choose a supported payment method."})
    key = validate_idempotency_key(idempotency_key)

    with transaction.atomic():
        locked_invoice = (
            Invoice.objects.select_for_update()
            .select_related("student__user")
            .get(pk=invoice.pk)
        )

        existing = (
            PaymentIntent.objects.select_for_update()
            .filter(created_by=user, idempotency_key=key)
            .first()
        )
        if existing:
            if (
                existing.invoice_id != locked_invoice.id
                or existing.gateway != gateway
                or (amount is not None and existing.amount != _money(amount))
            ):
                raise ConflictError(
                    "This Idempotency-Key was already used with different payment details."
                )
            return existing, False

        if not locked_invoice.is_active or locked_invoice.status == "cancelled":
            raise ValidationError({"invoice": "This invoice cannot accept payments."})
        if locked_invoice.status == "paid" or locked_invoice.balance <= 0:
            raise ValidationError({"invoice": "This invoice is already fully paid."})

        requested = (
            locked_invoice.balance if amount is None else _money(amount)
        )
        if requested <= 0:
            raise ValidationError({"amount": "Amount must be greater than zero."})
        if requested > MAX_PAYMENT_INTENT_AMOUNT:
            raise ValidationError({"amount": "Amount exceeds the supported limit."})
        if requested > locked_invoice.balance:
            raise ValidationError(
                {
                    "amount": (
                        "Payment exceeds the outstanding balance of "
                        f"{locked_invoice.balance}."
                    )
                }
            )

        if not settings.PAYMENT_SANDBOX and not settings.PAYMENT_LIVE_CHECKOUT_BASE:
            raise ServiceUnavailable(
                "Live online payments are not configured. Please contact the school."
            )

        intent = PaymentIntent.objects.create(
            invoice=locked_invoice,
            created_by=user,
            gateway=gateway,
            amount=requested,
            currency=settings.PAYMENT_CURRENCY,
            idempotency_key=key,
            expires_at=timezone.now()
            + timedelta(minutes=settings.PAYMENT_INTENT_TTL_MINUTES),
            metadata={"sandbox": settings.PAYMENT_SANDBOX},
        )
        return intent, True


# ---------------------------------------------------------------------------
# Settlement
# ---------------------------------------------------------------------------
def settle_payment_intent(
    intent: PaymentIntent,
    *,
    provider_reference: str = "",
    payer_reference: str = "",
    source: str = "webhook",
):
    """Atomically turn a successful intent into an immutable ledger payment.

    Safe to call repeatedly: an already-succeeded intent is returned unchanged
    without creating another ``Payment``.
    """
    failure = None
    settled = None

    with transaction.atomic():
        locked = (
            PaymentIntent.objects.select_for_update()
            .select_related("invoice", "created_by")
            .get(pk=intent.pk)
        )

        if locked.status == "succeeded":
            return locked, False

        if locked.status != "pending":
            failure = ConflictError(
                f"This payment intent is {locked.status} and cannot be settled."
            )
        elif timezone.now() >= locked.expires_at:
            locked.status = "expired"
            locked.completed_at = timezone.now()
            locked.failure_reason = "Payment intent expired before confirmation."
            locked.save(
                update_fields=[
                    "status",
                    "completed_at",
                    "failure_reason",
                    "updated_at",
                ]
            )
            failure = ConflictError("This payment intent has expired.")
        else:
            invoice = Invoice.objects.select_for_update().get(pk=locked.invoice_id)
            if not invoice.is_active or invoice.status == "cancelled":
                locked.status = "failed"
                locked.completed_at = timezone.now()
                locked.failure_reason = "The invoice no longer accepts payments."
                locked.save(
                    update_fields=[
                        "status",
                        "completed_at",
                        "failure_reason",
                        "updated_at",
                    ]
                )
                failure = ConflictError(
                    "The invoice no longer accepts payments."
                )
            elif invoice.balance < locked.amount:
                locked.status = "failed"
                locked.completed_at = timezone.now()
                locked.failure_reason = (
                    "The outstanding balance changed before confirmation."
                )
                locked.save(
                    update_fields=[
                        "status",
                        "completed_at",
                        "failure_reason",
                        "updated_at",
                    ]
                )
                failure = ConflictError(
                    "The outstanding balance changed before the payment completed."
                )
            else:
                reference = (provider_reference or locked.intent_number)[:100]
                mode = "sandbox" if settings.PAYMENT_SANDBOX else "live"
                payment = Payment.objects.create(
                    invoice=invoice,
                    amount=locked.amount,
                    method=ledger_method_for(locked.gateway),
                    reference=f"{locked.intent_number} · {reference}"[:100],
                    paid_at=timezone.now(),
                    notes=(
                        f"Online payment via {gateway_label(locked.gateway)} "
                        f"({mode}, {source})"
                    )[:255],
                    received_by=locked.created_by,
                )
                locked.status = "succeeded"
                locked.provider_reference = reference
                locked.payer_reference = mask_reference(payer_reference)
                locked.settled_payment = payment
                locked.completed_at = timezone.now()
                locked.failure_reason = ""
                locked.save(
                    update_fields=[
                        "status",
                        "provider_reference",
                        "payer_reference",
                        "settled_payment",
                        "completed_at",
                        "failure_reason",
                        "updated_at",
                    ]
                )
                settled = (locked, True)

    if failure:
        raise failure
    return settled


def fail_payment_intent(intent: PaymentIntent, reason: str) -> PaymentIntent:
    PaymentIntent.objects.filter(pk=intent.pk, status="pending").update(
        status="failed",
        failure_reason=reason[:255],
        completed_at=timezone.now(),
        updated_at=timezone.now(),
    )
    intent.refresh_from_db()
    return intent


# ---------------------------------------------------------------------------
# Webhook verification
# ---------------------------------------------------------------------------
def compute_webhook_signature(secret: str, raw_body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()


def verify_webhook_signature(
    *,
    secret: str,
    timestamp: str,
    signature: str,
    raw_body: bytes,
    tolerance: int,
) -> tuple[bool, str]:
    if not secret:
        return False, "Webhook secret is not configured."
    try:
        sent_at = int(str(timestamp).strip())
    except (TypeError, ValueError):
        return False, "Missing or invalid X-Payment-Timestamp header."
    if abs(int(time.time()) - sent_at) > tolerance:
        return False, "Webhook timestamp is outside the allowed tolerance."

    supplied = (signature or "").strip()
    if supplied.lower().startswith("sha256="):
        supplied = supplied[7:]
    expected = compute_webhook_signature(secret, raw_body)
    if not hmac.compare_digest(supplied, expected):
        return False, "Invalid webhook signature."
    return True, ""


def process_webhook(
    *,
    gateway: str,
    payload: dict,
    raw_body: bytes,
    signature: str,
    timestamp: str,
    source_ip: str | None = None,
) -> tuple[int, dict]:
    """Validate, deduplicate and settle a gateway callback.

    Returns an ``(http_status, body)`` tuple. Unknown intents and terminal
    business failures are acknowledged with 200 so gateways do not retry them
    forever; signature and payload errors are rejected with 4xx.
    """
    if not settings.PAYMENT_ONLINE_ENABLED:
        return 503, {"detail": "Online payments are disabled."}
    if not gateway_is_valid(gateway):
        return 404, {"detail": "Unknown payment gateway."}

    valid, error = verify_webhook_signature(
        secret=settings.PAYMENT_WEBHOOK_SECRET,
        timestamp=timestamp,
        signature=signature,
        raw_body=raw_body,
        tolerance=settings.PAYMENT_WEBHOOK_TOLERANCE_SECONDS,
    )
    if not valid:
        logger.warning("Rejected %s payment webhook from %s: %s", gateway, source_ip, error)
        status_code = 503 if "not configured" in error else 401
        return status_code, {"detail": error}

    if not isinstance(payload, dict):
        return 400, {"detail": "Webhook payload must be a JSON object."}

    event_id = str(payload.get("event_id") or payload.get("id") or "").strip()
    if not event_id or len(event_id) > 128:
        return 400, {"detail": "Webhook payload requires an event_id."}

    event_type = str(payload.get("event_type") or payload.get("type") or "payment.updated")[:50]
    payload_hash = hashlib.sha256(raw_body).hexdigest()

    if PaymentWebhookEvent.objects.filter(gateway=gateway, event_id=event_id).exists():
        return 200, {"status": "duplicate", "detail": "Event already processed."}

    intent_uuid = (
        payload.get("intent")
        or payload.get("intent_uuid")
        or payload.get("reference")
        or ""
    )
    status_value = str(payload.get("status") or "").lower()

    try:
        event = PaymentWebhookEvent.objects.create(
            gateway=gateway,
            event_id=event_id,
            event_type=event_type,
            status="received",
            payload=payload,
            payload_hash=payload_hash,
            signature_valid=True,
            source_ip=source_ip,
        )
    except IntegrityError:
        return 200, {"status": "duplicate", "detail": "Event already processed."}

    intent = PaymentIntent.objects.filter(uuid=intent_uuid).first()
    if not intent:
        event.status = "ignored"
        event.error = "Unknown payment intent."
        event.processed_at = timezone.now()
        event.save(update_fields=["status", "error", "processed_at", "updated_at"])
        return 200, {"status": "ignored", "detail": "Unknown payment intent."}

    event.intent = intent

    if status_value not in WEBHOOK_STATUSES:
        event.status = "ignored"
        event.error = "Unsupported event status."
        event.processed_at = timezone.now()
        event.save(
            update_fields=["intent", "status", "error", "processed_at", "updated_at"]
        )
        return 200, {"status": "ignored", "detail": "Event status not actionable."}

    try:
        amount = _money(payload.get("amount"))
    except ValidationError:
        event.status = "failed"
        event.error = "Missing or invalid amount."
        event.processed_at = timezone.now()
        event.save(
            update_fields=["intent", "status", "error", "processed_at", "updated_at"]
        )
        return 400, {"detail": "Webhook amount is invalid."}

    currency = str(payload.get("currency") or "").upper()
    if amount != intent.amount or currency != intent.currency:
        event.status = "failed"
        event.error = "Amount or currency mismatch."
        event.processed_at = timezone.now()
        event.save(
            update_fields=["intent", "status", "error", "processed_at", "updated_at"]
        )
        return 400, {"detail": "Webhook amount or currency does not match the intent."}

    provider_reference = str(payload.get("provider_reference") or "")[:128]
    payer_reference = str(payload.get("payer_reference") or "")[:128]

    if status_value == "failed":
        fail_payment_intent(
            intent,
            str(payload.get("failure_reason") or "Payment declined by gateway."),
        )
        event.status = "processed"
        event.processed_at = timezone.now()
        event.save(
            update_fields=["intent", "status", "processed_at", "updated_at"]
        )
        return 200, {"status": "processed", "intent_status": "failed"}

    try:
        settled_intent, _created = settle_payment_intent(
            intent,
            provider_reference=provider_reference,
            payer_reference=payer_reference,
            source=f"webhook:{gateway}",
        )
    except ConflictError as exc:
        event.status = "failed"
        event.error = str(exc.detail)[:255]
        event.processed_at = timezone.now()
        event.save(
            update_fields=["intent", "status", "error", "processed_at", "updated_at"]
        )
        return 200, {
            "status": "failed",
            "detail": str(exc.detail),
            "intent_status": PaymentIntent.objects.get(pk=intent.pk).status,
        }

    event.status = "processed"
    event.processed_at = timezone.now()
    event.save(update_fields=["intent", "status", "processed_at", "updated_at"])
    return 200, {
        "status": "processed",
        "intent_status": settled_intent.status,
    }


def sandbox_reference() -> str:
    return f"SBX-{secrets.token_hex(6).upper()}"
