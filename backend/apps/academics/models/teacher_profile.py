from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class TeacherProfile(BaseModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="teacher_profile",
    )
    employee_id = models.CharField(max_length=30, unique=True, blank=True)
    qualification = models.CharField(max_length=150, blank=True)
    specialization = models.CharField(max_length=150, blank=True)
    joining_date = models.DateField(null=True, blank=True)
    employment_type = models.CharField(
        max_length=20,
        choices=[("full_time", "Full time"), ("part_time", "Part time"), ("contract", "Contract")],
        default="full_time",
    )

    class Meta:
        db_table = "teacher_profile"
        ordering = ["employee_id"]
        verbose_name = "Teacher Profile"
        verbose_name_plural = "Teacher Profiles"

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.employee_id})"

    def save(self, *args, **kwargs):
        if not self.employee_id:
            last = (
                TeacherProfile.objects.exclude(employee_id="")
                .order_by("-pk")
                .values_list("employee_id", flat=True)
                .first()
            )
            number = 1
            if last and last.startswith("EMP-"):
                try:
                    number = int(last.split("-")[-1]) + 1
                except ValueError:
                    number = TeacherProfile.objects.count() + 1
            self.employee_id = f"EMP-{number:04d}"
        super().save(*args, **kwargs)
