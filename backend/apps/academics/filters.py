"""Django-filter filtersets use UUIDs in query params, never internal PKs."""

import django_filters

from apps.academics.models import Section, StudentProfile, ClassSubject, TimetableEntry


class SectionFilter(django_filters.FilterSet):
    school_class = django_filters.UUIDFilter(field_name="school_class__uuid")
    academic_year = django_filters.UUIDFilter(field_name="academic_year__uuid")
    class_teacher = django_filters.UUIDFilter(field_name="class_teacher__uuid")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Section
        fields = []


class StudentFilter(django_filters.FilterSet):
    section = django_filters.UUIDFilter(field_name="current_section__uuid")
    school_class = django_filters.UUIDFilter(field_name="current_section__school_class__uuid")
    status = django_filters.CharFilter()
    gender = django_filters.CharFilter()
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = StudentProfile
        fields = []


class ClassSubjectFilter(django_filters.FilterSet):
    section = django_filters.UUIDFilter(field_name="section__uuid")
    subject = django_filters.UUIDFilter(field_name="subject__uuid")
    teacher = django_filters.UUIDFilter(field_name="teacher__uuid")
    school_class = django_filters.UUIDFilter(field_name="section__school_class__uuid")

    class Meta:
        model = ClassSubject
        fields = []


class TimetableFilter(django_filters.FilterSet):
    section = django_filters.UUIDFilter(field_name="section__uuid")
    teacher = django_filters.UUIDFilter(field_name="teacher__uuid")
    day_of_week = django_filters.NumberFilter()

    class Meta:
        model = TimetableEntry
        fields = []
