from django.urls import include, path

from apps.audit.views import AuditLogViewSet

urlpatterns = [
    path("audit/", AuditLogViewSet.as_view({"get": "list"}), name="audit-list"),
    path("audit/<uuid:uuid>/", AuditLogViewSet.as_view({"get": "retrieve"}), name="audit-detail"),
]
