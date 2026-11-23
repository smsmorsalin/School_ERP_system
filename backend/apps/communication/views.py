"""Announcement endpoints with audience filtering."""

from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.academics.access import accessible_sections, children_of, student_profile_of
from apps.communication.models import Announcement, AnnouncementRead
from apps.communication.serializers import AnnouncementSerializer
from apps.core.permissions import IsTeacherOrAdmin, is_admin


def visible_announcements(user):
    qs = Announcement.objects.filter(is_active=True, is_published=True).select_related(
        "created_by", "school_class"
    )
    if is_admin(user):
        return Announcement.objects.filter(is_active=True).select_related(
            "created_by", "school_class"
        )
    qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))

    if "Teacher" in user.role_names:
        class_ids = accessible_sections(user).values_list("school_class_id", flat=True)
        return qs.filter(
            Q(audience__in=["all", "teachers", "students"])
            | Q(audience="class", school_class_id__in=class_ids)
        ).distinct()

    if "Student" in user.role_names:
        profile = student_profile_of(user)
        class_id = profile.current_section.school_class_id if profile and profile.current_section else None
        return qs.filter(
            Q(audience__in=["all", "students"])
            | Q(audience="class", school_class_id=class_id)
        )

    if "Parent" in user.role_names:
        class_ids = (
            children_of(user)
            .exclude(current_section__isnull=True)
            .values_list("current_section__school_class_id", flat=True)
        )
        return qs.filter(
            Q(audience__in=["all", "parents"])
            | Q(audience="class", school_class_id__in=class_ids)
        ).distinct()

    if "Accountant" in user.role_names:
        return qs.filter(audience="all")
    return qs.none()


class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    lookup_field = "uuid"
    search_fields = ["title", "body"]
    ordering_fields = ["published_at", "created_at"]
    filterset_fields = ["audience", "is_pinned"]

    def get_permissions(self):
        # Reading an announcement is self-service even though it uses POST.
        if self.action in ("read", "mark_all_read"):
            return super().get_permissions()
        if self.request.method not in ("GET", "HEAD", "OPTIONS"):
            return [IsTeacherOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Announcement.objects.none()
        return visible_announcements(self.request.user).prefetch_related("reads")

    def perform_create(self, serializer):
        user = self.request.user
        if not (is_admin(user) or "Teacher" in user.role_names):
            raise PermissionDenied("Only staff can publish announcements.")
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        if not (is_admin(user) or serializer.instance.created_by_id == user.id):
            raise PermissionDenied("You can only edit your own announcements.")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if not (is_admin(user) or instance.created_by_id == user.id):
            raise PermissionDenied("You can only delete your own announcements.")
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

    @action(detail=True, methods=["post"])
    def read(self, request, uuid=None):
        announcement = self.get_object()
        AnnouncementRead.objects.get_or_create(
            announcement=announcement, user=request.user
        )
        return Response({"detail": "Marked as read."})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        qs = self.get_queryset()
        unread = qs.exclude(reads__user=request.user).count()
        return Response({"unread": unread, "total": qs.count()})

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        qs = self.get_queryset()
        existing = set(
            AnnouncementRead.objects.filter(user=request.user).values_list(
                "announcement_id", flat=True
            )
        )
        new_reads = [
            AnnouncementRead(announcement=announcement, user=request.user)
            for announcement in qs
            if announcement.pk not in existing
        ]
        AnnouncementRead.objects.bulk_create(new_reads, ignore_conflicts=True)
        return Response({"detail": "All announcements marked as read."})
