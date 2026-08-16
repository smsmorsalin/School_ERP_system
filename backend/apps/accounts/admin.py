"""
Django Admin Configuration
==========================================================
Customize Django admin for accounts app models.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from apps.accounts.models import (
    User,
    Role,
    Permission,
    UserRole,
    RolePermission,
    LoginHistory,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for User model."""
    
    list_display = (
        'email',
        'get_full_name',
        'is_active',
        'is_staff',
        'created_at',
    )
    list_filter = (
        'is_active',
        'is_staff',
        'is_superuser',
        'created_at',
    )
    search_fields = (
        'email',
        'first_name',
        'last_name',
        'phone_number',
    )
    ordering = ('-created_at',)
    readonly_fields = (
        'uuid',
        'created_at',
        'updated_at',
    )
    
    fieldsets = (
        ('Personal Info', {
            'fields': (
                'uuid',
                'email',
                'first_name',
                'last_name',
                'phone_number',
                'date_of_birth',
            )
        }),
        ('Address', {
            'fields': (
                'address',
                'city',
                'state',
                'country',
                'postal_code',
            )
        }),
        ('Profile', {
            'fields': ('profile_image',)
        }),
        ('Permissions', {
            'fields': (
                'is_active',
                'is_staff',
                'is_superuser',
                'groups',
                'user_permissions',
            )
        }),
        ('Important Dates', {
            'fields': (
                'last_login',
                'created_at',
                'updated_at',
            )
        }),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    """Admin interface for Role model."""
    
    list_display = (
        'name',
        'is_system_role',
        'is_active',
        'created_at',
    )
    list_filter = (
        'is_system_role',
        'is_active',
        'created_at',
    )
    search_fields = ('name', 'description')
    readonly_fields = (
        'uuid',
        'created_at',
        'updated_at',
    )
    
    fieldsets = (
        ('Basic Info', {
            'fields': (
                'uuid',
                'name',
                'description',
            )
        }),
        ('Status', {
            'fields': (
                'is_system_role',
                'is_active',
            )
        }),
        ('Audit', {
            'fields': (
                'created_at',
                'updated_at',
            )
        }),
    )


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    """Admin interface for Permission model."""
    
    list_display = (
        'code',
        'name',
        'category',
        'is_active',
    )
    list_filter = (
        'category',
        'is_active',
        'created_at',
    )
    search_fields = (
        'code',
        'name',
        'description',
    )
    readonly_fields = (
        'uuid',
        'created_at',
        'updated_at',
    )
    
    fieldsets = (
        ('Basic Info', {
            'fields': (
                'uuid',
                'code',
                'name',
                'description',
            )
        }),
        ('Categorization', {
            'fields': ('category',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Audit', {
            'fields': (
                'created_at',
                'updated_at',
            )
        }),
    )


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    """Admin interface for UserRole model."""
    
    list_display = (
        'user',
        'role',
        'assigned_at',
        'is_active',
    )
    list_filter = (
        'role',
        'is_active',
        'assigned_at',
    )
    search_fields = (
        'user__email',
        'user__first_name',
        'user__last_name',
        'role__name',
    )
    readonly_fields = (
        'uuid',
        'assigned_at',
        'created_at',
        'updated_at',
    )
    
    fieldsets = (
        ('Assignment Info', {
            'fields': (
                'uuid',
                'user',
                'role',
                'assigned_by',
            )
        }),
        ('Timeline', {
            'fields': (
                'assigned_at',
                'created_at',
                'updated_at',
            )
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    """Admin interface for RolePermission model."""
    
    list_display = (
        'role',
        'permission',
        'is_active',
    )
    list_filter = (
        'role',
        'permission__category',
        'is_active',
    )
    search_fields = (
        'role__name',
        'permission__code',
        'permission__name',
    )
    readonly_fields = (
        'uuid',
        'created_at',
        'updated_at',
    )
    
    fieldsets = (
        ('Assignment', {
            'fields': (
                'uuid',
                'role',
                'permission',
            )
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Audit', {
            'fields': (
                'created_at',
                'updated_at',
            )
        }),
    )


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    """Admin interface for LoginHistory model."""
    
    list_display = (
        'email',
        'status',
        'ip_address',
        'login_time',
        'device_type',
    )
    list_filter = (
        'status',
        'device_type',
        'login_time',
    )
    search_fields = (
        'email',
        'ip_address',
        'user__email',
    )
    readonly_fields = (
        'uuid',
        'created_at',
        'updated_at',
    )
    
    fieldsets = (
        ('User Info', {
            'fields': (
                'user',
                'email',
            )
        }),
        ('Login Details', {
            'fields': (
                'status',
                'ip_address',
                'device_type',
                'user_agent',
            )
        }),
        ('Timeline', {
            'fields': (
                'login_time',
                'logout_time',
                'session_duration',
            )
        }),
        ('Error Info', {
            'fields': ('failure_reason',)
        }),
        ('Audit', {
            'fields': (
                'uuid',
                'created_at',
                'updated_at',
            )
        }),
    )
    
    def has_add_permission(self, request):
        """Disable manual creation of login history."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Disable deletion of login history."""
        return False
