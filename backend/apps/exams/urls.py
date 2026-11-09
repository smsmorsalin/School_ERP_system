from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.exams.views import ExamResultViewSet, ExamSubjectViewSet, ExamViewSet

router = DefaultRouter()
router.register("exams", ExamViewSet, basename="exam")
router.register("exam-subjects", ExamSubjectViewSet, basename="exam-subject")
router.register("exam-results", ExamResultViewSet, basename="exam-result")

urlpatterns = [path("", include(router.urls))]
