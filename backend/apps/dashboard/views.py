"""Aggregated, role-aware dashboard data."""

from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.access import (
    accessible_sections,
    accessible_students,
    children_of,
    student_profile_of,
    teacher_sections,
)
from apps.academics.models import SchoolClass, Section, StudentProfile, TeacherProfile
from apps.attendance.models import Attendance
from apps.communication.views import visible_announcements
from apps.core.permissions import is_admin
from apps.exams.models import Exam, ExamResult
from apps.finance.models import Invoice, Payment
from apps.finance.views import accessible_invoices, accessible_payments


def _attendance_overview(queryset, days=14):
    start = timezone.localdate() - timedelta(days=days - 1)
    qs = queryset.filter(date__gte=start)
    total = qs.count()
    present = qs.filter(status__in=["present", "late"]).count()
    daily = (
        qs.values("date")
        .annotate(
            total=Count("id"),
            present=Count("id", filter=Q(status__in=["present", "late"])),
        )
        .order_by("date")
    )
    return {
        "rate": round(present * 100 / total, 1) if total else 0,
        "total": total,
        "present": present,
        "absences": qs.filter(status="absent").count(),
        "daily": [
            {
                "date": row["date"].isoformat(),
                "rate": round(row["present"] * 100 / row["total"], 1) if row["total"] else 0,
            }
            for row in daily
        ],
    }


def _fee_overview(invoices):
    invoices = invoices.filter(is_active=True)
    active = invoices.exclude(status="cancelled")
    totals = active.aggregate(billed=Sum("amount"), paid=Sum("amount_paid"))
    billed = totals["billed"] or 0
    paid = totals["paid"] or 0
    overdue = active.filter(
        status__in=["unpaid", "partial"], due_date__lt=timezone.localdate()
    )
    return {
        "billed": float(billed),
        "collected": float(paid),
        "outstanding": float(max(billed - paid, 0)),
        "overdue_count": overdue.count(),
        "overdue_amount": float(overdue.aggregate(total=Sum("amount"))["total"] or 0),
        "invoice_count": active.count(),
    }


def _collection_trend(days=180):
    start = timezone.now() - timedelta(days=days)
    rows = (
        Payment.objects.filter(is_active=True, paid_at__gte=start)
        .annotate(month=TruncMonth("paid_at"))
        .values("month")
        .annotate(total=Sum("amount"))
        .order_by("month")
    )
    return [
        {
            "month": row["month"].strftime("%b %Y") if row["month"] else "",
            "total": float(row["total"] or 0),
        }
        for row in rows
    ]


