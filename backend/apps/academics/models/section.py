from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class Section(BaseModel):
    school_class = models.ForeignKey(
        "academics.SchoolClass",
        on_delete=models.PROTECT,
        related_name="sections",
    )
    name = models.CharField(max_length=20, default="A", help_text="e.g. A, B, Blue")
    academic_year = models.ForeignKey(
        "academics.AcademicYear",
        on_delete=models.PROTECT,
        related_name="sections",
        null=True,
        blank=True,
    )
    class_teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_sections",
    )
    room = models.CharField(max_length=50, blank=True)
    capacity = models.PositiveSmallIntegerField(default=40)

    class Meta:
        db_table = "section"
        unique_together = ("school_class", "name")
        ordering = ["school_class__level", "name"]
        verbose_name = "Section"
        verbose_name_plural = "Sections"

    def __str__(self):
        return f"{self.school_class.name} - {self.name}"
