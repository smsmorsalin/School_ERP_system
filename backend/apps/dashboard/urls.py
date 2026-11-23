from django.urls import path

from apps.dashboard.views import (
    DashboardOverviewView,
    GlobalSearchView,
    HealthView,
    LivenessView,
    ReadinessView,
)

urlpatterns = [
    path("dashboard/overview/", DashboardOverviewView.as_view(), name="dashboard-overview"),
    path("dashboard/search/", GlobalSearchView.as_view(), name="global-search"),
    path("health/", HealthView.as_view(), name="health"),
    path("health/live/", LivenessView.as_view(), name="health-live"),
    path("health/ready/", ReadinessView.as_view(), name="health-ready"),
]
