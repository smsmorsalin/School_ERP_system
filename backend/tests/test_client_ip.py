"""Client-IP extraction must not trust spoofable X-Forwarded-For values."""

from __future__ import annotations

import pytest
from django.test import RequestFactory

from apps.core.utils import get_client_ip


@pytest.fixture
def request_factory():
    return RequestFactory()


def make_request(factory, *, remote_addr="10.0.0.9", forwarded=None):
    extra = {"REMOTE_ADDR": remote_addr}
    if forwarded is not None:
        extra["HTTP_X_FORWARDED_FOR"] = forwarded
    return factory.get("/", **extra)


def test_uses_remote_addr_by_default(request_factory, settings):
    settings.USE_X_FORWARDED_FOR = False
    request = make_request(
        request_factory, remote_addr="10.0.0.9", forwarded="203.0.113.7, 10.0.0.9"
    )
    assert get_client_ip(request) == "10.0.0.9"


def test_uses_rightmost_forwarded_hop_when_trusted(request_factory, settings):
    settings.USE_X_FORWARDED_FOR = True
    request = make_request(
        request_factory,
        remote_addr="10.0.0.9",
        # Attacker-controlled left-hand value, real peer appended by ingress.
        forwarded="1.2.3.4, 203.0.113.7, 10.0.0.9",
    )
    assert get_client_ip(request) == "10.0.0.9"


def test_falls_back_to_remote_addr_without_header(request_factory, settings):
    settings.USE_X_FORWARDED_FOR = True
    request = make_request(request_factory, remote_addr="192.0.2.5")
    assert get_client_ip(request) == "192.0.2.5"


def test_blank_rightmost_hop_falls_back_to_remote_addr(request_factory, settings):
    settings.USE_X_FORWARDED_FOR = True
    request = make_request(
        request_factory, remote_addr="192.0.2.5", forwarded="1.2.3.4,   "
    )
    assert get_client_ip(request) == "192.0.2.5"
