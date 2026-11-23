from django.db import models

from apps.core.models import BaseModel


class SchoolClass(BaseModel):
    name = models.CharField(max_length=100, unique=True, help_text="e.g. Class 1")
    level = models.PositiveSmallIntegerField(unique=True, help_text="Ordering level, e.g. 1")
    description = models.TextField(blank=True)

    class Meta:
        db_table = "school_class"
        ordering = ["level"]
        verbose_name = "Class"
        verbose_name_plural = "Classes"

    def __str__(self):
        return self.name
