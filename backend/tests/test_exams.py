"""Exam result entry, publishing and report-card tests."""

from __future__ import annotations

from datetime import date

import pytest

from apps.exams.models import Exam, ExamResult, ExamSubject

EXAMS = "/api/v1/exams/"
EXAM_SUBJECTS = "/api/v1/exam-subjects/"
EXAM_RESULTS = "/api/v1/exam-results/"
REPORT_CARD = "/api/v1/exam-results/report-card/"


@pytest.fixture
def exam_data(academic_data, teacher_profile):
    exam = Exam.objects.create(
        name="Mid Term 2026",
        academic_year=academic_data["year"],
        term="mid_term",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 10),
    )
    exam_subject = ExamSubject.objects.create(
        exam=exam,
        section=academic_data["section_a"],
        subject=academic_data["math"],
        exam_date=date(2026, 6, 2),
        max_marks=100,
        pass_marks=40,
    )
    return {"exam": exam, "exam_subject": exam_subject}


def marks_payload(students, marks=85):
    return {
        "results": [
            {"student": str(students["student1"].uuid), "marks_obtained": marks, "remarks": ""}
        ]
    }


@pytest.mark.django_db
def test_teacher_can_submit_marks_for_managed_subject(
    auth_client, teacher_user, exam_data, students
):
    client = auth_client(teacher_user)
    response = client.post(
        f"{EXAM_SUBJECTS}{exam_data['exam_subject'].uuid}/bulk-results/",
        marks_payload(students, 85),
        format="json",
    )
    assert response.status_code == 200, response.content
    assert response.data["created"] == 1

    result = ExamResult.objects.get(student=students["student1"])
    assert float(result.marks_obtained) == 85
    assert result.grade == "A"


@pytest.mark.django_db
def test_other_teacher_cannot_submit_marks(
    auth_client, other_teacher_user, exam_data, students
):
    response = auth_client(other_teacher_user).post(
        f"{EXAM_SUBJECTS}{exam_data['exam_subject'].uuid}/bulk-results/",
        marks_payload(students),
        format="json",
    )
    # The subject is filtered out of this teacher's queryset, so it is denied
    # without revealing whether the record exists.
    assert response.status_code in (403, 404)


@pytest.mark.django_db
def test_student_cannot_submit_marks(auth_client, students, exam_data):
    response = auth_client(students["user1"]).post(
        f"{EXAM_SUBJECTS}{exam_data['exam_subject'].uuid}/bulk-results/",
        marks_payload(students),
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_marks_above_maximum_are_rejected(
    auth_client, teacher_user, exam_data, students
):
    response = auth_client(teacher_user).post(
        f"{EXAM_SUBJECTS}{exam_data['exam_subject'].uuid}/bulk-results/",
        marks_payload(students, 150),
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_marks_for_student_in_other_section_are_rejected(
    auth_client, teacher_user, exam_data, students
):
    payload = {
        "results": [
            {"student": str(students["student3"].uuid), "marks_obtained": 70}
        ]
    }
    response = auth_client(teacher_user).post(
        f"{EXAM_SUBJECTS}{exam_data['exam_subject'].uuid}/bulk-results/",
        payload,
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_published_exam_is_read_only(auth_client, admin_user, teacher_user, exam_data, students):
    teacher = auth_client(teacher_user)
    teacher.post(
        f"{EXAM_SUBJECTS}{exam_data['exam_subject'].uuid}/bulk-results/",
        marks_payload(students),
        format="json",
    )

    published = auth_client(admin_user).post(
        f"{EXAMS}{exam_data['exam'].uuid}/publish/",
        {"published": True},
        format="json",
    )
    assert published.status_code == 200, published.content

    blocked = teacher.post(
        f"{EXAM_SUBJECTS}{exam_data['exam_subject'].uuid}/bulk-results/",
        marks_payload(students, 90),
        format="json",
    )
    assert blocked.status_code == 400


@pytest.mark.django_db
def test_results_hidden_until_published(auth_client, admin_user, students, exam_data):
    ExamResult.objects.create(
        exam_subject=exam_data["exam_subject"],
        student=students["student1"],
        marks_obtained=80,
    )
    student_client = auth_client(students["user1"])

    assert student_client.get(EXAM_RESULTS).data["count"] == 0
    report = student_client.get(
        REPORT_CARD, {"student": str(students["student1"].uuid)}
    )
    assert report.status_code == 403

    auth_client(admin_user).post(
        f"{EXAMS}{exam_data['exam'].uuid}/publish/", {"published": True}, format="json"
    )

    assert student_client.get(EXAM_RESULTS).data["count"] == 1
    report = student_client.get(
        REPORT_CARD, {"student": str(students["student1"].uuid)}
    )
    assert report.status_code == 200
    assert report.data["totals"]["obtained"] == 80
    assert report.data["totals"]["position"] == 1


@pytest.mark.django_db
def test_parent_can_only_view_linked_child_report_card(
    auth_client, admin_user, parent_user, guardian_link, students, exam_data
):
    ExamResult.objects.create(
        exam_subject=exam_data["exam_subject"],
        student=students["student1"],
        marks_obtained=75,
    )
    exam_data["exam"].is_published = True
    exam_data["exam"].save(update_fields=["is_published"])

    client = auth_client(parent_user)
    own = client.get(REPORT_CARD, {"student": str(students["student1"].uuid)})
    assert own.status_code == 200

    other = client.get(REPORT_CARD, {"student": str(students["student2"].uuid)})
    assert other.status_code == 403


@pytest.mark.django_db
def test_only_staff_can_view_exam_analytics(auth_client, teacher_user, students, exam_data):
    assert (
        auth_client(teacher_user).get(
            f"{EXAMS}analytics/", {"exam": str(exam_data["exam"].uuid)}
        ).status_code
        == 200
    )
    assert (
        auth_client(students["user1"]).get(
            f"{EXAMS}analytics/", {"exam": str(exam_data["exam"].uuid)}
        ).status_code
        == 403
    )
