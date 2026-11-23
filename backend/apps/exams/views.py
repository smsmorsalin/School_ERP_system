"""Exam, result-entry and report-card endpoints."""

from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.academics.access import accessible_students, children_of, student_profile_of
from apps.academics.models import StudentProfile
from apps.core.permissions import IsAdmin, IsAdminOrReadOnly, IsTeacherOrAdmin, is_admin
from apps.exams.access import (
    teacher_can_manage,
    teacher_managed_exam_subjects,
    visible_sections_for_exams,
)
from apps.exams.models import Exam, ExamResult, ExamSubject
from apps.exams.serializers import (
    BulkResultSerializer,
    ExamResultSerializer,
    ExamSerializer,
    ExamSubjectSerializer,
)
from apps.exams.utils import GRADE_BANDS, grade_for_percentage, grade_point
from apps.core.filters import ExamFilter, ExamResultFilter, ExamSubjectFilter


class ExamViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ExamSerializer
    lookup_field = "uuid"
    filterset_class = ExamFilter
    search_fields = ["name", "description"]
    ordering_fields = ["start_date", "name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Exam.objects.none()
        qs = Exam.objects.select_related("academic_year").annotate(
            subject_count=Count("exam_subjects", filter=Q(exam_subjects__is_active=True), distinct=True),
            section_count=Count(
                "exam_subjects__section",
                filter=Q(exam_subjects__is_active=True),
                distinct=True,
            ),
            result_count=Count("exam_subjects__results", distinct=True),
        )
        user = self.request.user
        if is_admin(user):
            return qs
        if "Teacher" in user.role_names:
            return qs.filter(exam_subjects__section__in=visible_sections_for_exams(user)).distinct()
        if "Student" in user.role_names or "Parent" in user.role_names:
            return qs.filter(
                is_published=True, exam_subjects__section__in=visible_sections_for_exams(user)
            ).distinct()
        return qs.none()

    @action(detail=True, methods=["post"])
    def publish(self, request, uuid=None):
        if not is_admin(request.user):
            raise PermissionDenied("Only administrators can publish results.")
        exam = self.get_object()
        should_publish = request.data.get("published", True)
        if not isinstance(should_publish, bool):
            raise ValidationError({"published": "Provide true or false."})

        if should_publish and not exam.exam_subjects.exists():
            raise ValidationError({"detail": "Add at least one subject before publishing."})
        if should_publish:
            missing = exam.exam_subjects.annotate(
                result_count=Count("results")
            ).filter(result_count=0).count()
            if missing == exam.exam_subjects.count():
                raise ValidationError({"detail": "There are no results to publish yet."})

        exam.is_published = should_publish
        exam.published_at = timezone.now() if should_publish else None
        exam.published_by = request.user if should_publish else None
        exam.save(update_fields=["is_published", "published_at", "published_by", "updated_at"])
        return Response(
            {
                "detail": "Results published." if should_publish else "Results unpublished.",
                "is_published": exam.is_published,
            }
        )

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        """Grade distribution for a given exam (staff only)."""
        if not (is_admin(request.user) or "Teacher" in request.user.role_names):
            raise PermissionDenied("Staff access required.")
        exam_uuid = request.query_params.get("exam")
        if not exam_uuid:
            raise ValidationError({"exam": "This query parameter is required."})

        results = ExamResult.objects.filter(exam_subject__exam__uuid=exam_uuid)
        if not is_admin(request.user):
            from apps.exams.access import teacher_managed_exam_subjects

            managed = teacher_managed_exam_subjects(request.user)
            results = results.filter(exam_subject__in=managed)

        distribution = {code: 0 for _t, code, _p in GRADE_BANDS}
        for row in results.values("grade").annotate(count=Count("id")):
            if row["grade"] in distribution:
                distribution[row["grade"]] += row["count"]
        aggregate = results.aggregate(avg=Avg("marks_obtained"), count=Count("id"))
        return Response(
            {
                "distribution": [
                    {"grade": code, "count": count}
                    for code, count in distribution.items()
                ],
                "average_marks": round(aggregate["avg"] or 0, 2),
                "result_count": aggregate["count"],
            }
        )


class ExamSubjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ExamSubjectSerializer
    lookup_field = "uuid"
    filterset_class = ExamSubjectFilter
    search_fields = ["subject__name", "subject__code", "exam__name"]
    ordering_fields = ["exam_date", "subject__name"]

    def get_permissions(self):
        # Teachers may submit marks for subjects they manage.
        if self.action == "bulk_results":
            return [IsTeacherOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExamSubject.objects.none()
        qs = ExamSubject.objects.select_related(
            "exam", "section__school_class", "subject"
        ).annotate(result_count=Count("results"))
        user = self.request.user
        if is_admin(user):
            return qs
        if "Teacher" in user.role_names:
            return qs.filter(pk__in=teacher_managed_exam_subjects(user).values("pk"))
        if "Student" in user.role_names or "Parent" in user.role_names:
            return qs.filter(
                exam__is_published=True,
                section__in=visible_sections_for_exams(user),
            )
        return qs.none()

    @action(detail=True, methods=["get"])
    def sheet(self, request, uuid=None):
        """Roster + existing marks for the mark-entry grid."""
        exam_subject = self.get_object()
        if not teacher_can_manage(request.user, exam_subject):
            raise PermissionDenied("You do not manage this exam subject.")

        students = (
            StudentProfile.objects.filter(
                current_section=exam_subject.section, is_active=True, status="active"
            )
            .select_related("user")
            .order_by("roll_number", "student_id")
        )
        existing = {
            str(result.student.uuid): result
            for result in ExamResult.objects.filter(exam_subject=exam_subject)
        }
        rows = []
        for student in students:
            result = existing.get(str(student.uuid))
            rows.append(
                {
                    "student_uuid": str(student.uuid),
                    "student_name": student.user.get_full_name(),
                    "student_code": student.student_id,
                    "roll_number": student.roll_number,
                    "marks_obtained": float(result.marks_obtained) if result else None,
                    "grade": result.grade if result else None,
                    "remarks": result.remarks if result else "",
                }
            )
        return Response(
            {
                "exam_subject": ExamSubjectSerializer(
                    exam_subject, context={"request": request}
                ).data,
                "locked": exam_subject.exam.is_published,
                "rows": rows,
            }
        )

    @action(detail=True, methods=["post"], url_path="bulk-results")
    def bulk_results(self, request, uuid=None):
        exam_subject = self.get_object()
        if not teacher_can_manage(request.user, exam_subject):
            raise PermissionDenied("You do not manage this exam subject.")

        payload = dict(request.data)
        payload["exam_subject"] = str(exam_subject.uuid)
        serializer = BulkResultSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        created = 0
        updated = 0
        with transaction.atomic():
            for row in serializer.validated_data["results"]:
                student = serializer.validated_data["students_by_uuid"][str(row["student"])]
                result, was_created = ExamResult.objects.update_or_create(
                    exam_subject=exam_subject,
                    student=student,
                    defaults={
                        "marks_obtained": row["marks_obtained"],
                        "remarks": row.get("remarks", ""),
                        "entered_by": request.user,
                        "is_active": True,
                    },
                )
                created += int(was_created)
                updated += int(not was_created)
        return Response(
            {
                "detail": "Results saved.",
                "created": created,
                "updated": updated,
            }
        )


class ExamResultViewSet(viewsets.ModelViewSet):
    serializer_class = ExamResultSerializer
    lookup_field = "uuid"
    filterset_class = ExamResultFilter
    ordering_fields = ["student__student_id", "marks_obtained"]
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_permissions(self):
        if self.request.method not in ("GET", "HEAD", "OPTIONS"):
            return [IsTeacherOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ExamResult.objects.none()
        qs = ExamResult.objects.select_related(
            "student__user", "exam_subject__subject", "exam_subject__exam", "entered_by"
        )
        user = self.request.user
        if is_admin(user):
            return qs
        if "Teacher" in user.role_names:
            return qs.filter(exam_subject__in=teacher_managed_exam_subjects(user))
        if "Student" in user.role_names:
            return qs.filter(student__user=user, exam_subject__exam__is_published=True)
        if "Parent" in user.role_names:
            return qs.filter(
                student__in=children_of(user), exam_subject__exam__is_published=True
            )
        return qs.none()

    def _check_object_permission(self, exam_subject):
        if not teacher_can_manage(self.request.user, exam_subject):
            raise PermissionDenied("You do not manage this exam subject.")
        if exam_subject.exam.is_published:
            raise ValidationError({"detail": "Published results are read-only."})

    def perform_create(self, serializer):
        exam_subject = serializer.validated_data["exam_subject"]
        self._check_object_permission(exam_subject)
        serializer.save(entered_by=self.request.user)

    def perform_update(self, serializer):
        exam_subject = serializer.instance.exam_subject
        self._check_object_permission(exam_subject)
        serializer.save(entered_by=self.request.user)

    def perform_destroy(self, instance):
        self._check_object_permission(instance.exam_subject)
        super().perform_destroy(instance)

    @action(detail=False, methods=["get"], url_path="report-card")
    def report_card(self, request):
        student_uuid = request.query_params.get("student")
        exam_uuid = request.query_params.get("exam")
        if not student_uuid:
            raise ValidationError({"student": "This query parameter is required."})

        student = (
            accessible_students(request.user)
            .select_related("user", "current_section__school_class")
            .filter(uuid=student_uuid)
            .first()
        )
        if not student:
            raise PermissionDenied("You cannot access this student's report card.")

        results = ExamResult.objects.filter(student=student).select_related(
            "exam_subject__subject", "exam_subject__exam"
        )
        exam = None
        if exam_uuid:
            exam = Exam.objects.filter(uuid=exam_uuid).first()
            if not exam:
                raise ValidationError({"exam": "Exam not found."})
            results = results.filter(exam_subject__exam=exam)
        else:
            latest = results.order_by("-exam_subject__exam__start_date").first()
            if latest:
                exam = latest.exam_subject.exam

        if exam is None:
            return Response({"detail": "No results found."}, status=status.HTTP_404_NOT_FOUND)

        is_staff_viewer = is_admin(request.user) or "Teacher" in request.user.role_names
        if not is_staff_viewer and not exam.is_published:
            raise PermissionDenied("Results for this exam are not published yet.")

        rows = []
        obtained_total = 0
        max_total = 0
        for result in results.select_related("exam_subject__subject"):
            obtained_total += float(result.marks_obtained)
            max_total += float(result.exam_subject.max_marks)
            rows.append(
                {
                    "subject": result.exam_subject.subject.name,
                    "subject_code": result.exam_subject.subject.code,
                    "marks_obtained": float(result.marks_obtained),
                    "max_marks": float(result.exam_subject.max_marks),
                    "pass_marks": float(result.exam_subject.pass_marks),
                    "percentage": result.percentage,
                    "grade": result.grade,
                    "remarks": result.remarks,
                }
            )
        percentage = round(obtained_total * 100 / max_total, 2) if max_total else 0
        overall_grade = grade_for_percentage(percentage)

        position = None
        if student.current_section_id:
            totals = (
                ExamResult.objects.filter(
                    exam_subject__exam=exam,
                    exam_subject__section_id=student.current_section_id,
                )
                .values("student_id")
                .annotate(total=Sum("marks_obtained"))
                .order_by("-total")
            )
            for index, row in enumerate(totals, start=1):
                if row["student_id"] == student.id:
                    position = index
                    break

        return Response(
            {
                "student": {
                    "uuid": str(student.uuid),
                    "student_id": student.student_id,
                    "full_name": student.user.get_full_name(),
                    "section": str(student.current_section) if student.current_section else None,
                    "class": student.current_section.school_class.name
                    if student.current_section
                    else None,
                },
                "exam": {
                    "uuid": str(exam.uuid),
                    "name": exam.name,
                    "term": exam.get_term_display(),
                    "is_published": exam.is_published,
                },
                "results": rows,
                "totals": {
                    "obtained": round(obtained_total, 2),
                    "max": round(max_total, 2),
                    "percentage": percentage,
                    "grade": overall_grade,
                    "grade_point": grade_point(overall_grade),
                    "passed": percentage >= 40,
                    "position": position,
                },
            }
        )
