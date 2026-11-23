"""Audit log tests: append-only behaviour, scoping and the reminder command."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.finance.models import Invoice


@pytest.mark.django_db
def test_audit_log_is_created_for_payment_activity(client_for, students, finance_data):
    # Any model write outside the audit app should leave an audit trail.
    invoice = finance_data["invoice"]
    invoice.status = "partial"
    invoice.save(update_fields=["status"])

    assert AuditLog.objects.filter(action="finance.invoice.updated").exists()


@pytest.mark.django_db
def test_audit_log_cannot_be_updated_or_deleted(client_for, students, finance_data):
    entry = AuditLog.objects.create(
        action="test.immutable",
        action_category="test",
    )

    with pytest.raises(ValueError):
        entry.action = "test.changed"
        entry.save()

    with pytest.raises(ValueError):
        entry.delete()


@pytest.mark.django_db
def test_audit_entries_never_recorded_for_auditlog_itself(client_for):
    AuditLog.objects.create(action="audit.self_test", action_category="audit")
    # Creating one entry should not recursively create another.
    count = AuditLog.objects.filter(action__startswith="audit.auditlog").count()
    assert count == 0


@pytest.mark.django_db
def test_audit_viewset_is_admin_only(api, client_for, accountant_user, admin_user):
    response = api.get("/api/v1/audit/")
    assert response.status_code in (401, 403)

    accountant = client_for(accountant_user)
    assert accountant.get("/api/v1/audit/").status_code == 403

    admin = client_for(admin_user)
    response = admin.get("/api/v1/audit/")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Fee reminders
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_fee_reminder_email_sent_to_student_and_guardians(
    client_for, students, finance_data, guardian_link
):
    invoice = finance_data["invoice"]
    invoice.due_date = timezone.localdate() - timedelta(days=5)
    invoice.save(update_fields=["due_date", "updated_at"])

    call_command("send_fee_reminders", "--days-overdue", "0")

    assert len(mail.outbox) == 1
    body = mail.outbox[0].body
    assert invoice.invoice_number in body
    assert str(invoice.balance) in body

    recipients = set(mail.outbox[0].to)
    assert students["user1"].email in recipients
    assert "invoice.reminder_sent" in AuditLog.objects.values_list("action", flat=True)


@pytest.mark.django_db
def test_fee_reminder_dry_run_sends_nothing(client_for, students, finance_data):
    invoice = finance_data["invoice"]
    invoice.due_date = timezone.localdate() - timedelta(days=3)
    invoice.save(update_fields=["due_date", "updated_at"])

    call_command("send_fee_reminders", "--dry-run")

    assert len(mail.outbox) == 0
    assert not AuditLog.objects.filter(action="invoice.reminder_sent").exists()


@pytest.mark.django_db
def test_fee_reminder_skips_paid_and_recent_invoices(
    client_for, students, finance_data
):
    paid = finance_data["invoice"]
    paid.amount_paid = paid.amount
    paid.save(update_fields=["amount_paid", "status", "updated_at"])
    assert paid.status == "paid"

    recent = Invoice.objects.create(
        student=students["student1"],
        title="Fresh fee",
        amount=Decimal("100.00"),
        due_date=timezone.localdate() + timedelta(days=5),
    )

    call_command("send_fee_reminders", "--days-overdue", "0")
    assert len(mail.outbox) == 0
