from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class ClassSubject(BaseModel):
    """A subject taught to a specific section by a specific teacher."""

    section = models.ForeignKey(
        "academics.Section", on_delete=models.CASCADE, related_name="class_subjects"
    )
    subject = models.ForeignKey(
        "academics.Subject", on_delete=models.PROTECT, related_name="class_subjects"
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="teaching_assignments",
    )

    class Meta:
        db_table = "class_subject"
        unique_together = ("section", "subject")
        ordering = ["section", "subject__name"]
        verbose_name = "Class Subject"
        verbose_name_plural = "Class Subjects"

    def __str__(self):
        return f"{self.section} - {self.subject.name}"
