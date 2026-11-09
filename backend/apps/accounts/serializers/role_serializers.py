"""Role & permission serializers."""

from rest_framework import serializers

from apps.accounts.models import Permission, Role, RolePermission


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["uuid", "code", "name", "description", "category", "is_active"]
        read_only_fields = fields


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    permission_codes = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    user_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Role
        fields = [
            "uuid",
            "name",
            "description",
            "is_system_role",
            "is_active",
            "permissions",
            "permission_codes",
            "user_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "is_system_role", "created_at", "updated_at"]

    def get_permissions(self, obj):
        assignments = [
            assignment
            for assignment in obj.role_permissions.all()
            if assignment.is_active and assignment.permission.is_active
        ]
        return PermissionSerializer(
            [assignment.permission for assignment in assignments], many=True
        ).data

    def validate_permission_codes(self, value):
        existing = set(
            Permission.objects.filter(code__in=value, is_active=True).values_list(
                "code", flat=True
            )
        )
        missing = [code for code in value if code not in existing]
        if missing:
            raise serializers.ValidationError(
                f"Unknown permission(s): {', '.join(missing)}."
            )
        return value

    def _sync_permissions(self, role, codes):
        RolePermission.objects.filter(role=role).update(is_active=False)
        for permission in Permission.objects.filter(code__in=codes):
            assignment, _ = RolePermission.objects.get_or_create(
                role=role, permission=permission
            )
            if not assignment.is_active:
                assignment.is_active = True
                assignment.save(update_fields=["is_active", "updated_at"])

    def create(self, validated_data):
        codes = validated_data.pop("permission_codes", [])
        role = Role.objects.create(**validated_data)
        self._sync_permissions(role, codes)
        return role

    def update(self, instance, validated_data):
        codes = validated_data.pop("permission_codes", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if codes is not None:
            self._sync_permissions(instance, codes)
        return instance
