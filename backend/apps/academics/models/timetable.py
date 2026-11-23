from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class TimetableEntry(BaseModel):
    DAY_CHOICES = [
        (0, "Monday"),
        (1, "Tuesday"),
        (2, "Wednesday"),
        (3, "Thursday"),
        (4, "Friday"),
        (5, "Saturday"),
        (6, "Sunday"),
    ]

    section = models.ForeignKey(
        "academics.Section", on_delete=models.CASCADE, related_name="timetable"
    )
    subject = models.ForeignKey(
        "academics.Subject", on_delete=models.CASCADE, related_name="timetable_entries"
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timetable_entries",
    )
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "timetable_entry"
        ordering = ["day_of_week", "start_time"]
        unique_together = ("section", "day_of_week", "start_time")
        verbose_name = "Timetable Entry"
        verbose_name_plural = "Timetable Entries"

    def __str__(self):
        return f"{self.section} {self.get_day_of_week_display()} {self.start_time}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValidationError({"end_time": "End time must be after start time."})
