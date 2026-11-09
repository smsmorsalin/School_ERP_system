"""Academics API views."""

from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.academics.access import (
    accessible_sections,
    accessible_students,
    children_of,
    student_profile_of,
)
from apps.academics.filters import (
    ClassSubjectFilter,
    SectionFilter,
    StudentFilter,
    TimetableFilter,
)
from apps.academics.models import (
    AcademicYear,
    ClassSubject,
    GuardianStudent,
    SchoolClass,
    Section,
    StudentProfile,
    Subject,
    TeacherProfile,
    TimetableEntry,
)
from apps.academics.serializers import (
    AcademicYearSerializer,
    AddGuardianSerializer,
    ClassSubjectSerializer,
    GuardianLinkSerializer,
    SchoolClassSerializer,
    SectionSerializer,
    StudentCreateSerializer,
    StudentProfileSerializer,
    StudentUpdateSerializer,
    SubjectSerializer,
    TeacherCreateSerializer,
    TeacherProfileSerializer,
    TeacherUpdateSerializer,
    TimetableEntrySerializer,
)
from apps.core.permissions import IsAdmin, IsAdminOrReadOnly, is_admin
from apps.accounts.tokens import revoke_user_refresh_tokens


class AcademicYearViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = AcademicYearSerializer
    lookup_field = "uuid"
    queryset = AcademicYear.objects.all()
    search_fields = ["name"]
    ordering_fields = ["start_date", "name"]

    @action(detail=False, methods=["get"])
    def current(self, request):
        year = AcademicYear.objects.filter(is_current=True, is_active=True).first()
        if not year:
            return Response({"detail": "No current academic year is configured."}, status=404)
        return Response(self.get_serializer(year).data)


class SchoolClassViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = SchoolClassSerializer
    lookup_field = "uuid"
    search_fields = ["name", "description"]
    ordering_fields = ["level", "name"]

    def get_queryset(self):
        return SchoolClass.objects.annotate(
            sections_count=Count("sections", filter=Q(sections__is_active=True), distinct=True),
            students_count=Count(
                "sections__students",
                filter=Q(sections__students__is_active=True, sections__students__status="active"),
                distinct=True,
            ),
        ).order_by("level")


class SectionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = SectionSerializer
    lookup_field = "uuid"
    filterset_class = SectionFilter
    search_fields = ["name", "school_class__name", "room"]
    ordering_fields = ["school_class__level", "name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Section.objects.none()
        qs = Section.objects.select_related("school_class", "class_teacher", "academic_year")
        if not is_admin(self.request.user) and self.action not in ("create", "update", "partial_update", "destroy"):
            qs = qs.filter(pk__in=accessible_sections(self.request.user).values("pk"))
        return qs.annotate(
            student_count=Count(
                "students",
                filter=Q(students__is_active=True, students__status="active"),
                distinct=True,
            ),
            subject_count=Count("class_subjects", filter=Q(class_subjects__is_active=True), distinct=True),
        ).order_by("school_class__level", "name")

    @action(detail=False, methods=["get"], url_path="my-classes")
    def my_classes(self, request):
        sections = accessible_sections(request.user)
        return Response(
            SectionSerializer(
                sections, many=True, context={"request": request}
            ).data
        )

    @action(detail=True, methods=["get"])
    def roster(self, request, uuid=None):
        section = self.get_object()
        if not (is_admin(request.user) or "Teacher" in request.user.role_names or "Accountant" in request.user.role_names):
            raise PermissionDenied("You cannot view this class roster.")
        students = accessible_students(request.user).filter(
            current_section=section, is_active=True
        )
        return Response(
            StudentProfileSerializer(students, many=True, context={"request": request}).data
        )


class SubjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = SubjectSerializer
    lookup_field = "uuid"
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code"]
    queryset = Subject.objects.all()


class ClassSubjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ClassSubjectSerializer
    lookup_field = "uuid"
    filterset_class = ClassSubjectFilter
    search_fields = ["subject__name", "subject__code", "section__name"]
    ordering_fields = ["section__school_class__level", "subject__name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ClassSubject.objects.none()
        qs = ClassSubject.objects.select_related(
            "section__school_class", "subject", "teacher"
        ).filter(is_active=True)
        user = self.request.user
        if is_admin(user) or "Accountant" in user.role_names:
            return qs
        if "Teacher" in user.role_names:
            return qs.filter(
                Q(teacher=user) | Q(section__class_teacher=user)
            ).distinct()
        section_ids = accessible_sections(user).values("pk")
        return qs.filter(section_id__in=section_ids)


class TeacherProfileViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = TeacherProfileSerializer
    lookup_field = "uuid"
    search_fields = [
        "user__first_name", "user__last_name", "user__email",
        "employee_id", "specialization",
    ]
    ordering_fields = ["employee_id", "user__first_name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TeacherProfile.objects.none()
        qs = TeacherProfile.objects.select_related("user").filter(is_active=True)
        if is_admin(self.request.user):
            return qs
        return qs.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return TeacherCreateSerializer
        if self.action in ("update", "partial_update"):
            return TeacherUpdateSerializer
        return TeacherProfileSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        payload = TeacherProfileSerializer(profile, context={"request": request}).data
        temp = getattr(serializer, "temporary_password", None)
        if temp:
            payload["temporary_password"] = temp
        return Response(payload, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance.refresh_from_db()
        if not instance.is_active:
            self._deactivate_account(instance)
        return Response(
            TeacherProfileSerializer(instance, context={"request": request}).data
        )

    def _deactivate_account(self, instance):
        if instance.user.is_active:
            instance.user.is_active = False
            instance.user.save(update_fields=["is_active", "updated_at"])
        revoke_user_refresh_tokens(instance.user)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        self._deactivate_account(instance)

    @action(detail=False, methods=["get"])
    def me(self, request):
        profile = TeacherProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response({"detail": "No teacher profile found."}, status=404)
        return Response(self.get_serializer(profile).data)


class StudentProfileViewSet(viewsets.ModelViewSet):
    serializer_class = StudentProfileSerializer
    lookup_field = "uuid"
    filterset_class = StudentFilter
    search_fields = [
        "user__first_name", "user__last_name", "user__email", "student_id",
        "user__phone_number",
    ]
    ordering_fields = ["student_id", "user__first_name", "created_at"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdmin()]
        if self.action == "guardians" and self.request.method == "POST":
            return [IsAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return StudentProfile.objects.none()
        return (
            accessible_students(self.request.user)
            .select_related("user", "current_section__school_class")
            .prefetch_related("guardian_links__guardian__user", "user__user_roles__role")
            .filter(is_active=True)
        )

    def get_serializer_class(self):
        if self.action == "create":
            return StudentCreateSerializer
        if self.action in ("update", "partial_update"):
            return StudentUpdateSerializer
        return StudentProfileSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        payload = StudentProfileSerializer(profile, context={"request": request}).data
        temp = getattr(serializer, "temporary_password", None)
        if temp:
            payload["temporary_password"] = temp
        return Response(payload, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance.refresh_from_db()
        if not instance.is_active or instance.status in ("transferred", "suspended"):
            self._deactivate_account(instance)
        return Response(
            StudentProfileSerializer(instance, context={"request": request}).data
        )

    def _deactivate_account(self, instance):
        if instance.user.is_active:
            instance.user.is_active = False
            instance.user.save(update_fields=["is_active", "updated_at"])
        revoke_user_refresh_tokens(instance.user)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.status = "transferred"
        instance.save(update_fields=["is_active", "status", "updated_at"])
        self._deactivate_account(instance)

    @action(detail=False, methods=["get"])
    def me(self, request):
        profile = student_profile_of(request.user)
        if not profile:
            return Response({"detail": "No student profile found."}, status=404)
        return Response(StudentProfileSerializer(profile, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="my-children")
    def my_children(self, request):
        if "Parent" not in request.user.role_names and not is_admin(request.user):
            raise PermissionDenied("Only parents can access this endpoint.")
        students = children_of(request.user).select_related(
            "user", "current_section__school_class"
        )
        return Response(
            StudentProfileSerializer(students, many=True, context={"request": request}).data
        )

    @action(detail=True, methods=["get", "post"], url_path="guardians")
    def guardians(self, request, uuid=None):
        student = self.get_object()
        if request.method == "GET":
            links = GuardianStudent.objects.filter(
                student=student, is_active=True
            ).select_related("guardian__user")
            return Response(
                GuardianLinkSerializer(links, many=True, context={"request": request}).data
            )

        serializer = AddGuardianSerializer(
            data=request.data, context={"request": request, "student": student}
        )
        serializer.is_valid(raise_exception=True)
        link = serializer.save()
        return Response(
            GuardianLinkSerializer(link, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class GuardianLinkViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = GuardianLinkSerializer
    lookup_field = "uuid"
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return GuardianStudent.objects.select_related(
            "guardian__user", "student__user"
        ).filter(is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class TimetableViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = TimetableEntrySerializer
    lookup_field = "uuid"
    filterset_class = TimetableFilter
    ordering_fields = ["day_of_week", "start_time"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimetableEntry.objects.none()
        qs = TimetableEntry.objects.select_related(
            "section__school_class", "subject", "teacher"
        ).filter(is_active=True)
        user = self.request.user
        if is_admin(user) or "Accountant" in user.role_names:
            return qs
        if "Teacher" in user.role_names:
            from apps.academics.access import teacher_sections

            return qs.filter(
                Q(teacher=user) | Q(section__in=teacher_sections(user))
            ).distinct()
        return qs.filter(section__in=accessible_sections(user))
