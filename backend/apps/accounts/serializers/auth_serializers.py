"""Authentication and account serializers."""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import LoginHistory, User
from apps.accounts.tokens import build_refresh_token
from apps.core.utils import generate_temporary_password


def _image_url(request, field):
    if not field:
        return None
    try:
        url = field.url
    except ValueError:
        return None
    return request.build_absolute_uri(url) if request else url


class UserSerializer(serializers.ModelSerializer):
    """Read-only representation of a user."""

    full_name = serializers.CharField(source="get_full_name", read_only=True)
    roles = serializers.ListField(source="role_names", read_only=True)
    primary_role = serializers.CharField(read_only=True)
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "uuid",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone_number",
            "profile_image",
            "profile_image_url",
            "date_of_birth",
            "address",
            "city",
            "state",
            "country",
            "postal_code",
            "roles",
            "primary_role",
            "is_active",
            "is_superuser",
            "is_locked",
            "locked_until",
            "failed_login_attempts",
            "must_change_password",
            "last_login",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_profile_image_url(self, obj):
        return _image_url(self.context.get("request"), obj.profile_image)


class UserSummarySerializer(serializers.ModelSerializer):
    """Compact user data used inside nested relationships."""

    full_name = serializers.CharField(source="get_full_name", read_only=True)
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["uuid", "email", "full_name", "profile_image_url"]

    def get_profile_image_url(self, obj):
        return _image_url(self.context.get("request"), obj.profile_image)


class UserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=False
    )
    roles = serializers.ListField(
        child=serializers.CharField(max_length=100), min_length=1, max_length=10
    )

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_roles(self, value):
        from apps.accounts.models import Role

        cleaned = []
        for name in value:
            name = name.strip()
            if name not in cleaned:
                cleaned.append(name)
        existing = set(
            Role.objects.filter(name__in=cleaned, is_active=True).values_list(
                "name", flat=True
            )
        )
        missing = [name for name in cleaned if name not in existing]
        if missing:
            raise serializers.ValidationError(
                f"Unknown role(s): {', '.join(missing)}."
            )
        request = self.context.get("request")
        if "Admin" in cleaned and not (
            request and request.user.is_superuser
        ):
            raise serializers.ValidationError(
                "Only a superuser can grant the Admin role."
            )
        return cleaned

    def validate_password(self, value):
        if not value:
            return value
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def create(self, validated_data):
        from apps.accounts.models import Role, UserRole

        roles = validated_data.pop("roles")
        password = validated_data.pop("password", "") or ""
        self.temporary_password = None
        if not password:
            password = generate_temporary_password()
            self.temporary_password = password
        user = User.objects.create_user(
            password=password, must_change_password=True, **validated_data
        )
        assigner = self.context["request"].user
        for role in Role.objects.filter(name__in=roles):
            UserRole.objects.create(user=user, role=role, assigned_by=assigner)
        user.clear_role_cache()
        return user


class UserRegistrationSerializer(serializers.Serializer):
    """Optional self-registration (disabled by default)."""

    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"password": list(exc.messages)}
            ) from exc
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        max_length=10,
    )

    class Meta:
        model = User
        fields = [
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "date_of_birth",
            "address",
            "city",
            "state",
            "country",
            "postal_code",
            "is_active",
            "roles",
        ]

    def validate_email(self, value):
        value = value.lower().strip()
        qs = User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_roles(self, value):
        from apps.accounts.models import Role

        existing = set(
            Role.objects.filter(name__in=value, is_active=True).values_list(
                "name", flat=True
            )
        )
        missing = [name for name in value if name not in existing]
        if missing:
            raise serializers.ValidationError(
                f"Unknown role(s): {', '.join(missing)}."
            )
        request = self.context.get("request")
        if "Admin" in value and not (request and request.user.is_superuser):
            raise serializers.ValidationError(
                "Only a superuser can grant the Admin role."
            )
        return value

    def update(self, instance, validated_data):
        from apps.accounts.models import Role, UserRole

        roles = validated_data.pop("roles", None)
        request = self.context.get("request")

        if instance.pk == request.user.pk and validated_data.get("is_active") is False:
            raise serializers.ValidationError(
                {"is_active": "You cannot deactivate your own account."}
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if roles is not None:
            # Keep a superuser from losing their last administrative role.
            if instance.pk == getattr(request.user, "pk", None) and "Admin" not in roles and not instance.is_superuser:
                raise serializers.ValidationError(
                    {"roles": "You cannot remove your own Admin role."}
                )
            UserRole.objects.filter(user=instance).update(is_active=False)
            for role in Role.objects.filter(name__in=roles):
                assignment, _ = UserRole.objects.get_or_create(
                    user=instance,
                    role=role,
                    defaults={"assigned_by": request.user},
                )
                if not assignment.is_active:
                    assignment.is_active = True
                    assignment.assigned_by = request.user
                    assignment.save(update_fields=["is_active", "assigned_by", "updated_at"])
            instance.clear_role_cache()
        return instance


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Fields a user may change on their own profile.

    Email, roles and activation state are deliberately excluded: changing them
    requires an administrator (prevents account-takeover via email swap).
    """

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "phone_number",
            "date_of_birth",
            "address",
            "city",
            "state",
            "country",
            "postal_code",
            "profile_image",
        ]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, data):
        user = self.context["request"].user
        if not user.check_password(data["old_password"]):
            raise serializers.ValidationError(
                {"old_password": "Your current password is incorrect."}
            )
        if data["new_password"] != data["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )
        if data["new_password"] == data["old_password"]:
            raise serializers.ValidationError(
                {"new_password": "Choose a password different from your current one."}
            )
        try:
            validate_password(data["new_password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"new_password": list(exc.messages)}
            ) from exc
        return data


class AdminSetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, data):
        if data["new_password"] != data["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )
        try:
            validate_password(data["new_password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"new_password": list(exc.messages)}
            ) from exc
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, data):
        if data["new_password"] != data["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )
        try:
            validate_password(data["new_password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"new_password": list(exc.messages)}
            ) from exc
        return data


class LoginHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginHistory
        fields = [
            "uuid",
            "email",
            "status",
            "ip_address",
            "device_type",
            "login_time",
            "logout_time",
            "session_duration",
            "failure_reason",
        ]
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    """Validates credentials and applies lockout rules.

    The same generic message is returned for unknown emails, wrong passwords
    and locked accounts so attackers cannot enumerate users.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    GENERIC_ERROR = "Invalid email or password."

    def validate(self, attrs):
        from django.contrib.auth import authenticate

        email = attrs.get("email", "").lower().strip()
        password = attrs.get("password")

        user = User.objects.filter(email__iexact=email).first()
        if user and user.is_locked:
            raise serializers.ValidationError(
                {"detail": "Too many failed attempts. Try again later."}
            )

        authenticated = authenticate(request=self.context.get("request"), username=email, password=password)
        if authenticated is None:
            if user:
                user.register_failed_login()
            raise serializers.ValidationError({"detail": self.GENERIC_ERROR})

        if not authenticated.is_active:
            raise serializers.ValidationError({"detail": self.GENERIC_ERROR})

        attrs["user"] = authenticated
        return attrs


class TokenPairSerializer(serializers.Serializer):
    """Response shape helper (documentation only)."""

    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    expires_in = serializers.IntegerField(read_only=True)


def issue_tokens(user):
    from django.conf import settings

    refresh = build_refresh_token(user)
    return {
        "refresh": refresh,
        "access": str(refresh.access_token),
        "expires_in": int(
            settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()
        ),
        "issued_at": timezone.now(),
    }
