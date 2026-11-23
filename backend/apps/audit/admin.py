from django.contrib import admin

from apps.audit.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    date_hierarchy = "created_at"
    list_display = (
        "created_at",
        "actor_email",
        "action",
        "action_category",
        "target_app",
        "target_model",
        "target_uuid",
        "ip_address",
    )
    list_filter = ("action_category", "action", "created_at", "target_app")
    search_fields = ("actor_email", "action", "target_repr", "ip_address")
    readonly_fields = (
        "uuid",
        "actor",
        "actor_email",
        "action",
        "action_category",
        "target_app",
        "target_model",
        "target_uuid",
        "target_repr",
        "before",
        "after",
        "ip_address",
        "user_agent",
        "request_id",
        "metadata",
        "created_at",
        "updated_at",
        "is_active",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False
