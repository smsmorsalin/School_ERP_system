from rest_framework import serializers

from apps.academics.models import SchoolClass
from apps.communication.models import Announcement


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by = serializers.SlugRelatedField(slug_field="uuid", read_only=True)
    school_class = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=SchoolClass.objects.all(),
        required=False,
        allow_null=True,
    )
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    audience_display = serializers.CharField(source="get_audience_display", read_only=True)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            "uuid", "title", "body", "audience", "audience_display",
            "school_class", "class_name", "is_published", "is_pinned",
            "published_at", "expires_at", "created_by", "created_by_name",
            "is_read", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "created_by", "created_at", "updated_at"]

    def get_is_read(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.reads.filter(user=request.user).exists()

    def validate(self, attrs):
        audience = attrs.get("audience", getattr(self.instance, "audience", "all"))
        school_class = attrs.get("school_class", getattr(self.instance, "school_class", None))
        if audience == "class" and not school_class:
            raise serializers.ValidationError(
                {"school_class": "Select a class when the audience is a specific class."}
            )

        request = self.context.get("request")
        if request and "Admin" not in request.user.role_names and not request.user.is_superuser:
            from apps.academics.access import accessible_sections

            allowed_classes = set(
                accessible_sections(request.user)
                .exclude(school_class__isnull=True)
                .values_list("school_class_id", flat=True)
            )
            if audience == "class" and (not school_class or school_class.pk not in allowed_classes):
                raise serializers.ValidationError(
                    {"school_class": "You can only announce to classes you teach."}
                )
            if audience in ("all", "teachers"):
                raise serializers.ValidationError(
                    {"audience": "Teachers can publish only to their own classes or students."}
                )
        return attrs
