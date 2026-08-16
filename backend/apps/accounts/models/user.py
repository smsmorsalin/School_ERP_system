"""
User Model
==========================================================
Custom user model for the School ERP.
"""

from django.db import models
from django.contrib.auth.models import AbstractUser
from apps.core.models import BaseModel


class User(AbstractUser, BaseModel):
    """
    Custom User model for the School ERP.
    
    Extends Django's AbstractUser with additional fields and inherits
    from BaseModel for UUID, soft deletes, and audit fields.
    """
    
    # Remove default username field and use email instead
    username = models.CharField(
        max_length=150,
        unique=False,
        blank=True,
        null=True,
        help_text="Optional username."
    )
    
    email = models.EmailField(
        unique=True,
        help_text="Email address (must be unique)."
    )
    
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Contact phone number."
    )
    
    profile_image = models.ImageField(
        upload_to='profile_images/',
        blank=True,
        null=True,
        help_text="User profile image."
    )
    
    date_of_birth = models.DateField(
        blank=True,
        null=True,
        help_text="User date of birth."
    )
    
    address = models.TextField(
        blank=True,
        null=True,
        help_text="User address."
    )
    
    city = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="City name."
    )
    
    state = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="State/Province name."
    )
    
    country = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Country name."
    )
    
    postal_code = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Postal/ZIP code."
    )
    
    # Override the USERNAME_FIELD to use email
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    class Meta:
        db_table = 'user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['is_active']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"
    
    def get_full_name(self):
        """Return the user's full name."""
        return f"{self.first_name} {self.last_name}".strip() or self.email
