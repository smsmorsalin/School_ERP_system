"""UUID-based filters for attendance and exams."""

import django_filters

from apps.attendance.models import Attendance
from apps.exams.models import Exam, ExamResult, ExamSubject


class AttendanceFilter(django_filters.FilterSet):
    section = django_filters.UUIDFilter(field_name="section__uuid")
    student = django_filters.UUIDFilter(field_name="student__uuid")
    date = django_filters.DateFilter()
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    status = django_filters.CharFilter()

    class Meta:
        model = Attendance
        fields = []


class ExamFilter(django_filters.FilterSet):
    academic_year = django_filters.UUIDFilter(field_name="academic_year__uuid")
    term = django_filters.CharFilter()
    is_published = django_filters.BooleanFilter()

    class Meta:
        model = Exam
        fields = []


class ExamSubjectFilter(django_filters.FilterSet):
    exam = django_filters.UUIDFilter(field_name="exam__uuid")
    section = django_filters.UUIDFilter(field_name="section__uuid")
    subject = django_filters.UUIDFilter(field_name="subject__uuid")

    class Meta:
        model = ExamSubject
        fields = []


class ExamResultFilter(django_filters.FilterSet):
    exam = django_filters.UUIDFilter(field_name="exam_subject__exam__uuid")
    exam_subject = django_filters.UUIDFilter(field_name="exam_subject__uuid")
    student = django_filters.UUIDFilter(field_name="student__uuid")
    section = django_filters.UUIDFilter(field_name="exam_subject__section__uuid")

    class Meta:
        model = ExamResult
        fields = []
