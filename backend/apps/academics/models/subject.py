from django.db import models

from apps.core.models import BaseModel


class Subject(BaseModel):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    credits = models.PositiveSmallIntegerField(default=1)

    class Meta:
        db_table = "subject"
        ordering = ["name"]
        verbose_name = "Subject"
        verbose_name_plural = "Subjects"

    def __str__(self):
        return f"{self.name} ({self.code})"
