"""
==========================================================
Audit middleware
==========================================================

Thread-local request metadata so audit signals can capture
IP address, user agent, actor and request correlation id
without threading the request through every signal call.
"""

import threading
import uuid

_local = threading.local()


def get_current_request():
    return getattr(_local, "request", None)


class RequestMetadataMiddleware:
    """
    Stores the current request on a thread-local and attaches a
    correlation id for grouping audit events from one request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.id = getattr(request, "id", None) or uuid.uuid4().hex[:16]
        _local.request = request
        try:
            response = self.get_response(request)
        finally:
            _local.request = None
        return response
