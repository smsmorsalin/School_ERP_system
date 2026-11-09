from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.academics.views import (
    AcademicYearViewSet,
    ClassSubjectViewSet,
    GuardianLinkViewSet,
    SchoolClassViewSet,
    SectionViewSet,
    StudentProfileViewSet,
    SubjectViewSet,
    TeacherProfileViewSet,
    TimetableViewSet,
)

router = DefaultRouter()
router.register("academics/academic-years", AcademicYearViewSet, basename="academic-year")
router.register("academics/classes", SchoolClassViewSet, basename="school-class")
router.register("academics/sections", SectionViewSet, basename="section")
router.register("academics/subjects", SubjectViewSet, basename="subject")
router.register("academics/class-subjects", ClassSubjectViewSet, basename="class-subject")
router.register("academics/teachers", TeacherProfileViewSet, basename="teacher")
router.register("academics/students", StudentProfileViewSet, basename="student")
router.register("academics/guardian-links", GuardianLinkViewSet, basename="guardian-link")
router.register("academics/timetable", TimetableViewSet, basename="timetable")

urlpatterns = [path("", include(router.urls))]
