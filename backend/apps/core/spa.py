"""Serve the built single-page app with safe caching semantics."""

from django.conf import settings
from django.http import FileResponse, Http404
from django.views import View


class SpaView(View):
    def get(self, request, *args, **kwargs):
        index = settings.FRONTEND_DIST / "index.html"
        if not index.exists():
            raise Http404("Frontend build not found. Run `npm run build` in frontend/.")
        response = FileResponse(open(index, "rb"), content_type="text/html; charset=utf-8")
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response
