"""Announcement audience filtering and read-state tests."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.communication.models import Announcement

ANNOUNCEMENTS = "/api/v1/announcements/"


def create_announcement(user, title, audience="all", **kwargs):
    return Announcement.objects.create(
        title=title, body="Body", audience=audience, created_by=user, **kwargs
    )


@pytest.mark.django_db
def test_admin_can_publish_school_wide_announcement(auth_client, admin_user):
    response = auth_client(admin_user).post(
        ANNOUNCEMENTS,
        {"title": "Sports day", "body": "Friday", "audience": "all"},
        format="json",
    )
    assert response.status_code == 201, response.content
    assert Announcement.objects.filter(title="Sports day").exists()


@pytest.mark.django_db
def test_teacher_can_publish_to_students_only(auth_client, teacher_user, teacher_profile):
    client = auth_client(teacher_user)
    allowed = client.post(
        ANNOUNCEMENTS,
        {"title": "Class test", "body": "Tomorrow", "audience": "students"},
        format="json",
    )
    assert allowed.status_code == 201, allowed.content

    blocked = client.post(
        ANNOUNCEMENTS,
        {"title": "All staff", "body": "Meeting", "audience": "all"},
        format="json",
    )
    assert blocked.status_code == 400


@pytest.mark.django_db
def test_students_and_parents_cannot_publish(
    auth_client, students, parent_user, guardian_link
):
    for user in (students["user1"], parent_user):
        response = auth_client(user).post(
            ANNOUNCEMENTS,
            {"title": "Nope", "body": "Nope", "audience": "all"},
            format="json",
        )
        assert response.status_code == 403


@pytest.mark.django_db
def test_audience_filtering(auth_client, admin_user, students, parent_user, guardian_link, accountant_user):
    create_announcement(admin_user, "Everyone", "all")
    create_announcement(admin_user, "Students", "students")
    create_announcement(admin_user, "Parents", "parents")
    create_announcement(admin_user, "Teachers", "teachers")

    def titles(user):
        response = auth_client(user).get(ANNOUNCEMENTS)
        assert response.status_code == 200
        return {row["title"] for row in response.data["results"]}

    assert titles(students["user1"]) == {"Everyone", "Students"}
    assert titles(parent_user) == {"Everyone", "Parents"}
    assert titles(accountant_user) == {"Everyone"}


@pytest.mark.django_db
def test_expired_announcements_are_hidden(auth_client, admin_user, students):
    create_announcement(admin_user, "Live", "all")
    create_announcement(
        admin_user,
        "Expired",
        "all",
        expires_at=timezone.now() - timedelta(days=1),
    )
    response = auth_client(students["user1"]).get(ANNOUNCEMENTS)
    titles = {row["title"] for row in response.data["results"]}
    assert titles == {"Live"}


@pytest.mark.django_db
def test_mark_read_and_unread_count(auth_client, admin_user, students):
    first = create_announcement(admin_user, "One", "all")
    create_announcement(admin_user, "Two", "all")

    client = auth_client(students["user1"])
    before = client.get(f"{ANNOUNCEMENTS}unread-count/")
    assert before.data["unread"] == 2

    assert client.post(f"{ANNOUNCEMENTS}{first.uuid}/read/").status_code == 200

    after = client.get(f"{ANNOUNCEMENTS}unread-count/")
    assert after.data["unread"] == 1

    assert client.post(f"{ANNOUNCEMENTS}mark-all-read/").status_code == 200
    assert client.get(f"{ANNOUNCEMENTS}unread-count/").data["unread"] == 0


@pytest.mark.django_db
def test_teacher_can_only_edit_own_announcement(
    auth_client, teacher_user, other_teacher_user, teacher_profile
):
    own = create_announcement(teacher_user, "Mine", "students")
    other = create_announcement(other_teacher_user, "Theirs", "students")

    client = auth_client(teacher_user)
    assert (
        client.patch(f"{ANNOUNCEMENTS}{own.uuid}/", {"title": "Mine v2"}, format="json").status_code
        == 200
    )
    assert (
        client.patch(f"{ANNOUNCEMENTS}{other.uuid}/", {"title": "Hacked"}, format="json").status_code
        == 403
    )
