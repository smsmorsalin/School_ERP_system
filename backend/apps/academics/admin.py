from django.contrib import admin

from apps.academics.models import (
    AcademicYear,
    ClassSubject,
    GuardianProfile,
    GuardianStudent,
    SchoolClass,
    Section,
    StudentProfile,
    Subject,
    TeacherProfile,
    TimetableEntry,
)


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "is_current")
    list_filter = ("is_current",)
    search_fields = ("name",)


@admin.register(SchoolClass)
class SchoolClassAdmin(admin.ModelAdmin):
    list_display = ("name", "level", "is_active")
    search_fields = ("name",)
    ordering = ("level",)


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("__str__", "class_teacher", "room", "capacity", "is_active")
    list_filter = ("school_class", "academic_year", "is_active")
    search_fields = ("name", "school_class__name", "room")
    autocomplete_fields = ("class_teacher",)


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "credits", "is_active")
    search_fields = ("name", "code")


@admin.register(ClassSubject)
class ClassSubjectAdmin(admin.ModelAdmin):
    list_display = ("section", "subject", "teacher", "is_active")
    list_filter = ("section", "subject")
    search_fields = ("section__name", "subject__name", "teacher__email")
    autocomplete_fields = ("teacher",)


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ("employee_id", "user", "specialization", "employment_type")
    search_fields = ("employee_id", "user__email", "user__first_name", "user__last_name")
    autocomplete_fields = ("user",)


class GuardianInline(admin.TabularInline):
    model = GuardianStudent
    extra = 1
    autocomplete_fields = ("guardian",)


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ("student_id", "user", "current_section", "roll_number", "status")
    list_filter = ("status", "current_section__school_class", "current_section")
    search_fields = ("student_id", "user__email", "user__first_name", "user__last_name")
    autocomplete_fields = ("user",)
    inlines = [GuardianInline]


@admin.register(GuardianProfile)
class GuardianProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "occupation")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    autocomplete_fields = ("user",)


@admin.register(GuardianStudent)
class GuardianStudentAdmin(admin.ModelAdmin):
    list_display = ("guardian", "student", "relation", "is_primary", "is_active")
    list_filter = ("relation", "is_primary", "is_active")
    search_fields = ("guardian__user__email", "student__user__email")
    autocomplete_fields = ("guardian", "student")


@admin.register(TimetableEntry)
class TimetableEntryAdmin(admin.ModelAdmin):
    list_display = ("section", "day_of_week", "start_time", "end_time", "subject", "teacher")
    list_filter = ("day_of_week", "section")
    autocomplete_fields = ("teacher",)
