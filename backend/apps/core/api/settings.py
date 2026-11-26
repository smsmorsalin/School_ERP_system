"""School settings endpoints.

``GET`` is public because the sign-in screen needs the school's name and logo
before anyone authenticates. It exposes only presentation data. Every write is
Admin-only and recorded in the audit trail with before/after snapshots.
"""

from copy import copy

from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import SAFE_METHODS, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.signals import record_audit
from apps.core.api.serializers import SchoolSettingsSerializer
from apps.core.models import SchoolSettings
from apps.core.permissions import IsAdmin


class SchoolSettingsView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [AllowAny()]
        return [IsAdmin()]

    def get(self, request):
        obj = SchoolSettings.load()
        data = SchoolSettingsSerializer(obj, context={"request": request}).data
        response = Response(data)
        response["Cache-Control"] = "no-store"
        return response

    def patch(self, request):
        obj = SchoolSettings.load()
        before = copy(obj)
        serializer = SchoolSettingsSerializer(
            obj,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(updated_by=request.user)

        record_audit(
            action="core.schoolsettings.updated",
            target=obj,
            before=before,
            after=obj,
            action_category="core",
        )

        data = SchoolSettingsSerializer(obj, context={"request": request}).data
        return Response(data)
