"""Login history / audit trail."""

from django.db import models

from apps.core.models import BaseModel


class LoginHistory(BaseModel):
    LOGIN_STATUS_CHOICES = [
        ("success", "Successful Login"),
        ("failed", "Failed Login Attempt"),
        ("logout", "Logout"),
        ("timeout", "Session Timeout"),
    ]

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="login_histories",
        null=True,
        blank=True,
    )
    email = models.EmailField()
    status = models.CharField(max_length=20, choices=LOGIN_STATUS_CHOICES, default="success")
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True, null=True)
    device_type = models.CharField(max_length=50, blank=True, null=True)
    login_time = models.DateTimeField(auto_now_add=True)
    logout_time = models.DateTimeField(blank=True, null=True)
    failure_reason = models.CharField(max_length=255, blank=True, null=True)
    session_duration = models.DurationField(blank=True, null=True)

    class Meta:
        db_table = "login_history"
        verbose_name = "Login History"
        verbose_name_plural = "Login Histories"
        ordering = ["-login_time"]
        indexes = [
            models.Index(fields=["user", "-login_time"]),
            models.Index(fields=["email", "-login_time"]),
            models.Index(fields=["ip_address"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.email} - {self.status} - {self.login_time}"

    def save(self, *args, **kwargs):
        if self.logout_time and self.login_time:
            self.session_duration = self.logout_time - self.login_time
        super().save(*args, **kwargs)

    @staticmethod
    def device_from_user_agent(user_agent: str) -> str:
        ua = (user_agent or "").lower()
        if "ipad" in ua or "tablet" in ua:
            return "Tablet"
        if any(token in ua for token in ("mobi", "android", "iphone")):
            return "Mobile"
        if not ua:
            return "Unknown"
        return "Desktop"
