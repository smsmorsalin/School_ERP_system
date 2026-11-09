from django.contrib import admin

from apps.communication.models import Announcement, AnnouncementRead


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "audience", "school_class", "is_published", "is_pinned", "published_at")
    list_filter = ("audience", "is_published", "is_pinned")
    search_fields = ("title", "body")
    autocomplete_fields = ("created_by",)


@admin.register(AnnouncementRead)
class AnnouncementReadAdmin(admin.ModelAdmin):
    list_display = ("announcement", "user", "read_at")
    search_fields = ("announcement__title", "user__email")
