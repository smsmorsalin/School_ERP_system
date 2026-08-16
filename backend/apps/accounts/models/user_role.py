"""
User Role Model
==========================================================
Junction table for User-Role relationship (Many-to-Many).
"""

from django.db import models
from apps.core.models import BaseModel
from .user import User
from .role import Role


class UserRole(BaseModel):
    """
    Junction model for User-Role many-to-many relationship.
    
    This model tracks which roles are assigned to each user.
    A user can have multiple roles (e.g., Teacher + Examiner).
    """
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='user_roles',
        help_text="The user."
    )
    
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name='user_roles',
        help_text="The role."
    )
    
    assigned_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Date and time when the role was assigned."
    )
    
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_roles',
        help_text="The admin who assigned this role."
    )
    
    class Meta:
        db_table = 'user_role'
        unique_together = ('user', 'role')
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'
        ordering = ['user', 'role']
        indexes = [
            models.Index(fields=['user', 'role']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.role.name}"
