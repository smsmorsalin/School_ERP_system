from django.contrib import admin

from apps.finance.models import FeeCategory, FeeStructure, Invoice, Payment


@admin.register(FeeCategory)
class FeeCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active")
    search_fields = ("name",)


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ("title", "school_class", "category", "amount", "due_date")
    list_filter = ("academic_year", "school_class", "category")
    search_fields = ("title", "category__name", "school_class__name")


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ("receipt_number", "received_by", "created_at")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "student", "title", "amount", "amount_paid", "status", "due_date")
    list_filter = ("status", "due_date")
    search_fields = ("invoice_number", "student__student_id", "student__user__email", "title")
    readonly_fields = ("invoice_number", "amount_paid", "status")
    autocomplete_fields = ("student", "fee_structure")
    inlines = [PaymentInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "invoice", "amount", "method", "paid_at")
    list_filter = ("method", "paid_at")
    search_fields = ("receipt_number", "reference", "invoice__invoice_number")
    readonly_fields = ("receipt_number", "received_by")
    autocomplete_fields = ("invoice",)
