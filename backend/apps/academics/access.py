"""Role-aware querysets.

Every list endpoint funnels through these helpers so a user can never read
another family's records by guessing a UUID (IDOR protection).
"""

from django.db.models import Q

from apps.academics.models import StudentProfile, TeacherProfile
from apps.core.permissions import is_admin


def teacher_sections(user):
    from apps.academics.models import Section

    return Section.objects.filter(
        Q(class_teacher=user) | Q(class_subjects__teacher=user)
    ).distinct()


def teacher_section_ids(user):
    return teacher_sections(user).values_list("id", flat=True)


def children_of(user):
    return StudentProfile.objects.filter(
        guardian_links__guardian__user=user,
        guardian_links__is_active=True,
        guardian_links__guardian__is_active=True,
    ).distinct()


def student_profile_of(user):
    return StudentProfile.objects.filter(user=user).first()


def accessible_students(user):
    """Return a queryset of students the user may read.

    Administrators and accountants see everyone. Teachers see students in
    their sections. Students see themselves. Parents see their children.
    """
    if is_admin(user) or "Accountant" in getattr(user, "role_names", []):
        return StudentProfile.objects.all()
    if "Teacher" in getattr(user, "role_names", []):
        return StudentProfile.objects.filter(
            current_section_id__in=teacher_section_ids(user)
        )
    if "Student" in getattr(user, "role_names", []):
        return StudentProfile.objects.filter(user=user)
    if "Parent" in getattr(user, "role_names", []):
        return children_of(user)
    return StudentProfile.objects.none()


def can_access_student(user, student: StudentProfile) -> bool:
    if is_admin(user):
        return True
    if "Accountant" in getattr(user, "role_names", []):
        return True
    if "Teacher" in getattr(user, "role_names", []):
        return (
            student.current_section_id
            and student.current_section_id in set(teacher_section_ids(user))
        )
    if "Student" in getattr(user, "role_names", []):
        return student.user_id == user.id
    if "Parent" in getattr(user, "role_names", []):
        return children_of(user).filter(pk=student.pk).exists()
    return False


def accessible_sections(user):
    from apps.academics.models import Section

    if is_admin(user) or "Accountant" in getattr(user, "role_names", []):
        return Section.objects.all()
    if "Teacher" in getattr(user, "role_names", []):
        return teacher_sections(user)
    if "Student" in getattr(user, "role_names", []):
        profile = student_profile_of(user)
        return Section.objects.filter(pk=profile.current_section_id) if profile and profile.current_section_id else Section.objects.none()
    if "Parent" in getattr(user, "role_names", []):
        section_ids = children_of(user).exclude(current_section__isnull=True).values_list(
            "current_section_id", flat=True
        )
        return Section.objects.filter(pk__in=section_ids)
    return Section.objects.none()


def accessible_teacher_profiles(user):
    """Teacher directory is private: self for teachers, all for admins."""
    qs = TeacherProfile.objects.select_related("user")
    if is_admin(user):
        return qs
    return qs.filter(user=user)
