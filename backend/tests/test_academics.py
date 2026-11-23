"""Academics API regression tests.

Covers the class directory counts that previously crashed with a 500 because
the serializer referenced a reverse relation (``obj.students``) that does not
exist on :class:`SchoolClass`.
"""

from __future__ import annotations

import pytest

from apps.academics.models import SchoolClass
from apps.academics.serializers import SchoolClassSerializer

CLASSES = "/api/v1/academics/classes/"


@pytest.mark.django_db
def test_class_list_reports_section_and_student_counts(
    auth_client, admin_user, academic_data, students
):
    response = auth_client(admin_user).get(CLASSES)

    assert response.status_code == 200
    row = next(
        item
        for item in response.data["results"]
        if item["uuid"] == str(academic_data["grade"].uuid)
    )
    assert row["sections_count"] == 2
    assert row["students_count"] == 3


@pytest.mark.django_db
def test_class_serializer_counts_work_without_queryset_annotations(
    academic_data, students
):
    """Detail/embedded serialization must not rely on list annotations."""

    grade = SchoolClass.objects.get(pk=academic_data["grade"].pk)
    data = SchoolClassSerializer(grade).data

    assert data["sections_count"] == 2
    assert data["students_count"] == 3
