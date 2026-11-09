"""Shared fixtures for the School ERP API test suite.

The tests exercise the real DRF stack (URL routing, authentication, permissions
and serializers) against a disposable SQLite test database. Only password
hashing and throttling are relaxed for speed; everything security-relevant is
left untouched.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

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
)
from apps.accounts.models import Permission, Role, User, UserRole
from apps.finance.models import FeeCategory, FeeStructure, Invoice

STRONG_PASSWORD = "TestPass@12345"


@pytest.fixture(autouse=True)
def _test_settings(settings):
    """Speed up hashing and remove throttling noise from functional tests."""
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    rates = dict(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"])
    rates.update(
        {
            "anon": "100000/min",
            "user": "1000000/hour",
            "login": "100000/min",
            "password_reset": "100000/hour",
            "sensitive": "100000/hour",
        }
    )
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": rates,
    }
    return settings


@pytest.fixture
def api():
    return APIClient()


def make_user(email, *, roles=(), password=STRONG_PASSWORD, superuser=False, **extra):
    if superuser:
        user = User.objects.create_superuser(email=email, password=password, **extra)
    else:
        user = User.objects.create_user(email=email, password=password, **extra)
    for role in roles:
        role_obj = Role.objects.get(name=role)
        UserRole.objects.create(user=user, role=role_obj)
    user.clear_role_cache()
    return user


@pytest.fixture
def roles(db):
    names = ["Admin", "Teacher", "Accountant", "Student", "Parent"]
    return {
        name: Role.objects.create(name=name, is_system_role=True, description=name)
        for name in names
    }


@pytest.fixture
def admin_user(roles):
    return make_user(
        "admin@test.example",
        roles=["Admin"],
        superuser=True,
        first_name="Ada",
        last_name="Admin",
    )


@pytest.fixture
def teacher_user(roles):
    return make_user(
        "teacher@test.example",
        roles=["Teacher"],
        first_name="Tina",
        last_name="Teacher",
    )


@pytest.fixture
def other_teacher_user(roles):
    return make_user(
        "teacher2@test.example",
        roles=["Teacher"],
        first_name="Tom",
        last_name="Other",
    )


@pytest.fixture
def accountant_user(roles):
    return make_user(
        "accountant@test.example",
        roles=["Accountant"],
        first_name="Ava",
        last_name="Accountant",
    )


@pytest.fixture
def parent_user(roles):
    return make_user(
        "parent@test.example",
        roles=["Parent"],
        first_name="Pat",
        last_name="Parent",
    )


@pytest.fixture
def academic_data(db):
    year = AcademicYear.objects.create(
        name="2026-2027",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        is_current=True,
    )
    grade = SchoolClass.objects.create(name="Grade 6", level=6)
    section_a = Section.objects.create(
        school_class=grade, name="A", academic_year=year, capacity=40
    )
    section_b = Section.objects.create(
        school_class=grade, name="B", academic_year=year, capacity=40
    )
    math = Subject.objects.create(name="Mathematics", code="MATH")
    science = Subject.objects.create(name="Science", code="SCI")
    return {
        "year": year,
        "grade": grade,
        "section_a": section_a,
        "section_b": section_b,
        "math": math,
        "science": science,
    }


@pytest.fixture
def teacher_profile(teacher_user, academic_data):
    profile = TeacherProfile.objects.create(user=teacher_user, qualification="M.Ed")
    ClassSubject.objects.create(
        section=academic_data["section_a"],
        subject=academic_data["math"],
        teacher=teacher_user,
    )
    return profile


def make_student(email, *, first_name, last_name, section, roll_number, password=STRONG_PASSWORD):
    user = make_user(
        email, roles=["Student"], password=password, first_name=first_name, last_name=last_name
    )
    profile = StudentProfile.objects.create(
        user=user,
        current_section=section,
        roll_number=roll_number,
        gender="other",
        status="active",
    )
    return user, profile


@pytest.fixture
def students(academic_data, roles):
    user1, student1 = make_student(
        "student1@test.example",
        first_name="Sam",
        last_name="One",
        section=academic_data["section_a"],
        roll_number=1,
    )
    user2, student2 = make_student(
        "student2@test.example",
        first_name="Sara",
        last_name="Two",
        section=academic_data["section_a"],
        roll_number=2,
    )
    user3, student3 = make_student(
        "student3@test.example",
        first_name="Seth",
        last_name="Three",
        section=academic_data["section_b"],
        roll_number=1,
    )
    return {
        "user1": user1,
        "student1": student1,
        "user2": user2,
        "student2": student2,
        "user3": user3,
        "student3": student3,
    }


@pytest.fixture
def guardian_link(parent_user, students):
    guardian = GuardianProfile.objects.create(user=parent_user, occupation="Engineer")
    GuardianStudent.objects.create(
        guardian=guardian, student=students["student1"], relation="father", is_primary=True
    )
    return guardian


@pytest.fixture
def finance_data(academic_data, students, admin_user):
    category = FeeCategory.objects.create(name="Tuition")
    structure = FeeStructure.objects.create(
        academic_year=academic_data["year"],
        school_class=academic_data["grade"],
        category=category,
        title="Term 1 tuition",
        amount=Decimal("500.00"),
        due_date=date(2026, 3, 1),
    )
    invoice = Invoice.objects.create(
        student=students["student1"],
        fee_structure=structure,
        title="Term 1 tuition",
        amount=Decimal("500.00"),
        due_date=date(2026, 3, 1),
        issued_by=admin_user,
    )
    return {
        "category": category,
        "structure": structure,
        "invoice": invoice,
        "student": students["student1"],
    }


@pytest.fixture
def login(api):
    def _login(email, password=STRONG_PASSWORD):
        return api.post(
            "/api/v1/accounts/auth/login/",
            {"email": email, "password": password},
            format="json",
        )

    return _login


@pytest.fixture
def auth_client():
    """Return a factory that yields an APIClient authenticated via JWT."""

    def _factory(user, password=STRONG_PASSWORD):
        client = APIClient()
        response = client.post(
            "/api/v1/accounts/auth/login/",
            {"email": user.email, "password": password},
            format="json",
        )
        assert response.status_code == 200, response.content
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return client

    return _factory


@pytest.fixture
def tomorrow():
    return date.today() + timedelta(days=1)


@pytest.fixture
def permission_catalogue(db):
    """A minimal permission catalogue used by role tests."""
    return {
        code: Permission.objects.create(code=code, name=code, category="test")
        for code in ("view_student", "mark_attendance", "view_user")
    }
