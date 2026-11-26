"""Serializer for the school-wide customisation settings."""

from rest_framework import serializers

from apps.core.models import SchoolSettings


def _image_url(request, field):
    if not field:
        return None
    try:
        url = field.url
    except ValueError:
        return None
    return request.build_absolute_uri(url) if request else url


class SchoolSettingsSerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(write_only=True, required=False, allow_null=True)
    logo_url = serializers.SerializerMethodField()
    remove_logo = serializers.BooleanField(write_only=True, required=False)
    favicon = serializers.ImageField(write_only=True, required=False, allow_null=True)
    favicon_url = serializers.SerializerMethodField()
    remove_favicon = serializers.BooleanField(write_only=True, required=False)
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SchoolSettings
        fields = [
            "school_name",
            "short_name",
            "tagline",
            "address",
            "phone",
            "email",
            "website",
            "logo",
            "logo_url",
            "remove_logo",
            "favicon",
            "favicon_url",
            "remove_favicon",
            "login_headline",
            "login_subtext",
            "login_notice",
            "accent",
            "default_theme",
            "compact_tables",
            "updated_by_name",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def get_logo_url(self, obj):
        return _image_url(self.context.get("request"), obj.logo)

    def get_favicon_url(self, obj):
        return _image_url(self.context.get("request"), obj.favicon)

    def get_updated_by_name(self, obj):
        if not obj.updated_by_id:
            return None
        return obj.updated_by.get_full_name() or obj.updated_by.email

    def update(self, instance, validated_data):
        for field in ("logo", "favicon"):
            remove = validated_data.pop(f"remove_{field}", False)
            supplied = field in validated_data
            new_file = validated_data.get(field)
            current = getattr(instance, field)
            if current and (remove or (supplied and new_file is None)):
                current.delete(save=False)
                setattr(instance, field, None)
            elif new_file and current:
                # Replace rather than orphan the previous file on disk.
                current.delete(save=False)
        return super().update(instance, validated_data)
