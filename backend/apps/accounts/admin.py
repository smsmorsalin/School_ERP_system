"""Django admin configuration for accounts."""

from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.core.exceptions import ValidationError

from apps.accounts.models import (
    LoginHistory,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
)


class UserCreationForm(forms.ModelForm):
    password1 = forms.CharField(label="Password", widget=forms.PasswordInput)
    password2 = forms.CharField(label="Confirm password", widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ("email", "first_name", "last_name", "phone_number")

    def clean_password2(self):
        if self.cleaned_data.get("password1") != self.cleaned_data.get("password2"):
            raise ValidationError("Passwords do not match.")
        return self.cleaned_data.get("password2")

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user


class UserChangeForm(forms.ModelForm):
    password = ReadOnlyPasswordHashField(
        help_text="Raw passwords are not visible. Use the password reset flow instead."
    )

    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    list_display = ("email", "get_full_name", "is_active", "is_staff", "created_at")
    list_filter = ("is_active", "is_staff", "is_superuser", "created_at")
    search_fields = ("email", "first_name", "last_name", "phone_number")
    ordering = ("-created_at",)
    readonly_fields = ("uuid", "created_at", "updated_at", "last_login", "failed_login_attempts", "locked_until")
    filter_horizontal = ("groups", "user_permissions")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {
            "fields": (
                "uuid", "first_name", "last_name", "phone_number",
                "date_of_birth", "profile_image",
            )
        }),
        ("Address", {"fields": ("address", "city", "state", "country", "postal_code")}),
        ("Permissions", {
            "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")
        }),
        ("Security", {"fields": ("failed_login_attempts", "locked_until", "must_change_password")}),
        ("Important dates", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "first_name", "last_name", "password1", "password2"),
        }),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "is_system_role", "is_active", "created_at")
    list_filter = ("is_system_role", "is_active")
    search_fields = ("name", "description")
    readonly_fields = ("uuid", "created_at", "updated_at")


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("code", "name", "description")
    readonly_fields = ("uuid", "created_at", "updated_at")


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "assigned_at", "is_active")
    list_filter = ("role", "is_active", "assigned_at")
    search_fields = ("user__email", "user__first_name", "user__last_name", "role__name")
    readonly_fields = ("uuid", "assigned_at", "created_at", "updated_at")
    autocomplete_fields = ("user", "role")


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "permission", "is_active")
    list_filter = ("role", "permission__category", "is_active")
    search_fields = ("role__name", "permission__code", "permission__name")
    readonly_fields = ("uuid", "created_at", "updated_at")


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = ("email", "status", "ip_address", "login_time", "device_type")
    list_filter = ("status", "device_type", "login_time")
    search_fields = ("email", "ip_address", "user__email")
    readonly_fields = (
        "uuid", "user", "email", "status", "ip_address", "device_type",
        "user_agent", "login_time", "logout_time", "session_duration",
        "failure_reason", "created_at", "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
