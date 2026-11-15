"""
Send overdue-fee reminder emails to students and their guardians.

Usage:
    python manage.py send_fee_reminders --days-overdue 7 --dry-run
    python manage.py send_fee_reminders --days-overdue 0

Behavior:
    * Selects invoices with status unpaid/partial whose due_date is at least
      ``--days-overdue`` days in the past (default 0 = any overdue invoice).
    * Sends one email per invoice to the student's email plus every linked
      guardian's email.
    * Skips invoices where no recipient email is available.
    * With ``--dry-run`` it prints who would be emailed without sending.
    * Each sent reminder is recorded in the AuditLog.
"""

from __future__ import annotations

from datetime import timedelta

from django.core.mail import send_mail
from django.utils import timezone
from django.conf import settings

from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.utils import timezone
from django.conf import settings

from apps.academics.models import GuardianStudent, StudentProfile
from apps.finance.models import Invoice
from apps.audit.models import AuditLog


class Command(BaseCommand):
    help = "Send overdue-fee reminder emails to students and guardians."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days-overdue",
            type=int,
            default=0,
            help="Only remind on invoices overdue by at least this many days (default 0).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print recipients without sending email.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Maximum number of reminders to send (0 = unlimited).",
        )

    def handle(self, *args, **options):
        days_overdue = options["days_overdue"]
        dry_run = options["dry_run"]
        limit = options["limit"]

        cutoff = timezone.localdate() - timedelta(days=days_overdue)

        invoices = (
            Invoice.objects.filter(
                status__in=["unpaid", "partial"],
                due_date__lt=cutoff,
                is_active=True,
            )
            .select_related("student__user")
            .order_by("due_date")
        )

        total = 0
        skipped = 0

        for invoice in invoices:
            if limit and total >= limit:
                break

            student = invoice.student
            recipient_emails = set()

            # Student's own email.
            if student.user and student.user.email:
                recipient_emails.add(student.user.email)

            # Linked guardians' emails.
            for link in student.guardian_links.select_related("guardian__user"):
                guardian = link.guardian
                if guardian.user and guardian.user.email:
                    recipient_emails.add(guardian.user.email)

            if not recipient_emails:
                skipped += 1
                self.stdout.write(
                    f"  SKIP {invoice.invoice_number} ({student}): no recipient email"
                )
                continue

            recipient_list = sorted(recipient_emails)
            subject = (
                f"[School ERP] Overdue fee reminder: {invoice.invoice_number}"
            )
            message = (
                f"Dear {student.user.get_full_name() or student.user.email},\n\n"
                f"Your invoice {invoice.invoice_number} for '{invoice.title}' "
                f"was due on {invoice.due_date} and is still overdue.\n"
                f"Outstanding balance: {invoice.balance} {settings.PAYMENT_CURRENCY}.\n\n"
                f"Please clear the balance via the student/parent portal or "
                f"contact the accounts office.\n\n"
                f"Regards,\nSchool ERP Finance"
            )

            self.stdout.write(
                f"  {'[DRY-RUN] ' if dry_run else ''}REMIND "
                f"{invoice.invoice_number} -> {', '.join(recipient_list)}"
            )

            if not dry_run:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    recipient_list,
                    fail_silently=False,
                )
                AuditLog.objects.create(
                    action="invoice.reminder_sent",
                    action_category="finance",
                    target_app="finance",
                    target_model="invoice",
                    target_uuid=invoice.pk,
                    target_repr=str(invoice),
                    metadata={
                        "recipients": recipient_list,
                        "balance": str(invoice.balance),
                        "due_date": str(invoice.due_date),
                        "days_overdue": (timezone.localdate() - invoice.due_date).days,
                    },
                )

            total += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSent {total} reminder(s); skipped {skipped} (no email)."
            )
        )
