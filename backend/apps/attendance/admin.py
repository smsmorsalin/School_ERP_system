from django.contrib import admin

from apps.attendance.models import Attendance


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("student", "section", "date", "status", "marked_by")
    list_filter = ("status", "date", "section")
    search_fields = ("student__student_id", "student__user__email", "student__user__first_name")
    date_hierarchy = "date"
    autocomplete_fields = ("student", "marked_by")
