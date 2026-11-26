"""Core routes: public branding settings."""

from django.urls import path

from apps.core.api.settings import SchoolSettingsView

urlpatterns = [
    path("settings/", SchoolSettingsView.as_view(), name="school-settings"),
]
