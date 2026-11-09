"""Serializer helpers."""

from rest_framework import serializers


def uuid_related(queryset, required=True, allow_null=False):
    """A relation exposed and accepted as a UUID (never an internal PK)."""
    return serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=queryset,
        required=required,
        allow_null=allow_null,
    )
