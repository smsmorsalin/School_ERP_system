"""The React console must win over Django's admin prefix for its own routes."""

from __future__ import annotations

import pytest
from django.conf import settings

pytestmark = pytest.mark.skipif(
    not settings.FRONTEND_DIST.exists(), reason="frontend build not present"
)


def test_console_admin_routes_serve_the_spa(client):
    for path in ("/admin/settings", "/admin/users", "/admin/users/any-uuid"):
        response = client.get(path)
        assert response.status_code == 200, path
        body = b"".join(response.streaming_content)
        assert b'<div id="root">' in body, path


def test_django_admin_keeps_the_rest_of_the_prefix(client):
    response = client.get("/admin/")
    assert response.status_code == 302
    assert "/admin/login/" in response["Location"]
