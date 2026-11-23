from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class Attendance(BaseModel):
    STATUS_CHOICES = [
        ("present", "Present"),
        ("absent", "Absent"),
        ("late", "Late"),
        ("excused", "Excused"),
    ]

    student = models.ForeignKey(
        "academics.StudentProfile",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    section = models.ForeignKey(
        "academics.Section",
        on_delete=models.PROTECT,
        related_name="attendance_records",
    )
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="present")
    remarks = models.CharField(max_length=255, blank=True)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_attendance",
    )

    class Meta:
        db_table = "attendance"
        unique_together = ("student", "date")
        ordering = ["-date", "student__student_id"]
        indexes = [
            models.Index(fields=["section", "date"]),
            models.Index(fields=["student", "date"]),
            models.Index(fields=["status"]),
        ]
        verbose_name = "Attendance"
        verbose_name_plural = "Attendance"

    def __str__(self):
        return f"{self.student} - {self.date} - {self.status}"
