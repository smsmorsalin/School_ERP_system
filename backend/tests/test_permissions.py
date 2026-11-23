"""Role-based access control and IDOR-protection tests."""

from __future__ import annotations

import pytest

from apps.accounts.models import Role, User

USERS = "/api/v1/accounts/users/"
STUDENTS = "/api/v1/academics/students/"
TEACHERS = "/api/v1/academics/teachers/"
INVOICES = "/api/v1/finance/invoices/"
PAYMENTS = "/api/v1/finance/payments/"
ROLES = "/api/v1/accounts/roles/"


@pytest.mark.django_db
def test_only_admins_can_list_user_accounts(auth_client, admin_user, teacher_user, students):
    assert auth_client(admin_user).get(USERS).status_code == 200
    assert auth_client(teacher_user).get(USERS).status_code == 403
    assert auth_client(students["user1"]).get(USERS).status_code == 403


@pytest.mark.django_db
def test_only_admins_can_manage_roles(auth_client, admin_user, teacher_user, roles):
    assert auth_client(admin_user).get(ROLES).status_code == 200
    assert auth_client(teacher_user).get(ROLES).status_code == 403

    response = auth_client(teacher_user).post(
        ROLES, {"name": "Hacker", "permission_codes": []}, format="json"
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_student_sees_only_their_own_record(auth_client, students):
    client = auth_client(students["user1"])
    response = client.get(STUDENTS)
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["uuid"] == str(students["student1"].uuid)

    # Guessing another student's UUID must not reveal it.
    detail = client.get(f"{STUDENTS}{students['student2'].uuid}/")
    assert detail.status_code == 404


@pytest.mark.django_db
def test_parent_sees_only_linked_children(auth_client, parent_user, guardian_link, students):
    client = auth_client(parent_user)
    response = client.get(STUDENTS)
    assert response.status_code == 200
    uuids = {row["uuid"] for row in response.data["results"]}
    assert uuids == {str(students["student1"].uuid)}

    assert client.get(f"{STUDENTS}{students['student2'].uuid}/").status_code == 404


@pytest.mark.django_db
def test_teacher_sees_only_their_sections(auth_client, teacher_user, teacher_profile, students):
    client = auth_client(teacher_user)
    response = client.get(STUDENTS)
    assert response.status_code == 200
    uuids = {row["uuid"] for row in response.data["results"]}
    assert str(students["student1"].uuid) in uuids
    assert str(students["student2"].uuid) in uuids
    assert str(students["student3"].uuid) not in uuids


@pytest.mark.django_db
def test_teacher_cannot_read_teacher_directory(auth_client, teacher_user, teacher_profile):
    response = auth_client(teacher_user).get(TEACHERS)
    assert response.status_code == 200
    assert response.data["count"] == 1  # only themselves


@pytest.mark.django_db
def test_teacher_cannot_write_academic_records(auth_client, teacher_user, teacher_profile):
    client = auth_client(teacher_user)
    response = client.post(
        "/api/v1/academics/subjects/",
        {"name": "Hacked", "code": "HACK", "credits": 1},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_teacher_cannot_access_finance(auth_client, teacher_user, teacher_profile, finance_data):
    client = auth_client(teacher_user)
    assert client.get(PAYMENTS).status_code == 403
    assert client.get(INVOICES).status_code == 403


@pytest.mark.django_db
def test_student_finance_is_scoped_to_self(auth_client, students, finance_data):
    own = auth_client(students["user1"]).get(INVOICES)
    assert own.status_code == 200
    assert own.data["count"] == 1

    other = auth_client(students["user2"]).get(INVOICES)
    assert other.status_code == 200
    assert other.data["count"] == 0


@pytest.mark.django_db
def test_student_cannot_record_payments(auth_client, students, finance_data):
    client = auth_client(students["user1"])
    response = client.post(
        PAYMENTS,
        {"invoice": str(finance_data["invoice"].uuid), "amount": "10.00", "method": "cash"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_cannot_be_granted_by_non_superuser(auth_client, teacher_user, teacher_profile, roles):
    """Even an Admin-role holder who is not a superuser cannot mint Admins."""
    almost_admin = User.objects.create_user(
        email="manager@test.example",
        password="Manager@12345",
        first_name="M",
        last_name="Manager",
    )
    almost_admin.user_roles.create(role=Role.objects.get(name="Admin"))
    almost_admin.clear_role_cache()

    response = auth_client(almost_admin, password="Manager@12345").post(
        USERS,
        {
            "email": "newadmin@test.example",
            "first_name": "New",
            "last_name": "Admin",
            "roles": ["Admin"],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "superuser" in str(response.data).lower()


@pytest.mark.django_db
def test_role_permission_codes_round_trip(auth_client, admin_user, permission_catalogue):
    client = auth_client(admin_user)
    created = client.post(
        ROLES,
        {
            "name": "Librarian",
            "description": "Library staff",
            "permission_codes": ["view_student"],
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    assert [p["code"] for p in created.data["permissions"]] == ["view_student"]

    role_uuid = created.data["uuid"]
    patched = client.patch(
        f"{ROLES}{role_uuid}/",
        {"permission_codes": ["view_student", "view_user"]},
        format="json",
    )
    assert patched.status_code == 200
    assert {p["code"] for p in patched.data["permissions"]} == {
        "view_student",
        "view_user",
    }


@pytest.mark.django_db
def test_system_roles_cannot_be_deleted(auth_client, admin_user, roles):
    client = auth_client(admin_user)
    admin_role = roles["Admin"]
    response = client.delete(f"{ROLES}{admin_role.uuid}/")
    assert response.status_code in (400, 403)
    admin_role.refresh_from_db()
    assert admin_role.is_active is True
