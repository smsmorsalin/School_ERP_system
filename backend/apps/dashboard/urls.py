from django.urls import path

from apps.dashboard.views import DashboardOverviewView, GlobalSearchView, HealthView

urlpatterns = [
    path("dashboard/overview/", DashboardOverviewView.as_view(), name="dashboard-overview"),
    path("dashboard/search/", GlobalSearchView.as_view(), name="global-search"),
    path("health/", HealthView.as_view(), name="health"),
]
