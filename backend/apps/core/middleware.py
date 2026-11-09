"""Small, dependency-free security and observability middleware."""

import logging
import uuid

logger = logging.getLogger("apps.security")


class SecurityHeadersMiddleware:
    """Add headers Django does not set itself.

    The Content-Security-Policy is only injected when the request is served by
    Django (the production single-origin deployment). The Vite dev server sets
    its own policies.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # Do not allow embedding anywhere.
        response.setdefault("X-Frame-Options", "DENY")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("Referrer-Policy", "same-origin")
        response.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
        )
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if not request.path.startswith(("/api/", "/admin/", "/static/", "/media/")):
            from django.conf import settings

            response.setdefault(
                "Content-Security-Policy", settings.CONTENT_SECURITY_POLICY
            )
        return response


class RequestIDMiddleware:
    """Attach a request id to requests and responses for log correlation."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        return response
