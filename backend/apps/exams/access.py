"""Exam access helpers (avoid leaking other classes' results)."""

from django.db.models import Exists, OuterRef, Q

from apps.academics.access import children_of, student_profile_of, teacher_sections
from apps.academics.models import ClassSubject
from apps.core.permissions import is_admin


def teacher_managed_exam_subjects(user):
    from apps.exams.models import ExamSubject

    assignment = ClassSubject.objects.filter(
        section=OuterRef("section"), subject=OuterRef("subject"), teacher=user, is_active=True
    )
    return ExamSubject.objects.annotate(_can_manage=Exists(assignment)).filter(
        Q(_can_manage=True) | Q(section__class_teacher=user)
    )


def teacher_can_manage(user, exam_subject) -> bool:
    if is_admin(user):
        return True
    if "Teacher" not in getattr(user, "role_names", []):
        return False
    if exam_subject.section.class_teacher_id == user.id:
        return True
    return ClassSubject.objects.filter(
        section=exam_subject.section,
        subject=exam_subject.subject,
        teacher=user,
        is_active=True,
    ).exists()


def visible_sections_for_exams(user):
    if is_admin(user):
        return None
    if "Teacher" in getattr(user, "role_names", []):
        return teacher_sections(user).values("pk")
    if "Student" in getattr(user, "role_names", []):
        profile = student_profile_of(user)
        if profile and profile.current_section_id:
            return [profile.current_section_id]
        return []
    if "Parent" in getattr(user, "role_names", []):
        return children_of(user).exclude(current_section__isnull=True).values_list(
            "current_section_id", flat=True
        )
    return []
