from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class Exam(BaseModel):
    TERM_CHOICES = [
        ("first_term", "First Term"),
        ("mid_term", "Mid Term"),
        ("final_term", "Final Term"),
        ("annual", "Annual"),
        ("monthly", "Monthly Test"),
    ]

    name = models.CharField(max_length=150)
    academic_year = models.ForeignKey(
        "academics.AcademicYear", on_delete=models.PROTECT, related_name="exams"
    )
    term = models.CharField(max_length=20, choices=TERM_CHOICES, default="mid_term")
    start_date = models.DateField()
    end_date = models.DateField()
    description = models.TextField(blank=True)
    is_published = models.BooleanField(
        default=False, help_text="Published results are visible to students and parents."
    )
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_exams",
    )

    class Meta:
        db_table = "exam"
        ordering = ["-start_date"]
        verbose_name = "Exam"
        verbose_name_plural = "Exams"

    def __str__(self):
        return self.name

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "End date cannot be before the start date."})


class ExamSubject(BaseModel):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="exam_subjects")
    section = models.ForeignKey(
        "academics.Section", on_delete=models.CASCADE, related_name="exam_subjects"
    )
    subject = models.ForeignKey(
        "academics.Subject", on_delete=models.PROTECT, related_name="exam_subjects"
    )
    exam_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    max_marks = models.DecimalField(max_digits=6, decimal_places=2, default=100)
    pass_marks = models.DecimalField(max_digits=6, decimal_places=2, default=40)

    class Meta:
        db_table = "exam_subject"
        unique_together = ("exam", "section", "subject")
        ordering = ["exam", "section", "subject__name"]
        verbose_name = "Exam Subject"
        verbose_name_plural = "Exam Subjects"

    def __str__(self):
        return f"{self.exam.name} - {self.section} - {self.subject.name}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.max_marks is not None and self.max_marks <= 0:
            raise ValidationError({"max_marks": "Maximum marks must be greater than zero."})
        if (
            self.pass_marks is not None
            and self.max_marks is not None
            and self.pass_marks > self.max_marks
        ):
            raise ValidationError({"pass_marks": "Pass marks cannot exceed maximum marks."})


class ExamResult(BaseModel):
    exam_subject = models.ForeignKey(
        ExamSubject, on_delete=models.CASCADE, related_name="results"
    )
    student = models.ForeignKey(
        "academics.StudentProfile", on_delete=models.CASCADE, related_name="exam_results"
    )
    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2)
    grade = models.CharField(max_length=3, blank=True)
    remarks = models.CharField(max_length=255, blank=True)
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entered_results",
    )

    class Meta:
        db_table = "exam_result"
        unique_together = ("exam_subject", "student")
        ordering = ["exam_subject", "student__student_id"]
        indexes = [
            models.Index(fields=["student", "exam_subject"]),
        ]
        verbose_name = "Exam Result"
        verbose_name_plural = "Exam Results"

    def __str__(self):
        return f"{self.student} - {self.exam_subject} - {self.marks_obtained}"

    @property
    def percentage(self):
        if not self.exam_subject.max_marks:
            return 0
        return round(float(self.marks_obtained) * 100 / float(self.exam_subject.max_marks), 2)

    def save(self, *args, **kwargs):
        from apps.exams.utils import grade_for_percentage

        self.grade = grade_for_percentage(self.percentage)
        super().save(*args, **kwargs)
