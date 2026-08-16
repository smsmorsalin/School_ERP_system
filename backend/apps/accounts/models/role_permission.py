"""
Role Permission Model
==========================================================
Junction table for Role-Permission relationship (Many-to-Many).
"""

from django.db import models
from apps.core.models import BaseModel
from .role import Role
from .permission import Permission


class RolePermission(BaseModel):
    """
    Junction model for Role-Permission many-to-many relationship.
    
    This model tracks which permissions are assigned to each role.
    """
    
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name='role_permissions',
        help_text="The role."
    )
    
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name='role_permissions',
        help_text="The permission."
    )
    
    class Meta:
        db_table = 'role_permission'
        unique_together = ('role', 'permission')
        verbose_name = 'Role Permission'
        verbose_name_plural = 'Role Permissions'
        ordering = ['role', 'permission']
        indexes = [
            models.Index(fields=['role', 'permission']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.role.name} - {self.permission.code}"
