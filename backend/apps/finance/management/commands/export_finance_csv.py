"""
Export finance data to CSV.

Usage:
    python manage.py export_finance_csv --model invoices --output /tmp/invoices.csv
    python manage.py export_finance_csv --model payments --output /tmp/payments.csv
    python manage.py export_finance_csv --model fee-structures --output /tmp/fee_structures.csv

Models: invoices | payments | fee-structures
"""

from __future__ import annotations

import csv

from django.core.management.base import BaseCommand

from apps.finance.models import FeeStructure, Invoice, Payment


MODEL_MAP = {
    "invoices": Invoice,
    "payments": Payment,
    "fee-structures": FeeStructure,
}

FIELD_MAP = {
    "invoices": [
        "invoice_number", "title", "student__student_id", "student__user__email",
        "fee_structure__title", "amount", "amount_paid", "balance", "due_date",
        "status", "effective_status", "is_overdue", "created_at",
    ],
    "payments": [
        "receipt_number", "invoice__invoice_number", "amount", "method",
        "reference", "notes", "paid_at", "received_by__email", "created_at",
    ],
    "fee-structures": [
        "title", "school_class__name", "category__name", "amount", "due_date",
        "academic_year__name", "is_active", "created_at",
    ],
}


class Command(BaseCommand):
    help = "Export finance data to CSV."

    def add_arguments(self, parser):
        parser.add_argument(
            "--model",
            required=True,
            choices=list(MODEL_MAP.keys()),
            help="Model to export: invoices | payments | fee-structures.",
        )
        parser.add_argument(
            "--output",
            required=True,
            help="Output CSV file path.",
        )

    def handle(self, *args, **options):
        model_key = options["model"]
        output_path = options["output"]

        model = MODEL_MAP[model_key]
        fields = FIELD_MAP[model_key]

        qs = model.objects.filter(is_active=True).order_by("-created_at")

        self.stdout.write(f"Exporting {qs.count()} {model_key} to {output_path}...")

        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([f.replace("__", " ").title() for f in fields])
            for obj in qs:
                row = []
                for field in fields:
                    value = obj
                    for part in field.split("__"):
                        value = getattr(value, part, None) if value is not None else None
                        if callable(value):
                            try:
                                value = value()
                            except Exception:
                                value = ""
                    if value is None:
                        value = ""
                    row.append(str(value))
                writer.writerow(row)

        self.stdout.write(self.style.SUCCESS(f"Exported {qs.count()} rows."))
