from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class GuardianProfile(BaseModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="guardian_profile",
    )
    occupation = models.CharField(max_length=100, blank=True)
    alternate_phone = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = "guardian_profile"
        verbose_name = "Guardian Profile"
        verbose_name_plural = "Guardian Profiles"

    def __str__(self):
        return self.user.get_full_name()


class GuardianStudent(BaseModel):
    RELATION_CHOICES = [
        ("father", "Father"),
        ("mother", "Mother"),
        ("guardian", "Legal guardian"),
        ("other", "Other"),
    ]

    guardian = models.ForeignKey(
        "academics.GuardianProfile",
        on_delete=models.CASCADE,
        related_name="children_links",
    )
    student = models.ForeignKey(
        "academics.StudentProfile",
        on_delete=models.CASCADE,
        related_name="guardian_links",
    )
    relation = models.CharField(max_length=20, choices=RELATION_CHOICES, default="guardian")
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "guardian_student"
        unique_together = ("guardian", "student")
        verbose_name = "Guardian Student Link"
        verbose_name_plural = "Guardian Student Links"

    def __str__(self):
        return f"{self.guardian} -> {self.student}"
