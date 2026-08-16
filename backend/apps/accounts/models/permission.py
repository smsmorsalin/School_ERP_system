"""
Permission Model
==========================================================
Permission model for fine-grained access control.
"""

from django.db import models
from apps.core.models import BaseModel


class Permission(BaseModel):
    """
    Permission model for fine-grained access control.
    
    Permissions represent specific actions that can be performed in the system.
    Examples: view_users, create_course, edit_grades, delete_student
    """
    
    # Permission naming convention: <action>_<resource>
    # Example: view_user, create_course, edit_grade, delete_student
    
    code = models.CharField(
        max_length=200,
        unique=True,
        help_text="Permission code (e.g., view_user, create_course). Should be unique."
    )
    
    name = models.CharField(
        max_length=255,
        help_text="Human-readable permission name."
    )
    
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Detailed description of what this permission allows."
    )
    
    category = models.CharField(
        max_length=100,
        default='general',
        help_text="Permission category (e.g., user_management, academic, finance)."
    )
    
    class Meta:
        db_table = 'permission'
        verbose_name = 'Permission'
        verbose_name_plural = 'Permissions'
        ordering = ['category', 'code']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['category']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.code})"
