from django.contrib import admin

from apps.core.models import SchoolSettings


@admin.register(SchoolSettings)
class SchoolSettingsAdmin(admin.ModelAdmin):
    list_display = ("school_name", "accent", "default_theme", "compact_tables", "updated_at")
    readonly_fields = ("updated_by", "created_at", "updated_at")
    fieldsets = (
        ("Identity", {"fields": ("school_name", "short_name", "tagline")}),
        ("Contact", {"fields": ("address", "phone", "email", "website")}),
        ("Branding", {"fields": ("logo", "favicon", "accent")}),
        (
            "Sign-in screen",
            {"fields": ("login_headline", "login_subtext", "login_notice")},
        ),
        ("Console defaults", {"fields": ("default_theme", "compact_tables")}),
        ("Audit", {"fields": ("updated_by", "created_at", "updated_at")}),
    )

    def has_add_permission(self, request):
        return not SchoolSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
