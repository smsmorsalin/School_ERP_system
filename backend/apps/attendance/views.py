"""Attendance endpoints with strict section-level access control."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.academics.access import (
    accessible_sections,
    accessible_students,
    children_of,
    teacher_sections,
)
from apps.academics.models import Section, StudentProfile
from apps.attendance.models import Attendance
from apps.attendance.serializers import (
    AttendanceSerializer,
    BulkAttendanceSerializer,
)
from apps.core.filters import AttendanceFilter
from apps.core.permissions import IsTeacherOrAdmin, is_admin


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    lookup_field = "uuid"
    filterset_class = AttendanceFilter
    ordering_fields = ["date", "student__student_id"]
    ordering = ["-date"]
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_permissions(self):
        # Teachers may mark attendance for sections they teach; every write is
        # still re-checked against their sections in the action handlers.
        if self.request.method not in ("GET", "HEAD", "OPTIONS"):
            return [IsTeacherOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Attendance.objects.none()
        user = self.request.user
        qs = Attendance.objects.select_related(
            "student__user", "section__school_class", "marked_by"
        )
        if is_admin(user) or "Accountant" in user.role_names:
            return qs
        if "Teacher" in user.role_names:
            return qs.filter(section__in=teacher_sections(user))
        if "Student" in user.role_names:
            return qs.filter(student__user=user)
        if "Parent" in user.role_names:
            return qs.filter(student__in=children_of(user))
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        section = serializer.validated_data["section"]
        if not (is_admin(user) or section.pk in set(teacher_sections(user).values_list("pk", flat=True))):
            raise PermissionDenied("You do not teach this section.")
        serializer.save(marked_by=user)

    @action(detail=False, methods=["get"], url_path="sheet")
    def sheet(self, request):
        """Return the roster plus any existing attendance for a date."""
        section_uuid = request.query_params.get("section")
        date_raw = request.query_params.get("date") or timezone.localdate().isoformat()
        if not section_uuid:
            raise ValidationError({"section": "This query parameter is required."})
        try:
            date = timezone.datetime.fromisoformat(date_raw).date()
        except ValueError as exc:
            raise ValidationError({"date": "Use the YYYY-MM-DD format."}) from exc

        section = Section.objects.filter(uuid=section_uuid, is_active=True).first()
        if not section:
            raise ValidationError({"section": "Section not found."})
        if not (is_admin(request.user) or "Accountant" in request.user.role_names):
            if section.pk not in set(accessible_sections(request.user).values_list("pk", flat=True)):
                raise PermissionDenied("You cannot access this section.")

        students = StudentProfile.objects.filter(
            current_section=section, is_active=True, status="active"
        ).select_related("user").order_by("roll_number", "student_id")
        existing = {
            str(record.student.uuid): record
            for record in Attendance.objects.filter(section=section, date=date)
        }

        rows = []
        for student in students:
            record = existing.get(str(student.uuid))
            rows.append(
                {
                    "student_uuid": str(student.uuid),
                    "student_name": student.user.get_full_name(),
                    "student_code": student.student_id,
                    "roll_number": student.roll_number,
                    "status": record.status if record else None,
                    "remarks": record.remarks if record else "",
                    "attendance_uuid": str(record.uuid) if record else None,
                }
            )
        return Response(
            {
                "section": {
                    "uuid": str(section.uuid),
                    "name": str(section),
                    "school_class": section.school_class.name,
                },
                "date": date.isoformat(),
                "is_future": date > timezone.localdate(),
                "rows": rows,
            }
        )

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """Create or update an entire section's attendance for one day."""
        if not (is_admin(request.user) or "Teacher" in request.user.role_names):
            raise PermissionDenied("Only teachers and administrators can mark attendance.")

        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        section = serializer.validated_data["section_obj"]
        date = serializer.validated_data["date"]
        students = serializer.validated_data["students_by_uuid"]

        if not is_admin(request.user):
            allowed = set(teacher_sections(request.user).values_list("pk", flat=True))
            if section.pk not in allowed:
                raise PermissionDenied("You do not teach this section.")

        created = 0
        updated = 0
        with transaction.atomic():
            for record in serializer.validated_data["records"]:
                student = students[str(record["student"])]
                obj, was_created = Attendance.objects.update_or_create(
                    student=student,
                    date=date,
                    defaults={
                        "section": section,
                        "status": record["status"],
                        "remarks": record.get("remarks", ""),
                        "marked_by": request.user,
                        "is_active": True,
                    },
                )
                created += int(was_created)
                updated += int(not was_created)

        return Response(
            {
                "detail": f"Attendance saved for {section} on {date.isoformat()}.",
                "created": created,
                "updated": updated,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Aggregated attendance for charts and report cards."""
        days = min(int(request.query_params.get("days", 30)), 365)
        start = timezone.localdate() - timedelta(days=days - 1)
        qs = self.get_queryset().filter(date__gte=start)

        section_uuid = request.query_params.get("section")
        if section_uuid:
            qs = qs.filter(section__uuid=section_uuid)
        student_uuid = request.query_params.get("student")
        if student_uuid:
            qs = qs.filter(student__uuid=student_uuid)

        totals = qs.aggregate(
            total=Count("id"),
            present=Count("id", filter=Q(status="present")),
            absent=Count("id", filter=Q(status="absent")),
            late=Count("id", filter=Q(status="late")),
            excused=Count("id", filter=Q(status="excused")),
        )
        total = totals["total"] or 0
        rate = round((totals["present"] + totals["late"]) * 100 / total, 1) if total else 0.0

        daily = (
            qs.values("date")
            .annotate(
                total=Count("id"),
                present=Count("id", filter=Q(status__in=["present", "late"])),
            )
            .order_by("date")
        )
        return Response(
            {
                "totals": {**totals, "attendance_rate": rate},
                "daily": [
                    {
                        "date": row["date"].isoformat(),
                        "total": row["total"],
                        "present": row["present"],
                        "rate": round(row["present"] * 100 / row["total"], 1) if row["total"] else 0,
                    }
                    for row in daily
                ],
                "range_days": days,
            }
        )

    @action(detail=False, methods=["get"], url_path="today")
    def today(self, request):
        qs = self.get_queryset().filter(date=timezone.localdate())
        totals = qs.aggregate(
            total=Count("id"),
            present=Count("id", filter=Q(status__in=["present", "late"])),
            absent=Count("id", filter=Q(status="absent")),
        )
        return Response(totals)


class MyAttendanceView(viewsets.ReadOnlyModelViewSet):
    """Convenience endpoint for students and parents."""

    serializer_class = AttendanceSerializer
    ordering = ["-date"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Attendance.objects.none()
        user = self.request.user
        if "Student" in user.role_names and not is_admin(user):
            return Attendance.objects.filter(student__user=user).select_related(
                "student__user", "section__school_class"
            )
        if "Parent" in user.role_names and not is_admin(user):
            return Attendance.objects.filter(student__in=children_of(user)).select_related(
                "student__user", "section__school_class"
            )
        return Attendance.objects.none()
