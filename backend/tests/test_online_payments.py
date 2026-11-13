"""Online payment tests: scoping, idempotency, settlement and webhooks."""

from __future__ import annotations

import json
import time
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.finance.models import Invoice, Payment, PaymentIntent, PaymentWebhookEvent
from apps.finance.payment_service import compute_webhook_signature

INTENTS = "/api/v1/finance/payment-intents/"
GATEWAYS = "/api/v1/finance/payment-gateways/"
INVOICES = "/api/v1/finance/invoices/"
WEBHOOK = "/api/v1/finance/payment-webhook/bkash/"
SECRET = "unit-test-webhook-secret-0123456789abcdef"


def create_intent(client, invoice, *, gateway="bkash", amount=None, key="checkout-key-0001"):
    body = {"invoice": str(invoice.uuid), "gateway": gateway}
    if amount is not None:
        body["amount"] = amount
    return client.post(
        INTENTS,
        body,
        format="json",
        HTTP_IDEMPOTENCY_KEY=key,
    )


def signed_webhook(client, payload, *, secret=SECRET, timestamp=None, signature=None):
    raw = json.dumps(payload, separators=(",", ":")).encode()
    timestamp = str(timestamp if timestamp is not None else int(time.time()))
    if signature is None:
        signature = compute_webhook_signature(secret, raw)
    return client.post(
        WEBHOOK,
        data=raw,
        content_type="application/json",
        HTTP_X_PAYMENT_SIGNATURE=signature,
        HTTP_X_PAYMENT_TIMESTAMP=timestamp,
    )


