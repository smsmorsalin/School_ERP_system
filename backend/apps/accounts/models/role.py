"""
Role Model
==========================================================
Role model for RBAC (Role-Based Access Control).
"""

from django.db import models
from apps.core.models import BaseModel


class Role(BaseModel):
    """
    Role model for role-based access control.
    
    Roles are collections of permissions that can be assigned to users.
    Examples: Admin, Teacher, Student, Parent, Accountant
    """
    
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Role name (e.g., Admin, Teacher, Student)."
    )
    
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of the role and its responsibilities."
    )
    
    is_system_role = models.BooleanField(
        default=False,
        help_text="System roles cannot be deleted. True for built-in roles."
    )
    
    class Meta:
        db_table = 'role'
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return self.name
