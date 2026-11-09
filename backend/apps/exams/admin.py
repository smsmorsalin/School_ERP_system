from django.contrib import admin

from apps.exams.models import Exam, ExamResult, ExamSubject


class ExamSubjectInline(admin.TabularInline):
    model = ExamSubject
    extra = 0
    autocomplete_fields = ("section", "subject")


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ("name", "academic_year", "term", "start_date", "end_date", "is_published")
    list_filter = ("term", "is_published", "academic_year")
    search_fields = ("name",)
    inlines = [ExamSubjectInline]


@admin.register(ExamSubject)
class ExamSubjectAdmin(admin.ModelAdmin):
    list_display = ("exam", "section", "subject", "exam_date", "max_marks", "pass_marks")
    list_filter = ("exam", "section")
    search_fields = ("exam__name", "section__name", "subject__name")


@admin.register(ExamResult)
class ExamResultAdmin(admin.ModelAdmin):
    list_display = ("student", "exam_subject", "marks_obtained", "grade")
    list_filter = ("exam_subject__exam", "grade")
    search_fields = ("student__student_id", "student__user__first_name", "student__user__last_name")
    autocomplete_fields = ("student", "exam_subject")
