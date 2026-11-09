"""Attendance recording tests (bulk marking, scoping, validation)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from apps.attendance.models import Attendance

BULK = "/api/v1/attendance/bulk/"
SHEET = "/api/v1/attendance/sheet/"
SUMMARY = "/api/v1/attendance/summary/"
TODAY = "/api/v1/attendance/today/"


def payload(section, students, status="present", day=None):
    return {
        "section": str(section.uuid),
        "date": (day or date.today()).isoformat(),
        "records": [
            {"student": str(student.uuid), "status": status} for student in students
        ],
    }


@pytest.mark.django_db
def test_teacher_can_mark_bulk_attendance_for_their_section(
    auth_client, teacher_user, teacher_profile, academic_data, students
):
    client = auth_client(teacher_user)
    response = client.post(
        BULK,
        payload(
            academic_data["section_a"],
            [students["student1"], students["student2"]],
        ),
        format="json",
    )
    assert response.status_code == 200, response.content
    assert response.data["created"] == 2
    assert Attendance.objects.filter(date=date.today()).count() == 2


@pytest.mark.django_db
def test_bulk_attendance_updates_existing_records(
    auth_client, teacher_user, teacher_profile, academic_data, students
):
    client = auth_client(teacher_user)
    first = client.post(
        BULK,
        payload(academic_data["section_a"], [students["student1"]], "present"),
        format="json",
    )
    assert first.status_code == 200

    second = client.post(
        BULK,
        payload(academic_data["section_a"], [students["student1"]], "late"),
        format="json",
    )
    assert second.status_code == 200
    assert second.data["updated"] == 1
    assert Attendance.objects.get(student=students["student1"]).status == "late"


@pytest.mark.django_db
def test_teacher_cannot_mark_another_sections_attendance(
    auth_client, teacher_user, teacher_profile, academic_data, students
):
    response = auth_client(teacher_user).post(
        BULK,
        payload(academic_data["section_b"], [students["student3"]]),
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_student_cannot_mark_attendance(auth_client, students, academic_data):
    response = auth_client(students["user1"]).post(
        BULK,
        payload(academic_data["section_a"], [students["student1"]]),
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_future_attendance_is_rejected(
    auth_client, teacher_user, teacher_profile, academic_data, students
):
    future = date.today() + timedelta(days=1)
    response = auth_client(teacher_user).post(
        BULK,
        payload(academic_data["section_a"], [students["student1"]], day=future),
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_student_from_other_section_is_rejected(
    auth_client, teacher_user, teacher_profile, academic_data, students
):
    response = auth_client(teacher_user).post(
        BULK,
        payload(academic_data["section_a"], [students["student3"]]),
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_duplicate_students_in_bulk_request_are_rejected(
    auth_client, teacher_user, teacher_profile, academic_data, students
):
    body = payload(academic_data["section_a"], [students["student1"]])
    body["records"].append(body["records"][0])
    response = auth_client(teacher_user).post(BULK, body, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_attendance_sheet_reflects_saved_status(
    auth_client, teacher_user, teacher_profile, academic_data, students
):
    client = auth_client(teacher_user)
    client.post(
        BULK,
        payload(academic_data["section_a"], [students["student1"]], "present"),
        format="json",
    )
    response = client.get(
        SHEET,
        {
            "section": str(academic_data["section_a"].uuid),
            "date": date.today().isoformat(),
        },
    )
    assert response.status_code == 200
    rows = {row["student_uuid"]: row for row in response.data["rows"]}
    assert rows[str(students["student1"].uuid)]["status"] == "present"


@pytest.mark.django_db
def test_attendance_summary_and_today(auth_client, teacher_user, teacher_profile, academic_data, students):
    client = auth_client(teacher_user)
    client.post(
        BULK,
        payload(
            academic_data["section_a"],
            [students["student1"], students["student2"]],
            "present",
        ),
        format="json",
    )

    summary = client.get(SUMMARY, {"section": str(academic_data["section_a"].uuid)})
    assert summary.status_code == 200

    today = client.get(TODAY)
    assert today.status_code == 200


@pytest.mark.django_db
def test_parent_cannot_mark_attendance(auth_client, parent_user, guardian_link, academic_data, students):
    response = auth_client(parent_user).post(
        BULK,
        payload(academic_data["section_a"], [students["student1"]]),
        format="json",
    )
    assert response.status_code == 403