class DashboardOverviewView(APIView):
    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        user = request.user
        today = timezone.localdate()
        announcements = visible_announcements(user)[:5]

        payload = {
            "role": user.primary_role,
            "generated_at": timezone.now().isoformat(),
            "announcements": [
                {
                    "uuid": str(item.uuid),
                    "title": item.title,
                    "published_at": item.published_at,
                    "is_pinned": item.is_pinned,
                    "audience": item.audience,
                }
                for item in announcements
            ],
            "unread_announcements": visible_announcements(user)
            .exclude(reads__user=user)
            .count(),
        }

        if is_admin(user):
            students = StudentProfile.objects.filter(is_active=True, status="active")
            teachers = TeacherProfile.objects.filter(is_active=True)
            attendance_today = Attendance.objects.filter(date=today)
            payload.update(
                {
                    "stats": {
                        "students": students.count(),
                        "teachers": teachers.count(),
                        "classes": SchoolClass.objects.filter(is_active=True).count(),
                        "sections": Section.objects.filter(is_active=True).count(),
                        "attendance_today_rate": round(
                            attendance_today.filter(status__in=["present", "late"]).count()
                            * 100
                            / attendance_today.count(),
                            1,
                        )
                        if attendance_today.count()
                        else 0,
                    },
                    "attendance": _attendance_overview(Attendance.objects.all()),
                    "fees": _fee_overview(Invoice.objects.all()),
                    "collection_trend": _collection_trend(),
                    "upcoming_exams": self._upcoming_exams(Exam.objects.all()),
                    "recent_admissions": [
                        {
                            "uuid": str(student.uuid),
                            "name": student.user.get_full_name(),
                            "student_id": student.student_id,
                            "section": str(student.current_section)
                            if student.current_section
                            else None,
                            "created_at": student.created_at,
                        }
                        for student in students.select_related("user", "current_section").order_by(
                            "-created_at"
                        )[:5]
                    ],
                    "grade_distribution": self._grade_distribution(
                        ExamResult.objects.all()
                    ),
                    "class_distribution": [
                        {
                            "name": row["current_section__school_class__name"],
                            "count": row["count"],
                        }
                        for row in students.values("current_section__school_class__name")
                        .annotate(count=Count("id"))
                        .order_by("-count")
                        if row["current_section__school_class__name"]
                    ],
                }
            )
            return Response(payload)

        if "Teacher" in user.role_names:
            sections = teacher_sections(user)
            student_ids = StudentProfile.objects.filter(
                current_section__in=sections, is_active=True
            )
            today_marked = Attendance.objects.filter(
                section__in=sections, date=today
            ).count()
            payload.update(
                {
                    "stats": {
                        "my_sections": sections.count(),
                        "my_students": student_ids.count(),
                        "marked_today": today_marked,
                        "pending_marks": ExamResult.objects.filter(
                            exam_subject__section__in=sections, grade=""
                        ).count(),
                    },
                    "attendance": _attendance_overview(
                        Attendance.objects.filter(section__in=sections)
                    ),
                    "sections": [
                        {
                            "uuid": str(section.uuid),
                            "name": str(section),
                            "students": section.students.filter(
                                is_active=True, status="active"
                            ).count(),
                        }
                        for section in sections.select_related("school_class")
                    ],
                    "upcoming_exams": self._upcoming_exams(
                        Exam.objects.filter(
                            exam_subjects__section__in=sections, is_published=False
                        ).distinct()
                    ),
                    "grade_distribution": self._grade_distribution(
                        ExamResult.objects.filter(exam_subject__section__in=sections)
                    ),
                }
            )
            return Response(payload)

        if "Accountant" in user.role_names:
            payload.update(
                {
                    "stats": {
                        "invoices": Invoice.objects.filter(is_active=True).count(),
                        "unpaid": Invoice.objects.filter(
                            is_active=True, status__in=["unpaid", "partial"]
                        ).count(),
                        "overdue": Invoice.objects.filter(
                            is_active=True,
                            status__in=["unpaid", "partial"],
                            due_date__lt=today,
                        ).count(),
                        "students": StudentProfile.objects.filter(
                            is_active=True, status="active"
                        ).count(),
                    },
                    "fees": _fee_overview(Invoice.objects.all()),
                    "collection_trend": _collection_trend(),
                    "recent_payments": [
                        {
                            "uuid": str(payment.uuid),
                            "receipt_number": payment.receipt_number,
                            "amount": float(payment.amount),
                            "student": payment.invoice.student.user.get_full_name(),
                            "paid_at": payment.paid_at,
                        }
                        for payment in Payment.objects.filter(is_active=True)
                        .select_related("invoice__student__user")
                        .order_by("-paid_at")[:6]
                    ],
                }
            )
            return Response(payload)

        # Student / parent
        students = accessible_students(user)
        attendance = Attendance.objects.filter(student__in=students)
        invoices = accessible_invoices(user)
        payload.update(
            {
                "stats": {
                    "children": students.count() if "Parent" in user.role_names else None,
                    "attendance_rate": round(
                        attendance.filter(status__in=["present", "late"]).count()
                        * 100
                        / attendance.count(),
                        1,
                    )
                    if attendance.count()
                    else 0,
                    "outstanding_fees": float(
                        _fee_overview(invoices)["outstanding"]
                    ),
                },
                "attendance": _attendance_overview(attendance, days=30),
                "fees": _fee_overview(invoices),
                "children": [
                    {
                        "uuid": str(student.uuid),
                        "name": student.user.get_full_name(),
                        "student_id": student.student_id,
                        "section": str(student.current_section)
                        if student.current_section
                        else None,
                        "attendance_rate": self._student_attendance_rate(student),
                    }
                    for student in students.select_related(
                        "user", "current_section__school_class"
                    )
                ],
                "latest_results": [
                    {
                        "subject": result.exam_subject.subject.name,
                        "exam": result.exam_subject.exam.name,
                        "marks": float(result.marks_obtained),
                        "max_marks": float(result.exam_subject.max_marks),
                        "grade": result.grade,
                    }
                    for result in ExamResult.objects.filter(
                        student__in=students, exam_subject__exam__is_published=True
                    )
                    .select_related("exam_subject__subject", "exam_subject__exam")
                    .order_by("-exam_subject__exam__start_date")[:6]
                ],
                "upcoming_exams": self._upcoming_exams(
                    Exam.objects.filter(
                        exam_subjects__section__in=students.exclude(
                            current_section__isnull=True
                        ).values_list("current_section_id", flat=True)
                    ).distinct()
                ),
            }
        )
        return Response(payload)

    @staticmethod
    def _student_attendance_rate(student):
        records = student.attendance_records.filter(is_active=True)
        total = records.count()
        if not total:
            return 0
        return round(
            records.filter(status__in=["present", "late"]).count() * 100 / total, 1
        )

    @staticmethod
    def _upcoming_exams(qs):
        today = timezone.localdate()
        return [
            {
                "uuid": str(exam.uuid),
                "name": exam.name,
                "term": exam.get_term_display(),
                "start_date": exam.start_date,
                "end_date": exam.end_date,
                "is_published": exam.is_published,
            }
            for exam in qs.filter(end_date__gte=today).order_by("start_date")[:5]
        ]

    @staticmethod
    def _grade_distribution(qs):
        return [
            {"grade": row["grade"], "count": row["count"]}
            for row in qs.exclude(grade="")
            .values("grade")
            .annotate(count=Count("id"))
            .order_by("grade")
        ]


class GlobalSearchView(APIView):
    """Small, permission-safe search used by the top bar."""

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        if len(query) < 2:
            return Response({"students": [], "classes": []})

        user = request.user
        results = {"students": [], "classes": []}

        students = accessible_students(user).filter(
            Q(user__first_name__icontains=query)
            | Q(user__last_name__icontains=query)
            | Q(student_id__icontains=query)
            | Q(user__email__icontains=query)
        ).select_related("user", "current_section__school_class")[:6]
        results["students"] = [
            {
                "uuid": str(student.uuid),
                "name": student.user.get_full_name(),
                "student_id": student.student_id,
                "section": str(student.current_section)
                if student.current_section
                else None,
            }
            for student in students
        ]

        if is_admin(user) or "Teacher" in user.role_names or "Accountant" in user.role_names:
            sections = accessible_sections(user).filter(
                Q(name__icontains=query) | Q(school_class__name__icontains=query)
            )[:6]
            results["classes"] = [
                {"uuid": str(section.uuid), "name": str(section)}
                for section in sections
            ]
        return Response(results)


class HealthView(APIView):
    """Lightweight liveness probe (no sensitive details)."""

    permission_classes = []
    authentication_classes = []

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        from django.db import connection

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            database = "ok"
        except Exception:
            database = "error"
        return Response({"status": "ok" if database == "ok" else "degraded", "database": database})