@pytest.fixture
def client_for():
    """Authenticate without the login endpoint (keeps tests off the login throttle)."""

    def _factory(user):
        from rest_framework_simplejwt.tokens import RefreshToken

        token = RefreshToken.for_user(user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
        return client

    return _factory


# ---------------------------------------------------------------------------
# Catalogue and creation
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_gateway_catalogue_lists_all_required_methods(client_for, students):
    response = client_for(students["user1"]).get(GATEWAYS)
    assert response.status_code == 200, response.content
    codes = {gateway["code"] for gateway in response.data["gateways"]}
    assert {"bkash", "nagad", "rocket", "mobile_banking", "card", "bank"} <= codes
    assert response.data["currency"] == "BDT"
    assert response.data["sandbox"] is True


@pytest.mark.django_db
def test_student_can_create_intent_for_own_invoice(client_for, students, finance_data):
    client = client_for(students["user1"])
    response = create_intent(client, finance_data["invoice"])

    assert response.status_code == 201, response.content
    assert response.data["status"] == "pending"
    assert response.data["amount"] == "500.00"
    assert response.data["gateway_label"] == "bKash"
    assert response.data["checkout_url"].endswith(f"/checkout/{response.data['uuid']}")
    assert PaymentIntent.objects.count() == 1


@pytest.mark.django_db
def test_student_cannot_create_intent_for_another_students_invoice(
    client_for, students, finance_data
):
    response = create_intent(
        client_for(students["user2"]), finance_data["invoice"], key="other-key-0001"
    )
    assert response.status_code == 404
    assert PaymentIntent.objects.count() == 0


@pytest.mark.django_db
def test_parent_can_pay_child_but_not_unrelated_student(
    client_for, parent_user, guardian_link, students, finance_data
):
    client = client_for(parent_user)
    allowed = create_intent(client, finance_data["invoice"], key="parent-key-0001")
    assert allowed.status_code == 201, allowed.content

    other_invoice = Invoice.objects.create(
        student=students["student2"],
        title="Other fees",
        amount=Decimal("100.00"),
        due_date=finance_data["invoice"].due_date,
    )
    denied = create_intent(client, other_invoice, key="parent-key-0002")
    assert denied.status_code == 404


@pytest.mark.django_db
def test_amount_cannot_exceed_balance_or_be_zero(
    client_for, students, finance_data
):
    client = client_for(students["user1"])
    too_much = create_intent(
        client, finance_data["invoice"], amount="500.01", key="over-key-0001"
    )
    assert too_much.status_code == 400

    zero = create_intent(
        client, finance_data["invoice"], amount="0.00", key="zero-key-0001"
    )
    assert zero.status_code == 400


@pytest.mark.django_db
def test_partial_intent_uses_server_calculated_amount(
    client_for, students, finance_data
):
    response = create_intent(
        client_for(students["user1"]),
        finance_data["invoice"],
        amount="125.00",
        key="partial-key-0001",
    )
    assert response.status_code == 201
    assert response.data["amount"] == "125.00"

    # An overpayment attempt is still validated against the invoice balance.
    response = create_intent(
        client_for(students["user1"]),
        finance_data["invoice"],
        amount="900.00",
        key="partial-key-0002",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_cancelled_invoice_cannot_start_online_payment(
    client_for, students, finance_data
):
    invoice = finance_data["invoice"]
    invoice.status = "cancelled"
    invoice.save(update_fields=["status"])

    response = create_intent(client_for(students["user1"]), invoice)
    assert response.status_code == 400


@pytest.mark.django_db
def test_idempotency_key_replays_same_intent_and_rejects_mismatch(
    client_for, students, finance_data
):
    client = client_for(students["user1"])
    first = create_intent(client, finance_data["invoice"], key="replay-key-0001")
    second = create_intent(client, finance_data["invoice"], key="replay-key-0001")

    assert first.status_code == 201
    assert second.status_code == 200
    assert second["Idempotency-Replayed"] == "true"
    assert second.data["uuid"] == first.data["uuid"]
    assert PaymentIntent.objects.count() == 1

    mismatch = client.post(
        INTENTS,
        {"invoice": str(finance_data["invoice"].uuid), "gateway": "nagad"},
        format="json",
        HTTP_IDEMPOTENCY_KEY="replay-key-0001",
    )
    assert mismatch.status_code == 409


@pytest.mark.django_db
def test_idempotency_header_is_required(client_for, students, finance_data):
    response = client_for(students["user1"]).post(
        INTENTS,
        {"invoice": str(finance_data["invoice"].uuid), "gateway": "bkash"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_fully_paid_invoice_is_rejected(client_for, accountant_user, students, finance_data):
    invoice = finance_data["invoice"]
    invoice.recalculate()
    Payment.objects.create(
        invoice=invoice,
        amount=Decimal("500.00"),
        method="cash",
        received_by=accountant_user,
    )

    response = create_intent(client_for(students["user1"]), invoice)
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Sandbox settlement
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_sandbox_confirmation_creates_atomic_payment(
    client_for, students, finance_data
):
    client = client_for(students["user1"])
    created = create_intent(client, finance_data["invoice"])
    intent_uuid = created.data["uuid"]

    response = client.post(
        f"{INTENTS}{intent_uuid}/sandbox-confirm/",
        {"outcome": "succeeded", "payer_reference": "01712345678"},
        format="json",
    )
    assert response.status_code == 200, response.content
    assert response.data["status"] == "succeeded"
    assert response.data["payment"]["method"] == "mobile_money"

    invoice = Invoice.objects.get(pk=finance_data["invoice"].pk)
    assert invoice.status == "paid"
    assert invoice.amount_paid == Decimal("500.00")
    assert invoice.payments.count() == 1

    intent = PaymentIntent.objects.get(uuid=intent_uuid)
    assert intent.status == "succeeded"
    assert intent.settled_payment_id is not None
    assert intent.payer_reference == "*******5678"


@pytest.mark.django_db
def test_duplicate_sandbox_confirmation_is_idempotent(
    client_for, students, finance_data
):
    client = client_for(students["user1"])
    intent_uuid = create_intent(client, finance_data["invoice"]).data["uuid"]

    first = client.post(f"{INTENTS}{intent_uuid}/sandbox-confirm/", {}, format="json")
    second = client.post(f"{INTENTS}{intent_uuid}/sandbox-confirm/", {}, format="json")

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.data["status"] == "succeeded"
    assert Payment.objects.count() == 1
    assert Invoice.objects.get(pk=finance_data["invoice"].pk).amount_paid == Decimal("500.00")


@pytest.mark.django_db
def test_sandbox_can_decline_payment(client_for, students, finance_data):
    client = client_for(students["user1"])
    intent_uuid = create_intent(client, finance_data["invoice"]).data["uuid"]

    response = client.post(
        f"{INTENTS}{intent_uuid}/sandbox-confirm/",
        {"outcome": "failed"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["status"] == "failed"
    assert Payment.objects.count() == 0
    assert Invoice.objects.get(pk=finance_data["invoice"].pk).status == "unpaid"


@pytest.mark.django_db
def test_sandbox_confirmation_is_blocked_when_sandbox_is_off(
    client_for, students, finance_data, settings
):
    client = client_for(students["user1"])
    intent_uuid = create_intent(client, finance_data["invoice"]).data["uuid"]

    settings.PAYMENT_SANDBOX = False
    response = client.post(f"{INTENTS}{intent_uuid}/sandbox-confirm/", {}, format="json")
    assert response.status_code == 403
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_card_and_bank_intents_map_to_ledger_methods(
    client_for, students, finance_data
):
    client = client_for(students["user1"])

    card_uuid = create_intent(
        client, finance_data["invoice"], gateway="card", amount="100.00", key="card-key-0001"
    ).data["uuid"]
    client.post(f"{INTENTS}{card_uuid}/sandbox-confirm/", {}, format="json")

    bank_uuid = create_intent(
        client, finance_data["invoice"], gateway="bank", amount="100.00", key="bank-key-0001"
    ).data["uuid"]
    client.post(f"{INTENTS}{bank_uuid}/sandbox-confirm/", {}, format="json")

    methods = set(Payment.objects.values_list("method", flat=True))
    assert methods == {"card", "bank_transfer"}


# ---------------------------------------------------------------------------
# Expiry, cancellation and ownership
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_expired_intent_is_marked_and_cannot_settle(
    client_for, students, finance_data
):
    client = client_for(students["user1"])
    intent_uuid = create_intent(client, finance_data["invoice"]).data["uuid"]
    PaymentIntent.objects.filter(uuid=intent_uuid).update(
        expires_at=timezone.now() - timedelta(minutes=1)
    )

    detail = client.get(f"{INTENTS}{intent_uuid}/")
    assert detail.status_code == 200
    assert detail.data["status"] == "expired"

    confirm = client.post(f"{INTENTS}{intent_uuid}/sandbox-confirm/", {}, format="json")
    assert confirm.status_code == 409
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_payer_can_cancel_pending_intent(client_for, students, finance_data):
    client = client_for(students["user1"])
    intent_uuid = create_intent(client, finance_data["invoice"]).data["uuid"]

    response = client.post(f"{INTENTS}{intent_uuid}/cancel/", {}, format="json")
    assert response.status_code == 200
    assert response.data["status"] == "cancelled"

    confirm = client.post(f"{INTENTS}{intent_uuid}/sandbox-confirm/", {}, format="json")
    assert confirm.status_code == 409


@pytest.mark.django_db
def test_intents_are_private_to_the_family(client_for, students, finance_data):
    owner = client_for(students["user1"])
    intent_uuid = create_intent(owner, finance_data["invoice"]).data["uuid"]

    other = client_for(students["user2"])
    assert other.get(f"{INTENTS}{intent_uuid}/").status_code == 404
    listing = other.get(INTENTS)
    assert listing.status_code == 200
    assert listing.data["count"] == 0


@pytest.mark.django_db
def test_balance_change_before_settlement_fails_safely(
    client_for, accountant_user, students, finance_data
):
    client = client_for(students["user1"])
    intent_uuid = create_intent(client, finance_data["invoice"]).data["uuid"]

    # A cashier records part of the bill while the payer is on the gateway page.
    Payment.objects.create(
        invoice=finance_data["invoice"],
        amount=Decimal("200.00"),
        method="cash",
        received_by=accountant_user,
    )

    response = client.post(f"{INTENTS}{intent_uuid}/sandbox-confirm/", {}, format="json")
    assert response.status_code == 409
    intent = PaymentIntent.objects.get(uuid=intent_uuid)
    assert intent.status == "failed"
    assert Payment.objects.filter(method="mobile_money").count() == 0


# ---------------------------------------------------------------------------
# Signed webhooks
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_valid_webhook_settles_intent_once(
    client_for, students, finance_data, settings
):
    settings.PAYMENT_WEBHOOK_SECRET = SECRET
    client = client_for(students["user1"])
    created = create_intent(client, finance_data["invoice"])
    intent_uuid = created.data["uuid"]

    payload = {
        "event_id": "evt_001",
        "event_type": "payment.succeeded",
        "intent": intent_uuid,
        "status": "succeeded",
        "amount": "500.00",
        "currency": "BDT",
        "provider_reference": "TRX-998877",
        "payer_reference": "01712345678",
    }
    response = signed_webhook(APIClient(), payload)
    assert response.status_code == 200, response.content
    assert response.data["status"] == "processed"

    invoice = Invoice.objects.get(pk=finance_data["invoice"].pk)
    assert invoice.status == "paid"
    assert Payment.objects.count() == 1

    event = PaymentWebhookEvent.objects.get(event_id="evt_001")
    assert event.status == "processed"
    assert event.signature_valid is True
    assert str(event.intent.uuid) == intent_uuid

    # A replay of the same event id is acknowledged but cannot pay twice.
    replay = signed_webhook(APIClient(), payload)
    assert replay.status_code == 200
    assert replay.data["status"] == "duplicate"
    assert Payment.objects.count() == 1


@pytest.mark.django_db
def test_webhook_rejects_invalid_signature(client_for, students, finance_data, settings):
    settings.PAYMENT_WEBHOOK_SECRET = SECRET
    intent_uuid = create_intent(
        client_for(students["user1"]), finance_data["invoice"]
    ).data["uuid"]
    payload = {
        "event_id": "evt_bad_sig",
        "intent": intent_uuid,
        "status": "succeeded",
        "amount": "500.00",
        "currency": "BDT",
    }
    response = signed_webhook(APIClient(), payload, signature="0" * 64)
    assert response.status_code == 401
    assert Payment.objects.count() == 0
    assert PaymentWebhookEvent.objects.count() == 0


@pytest.mark.django_db
def test_webhook_rejects_stale_timestamp(client_for, students, finance_data, settings):
    settings.PAYMENT_WEBHOOK_SECRET = SECRET
    intent_uuid = create_intent(
        client_for(students["user1"]), finance_data["invoice"]
    ).data["uuid"]
    payload = {
        "event_id": "evt_stale",
        "intent": intent_uuid,
        "status": "succeeded",
        "amount": "500.00",
        "currency": "BDT",
    }
    response = signed_webhook(
        APIClient(), payload, timestamp=int(time.time()) - 3600
    )
    assert response.status_code == 401
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_webhook_rejects_amount_mismatch(client_for, students, finance_data, settings):
    settings.PAYMENT_WEBHOOK_SECRET = SECRET
    intent_uuid = create_intent(
        client_for(students["user1"]), finance_data["invoice"]
    ).data["uuid"]
    payload = {
        "event_id": "evt_amount",
        "intent": intent_uuid,
        "status": "succeeded",
        "amount": "1.00",
        "currency": "BDT",
    }
    response = signed_webhook(APIClient(), payload)
    assert response.status_code == 400
    assert Payment.objects.count() == 0
    assert PaymentWebhookEvent.objects.get(event_id="evt_amount").status == "failed"


@pytest.mark.django_db
def test_webhook_ignores_unknown_intent(client_for, students, finance_data, settings):
    settings.PAYMENT_WEBHOOK_SECRET = SECRET
    create_intent(client_for(students["user1"]), finance_data["invoice"])
    payload = {
        "event_id": "evt_unknown",
        "intent": "00000000-0000-0000-0000-000000000000",
        "status": "succeeded",
        "amount": "500.00",
        "currency": "BDT",
    }
    response = signed_webhook(APIClient(), payload)
    assert response.status_code == 200
    assert response.data["status"] == "ignored"
    assert PaymentWebhookEvent.objects.get(event_id="evt_unknown").status == "ignored"


@pytest.mark.django_db
def test_webhook_failure_marks_intent_failed(
    client_for, students, finance_data, settings
):
    settings.PAYMENT_WEBHOOK_SECRET = SECRET
    intent_uuid = create_intent(
        client_for(students["user1"]), finance_data["invoice"]
    ).data["uuid"]
    payload = {
        "event_id": "evt_declined",
        "intent": intent_uuid,
        "status": "failed",
        "amount": "500.00",
        "currency": "BDT",
        "failure_reason": "Insufficient wallet balance.",
    }
    response = signed_webhook(APIClient(), payload)
    assert response.status_code == 200
    assert response.data["intent_status"] == "failed"
    assert PaymentIntent.objects.get(uuid=intent_uuid).status == "failed"
    assert Payment.objects.count() == 0
