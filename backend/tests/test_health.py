"""Container/Kubernetes health probe endpoints."""

from __future__ import annotations

import pytest

LIVE = "/api/v1/health/live/"
READY = "/api/v1/health/ready/"
HEALTH = "/api/v1/health/"


@pytest.mark.django_db
def test_liveness_is_public_and_does_not_require_auth(api):
    response = api.get(LIVE)
    assert response.status_code == 200
    assert response.data == {"status": "ok"}


@pytest.mark.django_db
def test_readiness_checks_the_database(api):
    response = api.get(READY)
    assert response.status_code == 200
    assert response.data["status"] == "ready"
    assert response.data["database"] == "ok"


@pytest.mark.django_db
def test_combined_health_endpoint(api):
    response = api.get(HEALTH)
    assert response.status_code == 200
    assert response.data["database"] == "ok"


@pytest.mark.django_db
def test_health_endpoints_do_not_leak_details(api):
    for path in (LIVE, READY, HEALTH):
        body = api.get(path).content.decode()
        assert "password" not in body.lower()
        assert "secret" not in body.lower()
