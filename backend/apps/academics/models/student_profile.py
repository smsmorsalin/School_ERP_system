from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class StudentProfile(BaseModel):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("graduated", "Graduated"),
        ("transferred", "Transferred"),
        ("suspended", "Suspended"),
    ]
    GENDER_CHOICES = [("male", "Male"), ("female", "Female"), ("other", "Other")]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
    )
    student_id = models.CharField(max_length=30, unique=True, blank=True)
    admission_date = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    blood_group = models.CharField(max_length=5, blank=True)
    current_section = models.ForeignKey(
        "academics.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    roll_number = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    class Meta:
        db_table = "student_profile"
        ordering = ["student_id"]
        verbose_name = "Student Profile"
        verbose_name_plural = "Student Profiles"
        indexes = [
            models.Index(fields=["student_id"]),
            models.Index(fields=["current_section"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["current_section", "roll_number"],
                condition=models.Q(roll_number__isnull=False),
                name="unique_roll_per_section",
            )
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.student_id})"

    def save(self, *args, **kwargs):
        if not self.student_id:
            from django.utils import timezone

            year = self.admission_date.year if self.admission_date else timezone.now().year
            last = (
                StudentProfile.objects.filter(student_id__startswith=f"STU-{year}-")
                .order_by("-pk")
                .values_list("student_id", flat=True)
                .first()
            )
            number = 1
            if last:
                try:
                    number = int(last.split("-")[-1]) + 1
                except ValueError:
                    number = StudentProfile.objects.count() + 1
            self.student_id = f"STU-{year}-{number:04d}"
        super().save(*args, **kwargs)
