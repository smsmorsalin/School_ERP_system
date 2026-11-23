from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.attendance.views import AttendanceViewSet, MyAttendanceView

router = DefaultRouter()
router.register("attendance", AttendanceViewSet, basename="attendance")
router.register("my-attendance", MyAttendanceView, basename="my-attendance")

urlpatterns = [path("", include(router.urls))]
