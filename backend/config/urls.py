"""Project URL configuration."""

import re

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve as static_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny

from apps.core.permissions import IsAdmin

admin.site.site_header = "School ERP Administration"
admin.site.site_title = "School ERP Admin"
admin.site.index_title = "School management"


class SchemaView(SpectacularAPIView):
    """API schema is public in DEBUG, admin-only in production."""

    def get_permissions(self):
        return [AllowAny()] if settings.DEBUG else [IsAdmin()]


class SwaggerView(SpectacularSwaggerView):
    def get_permissions(self):
        return [AllowAny()] if settings.DEBUG else [IsAdmin()]


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SchemaView.as_view(), name="schema"),
    path("api/docs/", SwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.academics.urls")),
    path("api/v1/", include("apps.attendance.urls")),
    path("api/v1/", include("apps.exams.urls")),
    path("api/v1/", include("apps.finance.urls")),
    path("api/v1/", include("apps.communication.urls")),
    path("api/v1/", include("apps.dashboard.urls")),
]

# Media files are served by Django only in development. In production put
# nginx (or an object store) in front of MEDIA_ROOT.
if settings.DEBUG:
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            static_serve,
            {"document_root": settings.MEDIA_ROOT},
        )
    ]

# Single-page frontend. WhiteNoise serves the hashed /assets/* files directly
# (WHITENOISE_ROOT), and any non-API route falls back to index.html so that
# client-side routing works.
if settings.FRONTEND_DIST.exists():
    from apps.core.spa import SpaView

    urlpatterns += [
        re_path(
            r"^(?!api/|admin/|static/|media/|assets/).*$",
            SpaView.as_view(),
            name="spa",
        ),
    ]
