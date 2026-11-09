"""Finance tests: invoice scoping, atomic payments and totals."""

from __future__ import annotations

from decimal import Decimal

import pytest

from apps.finance.models import FeeCategory, Invoice, Payment

INVOICES = "/api/v1/finance/invoices/"
PAYMENTS = "/api/v1/finance/payments/"
STRUCTURES = "/api/v1/finance/fee-structures/"


@pytest.mark.django_db
def test_accountant_can_record_partial_payment(auth_client, accountant_user, finance_data):
    client = auth_client(accountant_user)
    response = client.post(
        PAYMENTS,
        {
            "invoice": str(finance_data["invoice"].uuid),
            "amount": "200.00",
            "method": "cash",
        },
        format="json",
    )
    assert response.status_code == 201, response.content

    invoice = Invoice.objects.get(pk=finance_data["invoice"].pk)
    assert invoice.amount_paid == Decimal("200.00")
    assert invoice.status == "partial"
    assert invoice.balance == Decimal("300.00")


@pytest.mark.django_db
def test_invoice_payment_action_marks_invoice_paid(auth_client, accountant_user, finance_data):
    client = auth_client(accountant_user)
    response = client.post(
        f"{INVOICES}{finance_data['invoice'].uuid}/payments/",
        {"amount": "500.00", "method": "card"},
        format="json",
    )
    assert response.status_code == 201, response.content
    assert response.data["invoice"]["status"] == "paid"
    assert response.data["invoice"]["balance"] == "0.00"


@pytest.mark.django_db
def test_overpayment_is_rejected(auth_client, accountant_user, finance_data):
    client = auth_client(accountant_user)
    response = client.post(
        PAYMENTS,
        {
            "invoice": str(finance_data["invoice"].uuid),
            "amount": "750.00",
            "method": "cash",
        },
        format="json",
    )
    assert response.status_code == 400
    assert finance_data["invoice"].payments.count() == 0


@pytest.mark.django_db
def test_second_payment_cannot_exceed_remaining_balance(
    auth_client, accountant_user, finance_data
):
    client = auth_client(accountant_user)
    client.post(
        PAYMENTS,
        {
            "invoice": str(finance_data["invoice"].uuid),
            "amount": "400.00",
            "method": "cash",
        },
        format="json",
    )
    response = client.post(
        PAYMENTS,
        {
            "invoice": str(finance_data["invoice"].uuid),
            "amount": "150.00",
            "method": "cash",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_cancelled_invoice_cannot_receive_payment(auth_client, accountant_user, finance_data):
    invoice = finance_data["invoice"]
    invoice.status = "cancelled"
    invoice.save(update_fields=["status"])

    response = auth_client(accountant_user).post(
        PAYMENTS,
        {"invoice": str(invoice.uuid), "amount": "10.00", "method": "cash"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_payment_deletion_recalculates_invoice(auth_client, accountant_user, finance_data):
    client = auth_client(accountant_user)
    created = client.post(
        PAYMENTS,
        {
            "invoice": str(finance_data["invoice"].uuid),
            "amount": "200.00",
            "method": "cash",
        },
        format="json",
    )
    payment_uuid = created.data["uuid"]

    deleted = client.delete(f"{PAYMENTS}{payment_uuid}/")
    assert deleted.status_code == 204

    invoice = Invoice.objects.get(pk=finance_data["invoice"].pk)
    assert invoice.amount_paid == Decimal("0.00")
    assert invoice.status == "unpaid"


@pytest.mark.django_db
def test_invoice_generation_creates_for_section_and_skips_duplicates(
    auth_client, accountant_user, academic_data, finance_data
):
    client = auth_client(accountant_user)
    body = {
        "fee_structure": str(finance_data["structure"].uuid),
        "section": str(academic_data["section_a"].uuid),
    }
    # student1 already has an invoice for this structure, student2 does not.
    first = client.post(f"{INVOICES}generate/", body, format="json")
    assert first.status_code == 200, first.content
    assert first.data["created"] == 1
    assert first.data["skipped"] == 1

    second = client.post(f"{INVOICES}generate/", body, format="json")
    assert second.data["created"] == 0
    assert second.data["skipped"] == 2


@pytest.mark.django_db
def test_student_can_view_own_receipt_but_not_another(
    auth_client, accountant_user, students, finance_data
):
    accountant = auth_client(accountant_user)
    accountant.post(
        PAYMENTS,
        {
            "invoice": str(finance_data["invoice"].uuid),
            "amount": "100.00",
            "method": "cash",
        },
        format="json",
    )

    owner = auth_client(students["user1"])
    assert owner.get(f"{INVOICES}{finance_data['invoice'].uuid}/receipt/").status_code == 200

    other_invoice = Invoice.objects.create(
        student=students["student2"],
        title="Other",
        amount=Decimal("100.00"),
        due_date=finance_data["invoice"].due_date,
    )
    assert (
        owner.get(f"{INVOICES}{other_invoice.uuid}/receipt/").status_code == 404
    )


@pytest.mark.django_db
def test_accountant_can_create_fee_structure(auth_client, accountant_user, academic_data):
    category = FeeCategory.objects.create(name="Transport")
    response = auth_client(accountant_user).post(
        STRUCTURES,
        {
            "academic_year": str(academic_data["year"].uuid),
            "school_class": str(academic_data["grade"].uuid),
            "category": str(category.uuid),
            "title": "Bus service",
            "amount": "120.00",
            "due_date": "2026-04-01",
        },
        format="json",
    )
    assert response.status_code == 201, response.content


@pytest.mark.django_db
def test_payment_summary_requires_finance_role(auth_client, accountant_user, teacher_user, teacher_profile):
    assert auth_client(accountant_user).get(f"{PAYMENTS}summary/").status_code == 200
    assert auth_client(teacher_user).get(f"{PAYMENTS}summary/").status_code == 403
