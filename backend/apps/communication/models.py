from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel


class Announcement(BaseModel):
    AUDIENCE_CHOICES = [
        ("all", "Everyone"),
        ("teachers", "Teachers"),
        ("students", "Students"),
        ("parents", "Parents"),
        ("class", "Specific class"),
    ]

    title = models.CharField(max_length=200)
    body = models.TextField()
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default="all")
    school_class = models.ForeignKey(
        "academics.SchoolClass",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="announcements",
    )
    is_published = models.BooleanField(default=True)
    is_pinned = models.BooleanField(default=False)
    published_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="announcements",
    )

    class Meta:
        db_table = "announcement"
        ordering = ["-is_pinned", "-published_at"]
        indexes = [
            models.Index(fields=["audience", "is_published"]),
            models.Index(fields=["-published_at"]),
        ]
        verbose_name = "Announcement"
        verbose_name_plural = "Announcements"

    def __str__(self):
        return self.title


class AnnouncementRead(BaseModel):
    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, related_name="reads"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="announcement_reads"
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "announcement_read"
        unique_together = ("announcement", "user")
        verbose_name = "Announcement Read"
        verbose_name_plural = "Announcement Reads"
