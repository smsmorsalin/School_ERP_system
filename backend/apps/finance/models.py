from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel


class FeeCategory(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "fee_category"
        ordering = ["name"]
        verbose_name = "Fee Category"
        verbose_name_plural = "Fee Categories"

    def __str__(self):
        return self.name


class FeeStructure(BaseModel):
    academic_year = models.ForeignKey(
        "academics.AcademicYear", on_delete=models.PROTECT, related_name="fee_structures"
    )
    school_class = models.ForeignKey(
        "academics.SchoolClass", on_delete=models.PROTECT, related_name="fee_structures"
    )
    category = models.ForeignKey(
        FeeCategory, on_delete=models.PROTECT, related_name="fee_structures"
    )
    title = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    description = models.TextField(blank=True)

    class Meta:
        db_table = "fee_structure"
        ordering = ["due_date"]
        unique_together = ("academic_year", "school_class", "category", "title")
        verbose_name = "Fee Structure"
        verbose_name_plural = "Fee Structures"

    def __str__(self):
        return f"{self.title} - {self.school_class} ({self.amount})"


class Invoice(BaseModel):
    STATUS_CHOICES = [
        ("unpaid", "Unpaid"),
        ("partial", "Partially paid"),
        ("paid", "Paid"),
        ("cancelled", "Cancelled"),
    ]

    student = models.ForeignKey(
        "academics.StudentProfile", on_delete=models.PROTECT, related_name="invoices"
    )
    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )
    invoice_number = models.CharField(max_length=30, unique=True, blank=True)
    title = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="unpaid")
    notes = models.TextField(blank=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_invoices",
    )

    class Meta:
        db_table = "invoice"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["due_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "fee_structure"],
                condition=models.Q(fee_structure__isnull=False),
                name="unique_invoice_per_student_fee",
            )
        ]
        verbose_name = "Invoice"
        verbose_name_plural = "Invoices"

    def __str__(self):
        return f"{self.invoice_number} - {self.student}"

    @property
    def balance(self):
        return max(self.amount - self.amount_paid, Decimal("0.00"))

    @property
    def is_overdue(self):
        return self.status in ("unpaid", "partial") and self.due_date < timezone.localdate()

    @property
    def effective_status(self):
        return "overdue" if self.is_overdue else self.status

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            import secrets

            self.invoice_number = (
                f"INV-{timezone.now().year}-{secrets.token_hex(3).upper()}"
            )
        if self.status != "cancelled" and self.amount is not None and self.amount_paid is not None:
            if self.amount_paid <= 0:
                self.status = "unpaid"
            elif self.amount_paid < self.amount:
                self.status = "partial"
            else:
                self.status = "paid"
        super().save(*args, **kwargs)

    def recalculate(self):
        total = self.payments.filter(is_active=True).aggregate(
            total=models.Sum("amount")
        )["total"] or Decimal("0.00")
        self.amount_paid = total
        self.save(update_fields=["amount_paid", "status", "updated_at"])


class Payment(BaseModel):
    METHOD_CHOICES = [
        ("cash", "Cash"),
        ("card", "Card"),
        ("bank_transfer", "Bank transfer"),
        ("mobile_money", "Mobile money"),
        ("cheque", "Cheque"),
        ("other", "Other"),
    ]

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    receipt_number = models.CharField(max_length=40, unique=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default="cash")
    reference = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(default=timezone.now)
    notes = models.CharField(max_length=255, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_payments",
    )

    class Meta:
        db_table = "payment"
        ordering = ["-paid_at"]
        verbose_name = "Payment"
        verbose_name_plural = "Payments"

    def __str__(self):
        return f"{self.receipt_number} - {self.amount}"

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            import secrets

            self.receipt_number = (
                f"RCP-{timezone.now().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
            )
        super().save(*args, **kwargs)
        self.invoice.recalculate()

    def delete(self, *args, **kwargs):
        invoice = self.invoice
        super().delete(*args, **kwargs)
        invoice.recalculate()
