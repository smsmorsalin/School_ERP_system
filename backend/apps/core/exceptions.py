"""Uniform API error responses that never leak internals."""

import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("apps.api")


def _flatten(detail):
    """Turn DRF's nested error structures into a flat, human-readable list."""
    messages = []
    if isinstance(detail, dict):
        for field, value in detail.items():
            nested = _flatten(value)
            for message in nested:
                messages.append(message if field == "detail" else f"{field}: {message}")
    elif isinstance(detail, (list, tuple)):
        for item in detail:
            messages.extend(_flatten(item))
    else:
        messages.append(str(detail))
    return messages


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)

    if response is None:
        # Unhandled exception: log it and hide the traceback from clients.
        logger.exception("Unhandled API exception", exc_info=exc)
        return Response(
            {
                "detail": "An unexpected error occurred. Please try again later.",
                "errors": [],
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, (Http404, PermissionDenied)):
        pass

    detail = response.data.get("detail") if isinstance(response.data, dict) else None
    errors = _flatten(response.data)

    payload = {
        "detail": str(detail) if detail else (errors[0] if errors else "Request failed."),
        "errors": errors,
        "status": response.status_code,
    }

    # Client errors are safe to describe. 5xx messages are replaced above.
    if isinstance(exc, ValidationError):
        payload["detail"] = "Please correct the errors below."
        payload["fields"] = response.data

    response.data = payload
    return response


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The request conflicts with the current state of the resource."
    default_code = "conflict"


class ServiceUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Service temporarily unavailable."
    default_code = "service_unavailable"
