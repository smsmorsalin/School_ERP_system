"""
Login History Model
==========================================================
Tracks user login attempts and activities.
"""

from django.db import models
from django.utils import timezone
from apps.core.models import BaseModel
from .user import User


class LoginHistory(BaseModel):
    """
    Login history model to track user authentication attempts.
    
    This helps with:
    - Security auditing
    - Detecting unauthorized access attempts
    - User behavior analysis
    """
    
    # Login status choices
    LOGIN_STATUS_CHOICES = [
        ('success', 'Successful Login'),
        ('failed', 'Failed Login Attempt'),
        ('logout', 'Logout'),
        ('timeout', 'Session Timeout'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='login_histories',
        null=True,
        blank=True,
        help_text="The user (null for failed login attempts)."
    )
    
    email = models.EmailField(
        help_text="Email used for login attempt."
    )
    
    status = models.CharField(
        max_length=20,
        choices=LOGIN_STATUS_CHOICES,
        default='success',
        help_text="Login status."
    )
    
    ip_address = models.GenericIPAddressField(
        help_text="IP address of the login attempt."
    )
    
    user_agent = models.TextField(
        blank=True,
        null=True,
        help_text="User agent string from the browser."
    )
    
    device_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Device type (e.g., Mobile, Desktop, Tablet)."
    )
    
    login_time = models.DateTimeField(
        auto_now_add=True,
        help_text="Time of login attempt."
    )
    
    logout_time = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Time of logout."
    )
    
    failure_reason = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Reason for failed login attempt."
    )
    
    session_duration = models.DurationField(
        blank=True,
        null=True,
        help_text="Duration of the user session."
    )
    
    class Meta:
        db_table = 'login_history'
        verbose_name = 'Login History'
        verbose_name_plural = 'Login Histories'
        ordering = ['-login_time']
        indexes = [
            models.Index(fields=['user', '-login_time']),
            models.Index(fields=['email', '-login_time']),
            models.Index(fields=['ip_address']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.email} - {self.status} - {self.login_time}"
    
    def save(self, *args, **kwargs):
        """Calculate session duration before saving."""
        if self.logout_time and self.login_time:
            self.session_duration = self.logout_time - self.login_time
        super().save(*args, **kwargs)
