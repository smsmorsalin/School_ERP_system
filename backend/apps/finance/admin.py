from django.contrib import admin

from apps.finance.models import (
    FeeCategory,
    FeeStructure,
    Invoice,
    Payment,
    PaymentIntent,
    PaymentWebhookEvent,
)


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


class PaymentIntentInline(admin.TabularInline):
    model = PaymentIntent
    extra = 0
    fields = ("intent_number", "gateway", "amount", "status", "created_at")
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "student", "title", "amount", "amount_paid", "status", "due_date")
    list_filter = ("status", "due_date")
    search_fields = ("invoice_number", "student__student_id", "student__user__email", "title")
    readonly_fields = ("invoice_number", "amount_paid", "status")
    autocomplete_fields = ("student", "fee_structure")
    inlines = [PaymentInline, PaymentIntentInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "invoice", "amount", "method", "paid_at")
    list_filter = ("method", "paid_at")
    search_fields = ("receipt_number", "reference", "invoice__invoice_number")
    readonly_fields = ("receipt_number", "received_by")
    autocomplete_fields = ("invoice",)


@admin.register(PaymentIntent)
class PaymentIntentAdmin(admin.ModelAdmin):
    list_display = (
        "intent_number", "invoice", "gateway", "amount", "currency",
        "status", "expires_at", "created_at",
    )
    list_filter = ("status", "gateway", "currency")
    search_fields = (
        "intent_number", "invoice__invoice_number", "provider_reference",
        "created_by__email",
    )
    readonly_fields = (
        "uuid", "intent_number", "invoice", "created_by", "gateway", "amount",
        "currency", "status", "idempotency_key", "provider_reference",
        "payer_reference", "expires_at", "completed_at", "failure_reason",
        "settled_payment", "metadata", "created_at", "updated_at",
    )
    autocomplete_fields = ("invoice",)
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PaymentWebhookEvent)
class PaymentWebhookEventAdmin(admin.ModelAdmin):
    list_display = (
        "event_id", "gateway", "event_type", "status", "signature_valid",
        "processed_at", "created_at",
    )
    list_filter = ("gateway", "status", "signature_valid")
    search_fields = ("event_id", "intent__intent_number", "error")
    readonly_fields = (
        "uuid", "gateway", "event_id", "event_type", "intent", "status",
        "payload", "payload_hash", "signature_valid", "source_ip", "error",
        "processed_at", "created_at", "updated_at",
    )
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
