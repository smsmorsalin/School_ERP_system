"""Academics serializers."""

import secrets

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import Role, User, UserRole
from apps.accounts.serializers import UserSummarySerializer
from apps.academics.models import (
    AcademicYear,
    ClassSubject,
    GuardianProfile,
    GuardianStudent,
    SchoolClass,
    Section,
    StudentProfile,
    Subject,
    TeacherProfile,
    TimetableEntry,
)


def _generate_temporary_password():
    return f"Edu@{secrets.token_hex(4)}Aa1"


def _ensure_role(user, role_name, assigned_by=None):
    role = Role.objects.filter(name=role_name, is_active=True).first()
    if role:
        UserRole.objects.get_or_create(
            user=user, role=role, defaults={"assigned_by": assigned_by}
        )
        user.clear_role_cache()


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = [
            "uuid", "name", "start_date", "end_date", "is_current", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"end_date": "End date must be after start date."})
        return attrs


class SchoolClassSerializer(serializers.ModelSerializer):
    sections_count = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()

    class Meta:
        model = SchoolClass
        fields = [
            "uuid", "name", "level", "description", "sections_count",
            "students_count", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_sections_count(self, obj):
        return getattr(obj, "sections_count", None) or obj.sections.filter(
            is_active=True
        ).count()

    def get_students_count(self, obj):
        return (
            getattr(obj, "students_count", None)
            or obj.students.filter(is_active=True, status="active").count()
        )


class SectionSerializer(serializers.ModelSerializer):
    school_class = serializers.SlugRelatedField(
        slug_field="uuid", queryset=SchoolClass.objects.all()
    )
    academic_year = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=AcademicYear.objects.all(),
        required=False,
        allow_null=True,
    )
    class_teacher = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=User.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    school_class_name = serializers.CharField(source="school_class.name", read_only=True)
    school_class_uuid = serializers.UUIDField(source="school_class.uuid", read_only=True)
    class_teacher_detail = UserSummarySerializer(source="class_teacher", read_only=True)
    student_count = serializers.SerializerMethodField()
    subject_count = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            "uuid", "school_class", "school_class_name", "school_class_uuid",
            "name", "display_name", "academic_year", "class_teacher",
            "class_teacher_detail", "room", "capacity", "student_count",
            "subject_count", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_display_name(self, obj):
        return str(obj)

    def get_student_count(self, obj):
        annotated = getattr(obj, "student_count", None)
        if annotated is not None:
            return annotated
        return obj.students.filter(is_active=True, status="active").count()

    def get_subject_count(self, obj):
        annotated = getattr(obj, "subject_count", None)
        if annotated is not None:
            return annotated
        return obj.class_subjects.filter(is_active=True).count()

    def validate_class_teacher(self, value):
        if value and not value.has_role("Teacher"):
            raise serializers.ValidationError("The selected user is not a teacher.")
        return value

    def validate(self, attrs):
        capacity = attrs.get("capacity", getattr(self.instance, "capacity", 40))
        if capacity is not None and not 1 <= capacity <= 200:
            raise serializers.ValidationError({"capacity": "Capacity must be between 1 and 200."})
        return attrs


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = [
            "uuid", "name", "code", "description", "credits", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def validate_code(self, value):
        return value.strip().upper()


class ClassSubjectSerializer(serializers.ModelSerializer):
    section = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Section.objects.filter(is_active=True)
    )
    subject = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Subject.objects.filter(is_active=True)
    )
    teacher = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=User.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    section_detail = SectionSerializer(source="section", read_only=True)
    subject_detail = SubjectSerializer(source="subject", read_only=True)
    teacher_detail = UserSummarySerializer(source="teacher", read_only=True)

    class Meta:
        model = ClassSubject
        fields = [
            "uuid", "section", "section_detail", "subject", "subject_detail",
            "teacher", "teacher_detail", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def validate_teacher(self, value):
        if value and not value.has_role("Teacher"):
            raise serializers.ValidationError("The selected user is not a teacher.")
        return value


class TimetableEntrySerializer(serializers.ModelSerializer):
    section = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Section.objects.filter(is_active=True)
    )
    subject = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Subject.objects.filter(is_active=True)
    )
    teacher = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=User.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    section_name = serializers.CharField(source="section.__str__", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    teacher_name = serializers.CharField(source="teacher.get_full_name", read_only=True)
    day_name = serializers.CharField(source="get_day_of_week_display", read_only=True)

    class Meta:
        model = TimetableEntry
        fields = [
            "uuid", "section", "section_name", "subject", "subject_name",
            "teacher", "teacher_name", "day_of_week", "day_name", "start_time",
            "end_time", "room", "is_active",
        ]
        read_only_fields = ["uuid"]

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"end_time": "End time must be after start time."})
        return attrs


class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    current_section = serializers.SlugRelatedField(
        slug_field="uuid", read_only=True
    )
    section_name = serializers.SerializerMethodField()
    section_uuid = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    guardians = serializers.SerializerMethodField()
    attendance_rate = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = [
            "uuid", "user", "student_id", "admission_date", "gender", "blood_group",
            "current_section", "section_uuid", "section_name", "class_name",
            "roll_number", "status", "guardians", "attendance_rate", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_section_name(self, obj):
        return obj.current_section.name if obj.current_section else None

    def get_section_uuid(self, obj):
        return str(obj.current_section.uuid) if obj.current_section else None

    def get_class_name(self, obj):
        return obj.current_section.school_class.name if obj.current_section else None

    def get_guardians(self, obj):
        links = obj.guardian_links.filter(is_active=True).select_related("guardian__user")
        return [
            {
                "uuid": str(link.uuid),
                "guardian_uuid": str(link.guardian.uuid),
                "user_uuid": str(link.guardian.user.uuid),
                "full_name": link.guardian.user.get_full_name(),
                "email": link.guardian.user.email,
                "phone_number": link.guardian.user.phone_number,
                "relation": link.relation,
                "is_primary": link.is_primary,
            }
            for link in links
        ]

    def get_attendance_rate(self, obj):
        records = obj.attendance_records.filter(is_active=True)
        total = records.count()
        if not total:
            return None
        present = records.filter(status__in=["present", "late"]).count()
        return round(present * 100 / total, 1)


class StudentCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=StudentProfile.GENDER_CHOICES, required=False, allow_blank=True)
    blood_group = serializers.CharField(max_length=5, required=False, allow_blank=True)
    admission_date = serializers.DateField(required=False, allow_null=True)
    current_section = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=Section.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    roll_number = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    password = serializers.CharField(required=False, write_only=True, trim_whitespace=False)
    address = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True)
    country = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_password(self, value):
        if value:
            try:
                validate_password(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate(self, attrs):
        section = attrs.get("current_section")
        roll = attrs.get("roll_number")
        if section and roll:
            exists = StudentProfile.objects.filter(
                current_section=section, roll_number=roll
            ).exists()
            if exists:
                raise serializers.ValidationError(
                    {"roll_number": "This roll number is already used in the section."}
                )
            if section.students.filter(is_active=True, status="active").count() >= section.capacity:
                raise serializers.ValidationError(
                    {"current_section": "This section is already at capacity."}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        self.temporary_password = None
        password = validated_data.pop("password", None)
        if not password:
            password = _generate_temporary_password()
            self.temporary_password = password

        user_fields = ["email", "first_name", "last_name", "phone_number", "date_of_birth", "address", "city", "country"]
        user_data = {key: validated_data.pop(key) for key in user_fields if key in validated_data}
        user = User.objects.create_user(password=password, **user_data)
        user.must_change_password = True
        user.save(update_fields=["must_change_password"])
        _ensure_role(user, "Student", self.context["request"].user)

        profile = StudentProfile.objects.create(user=user, **validated_data)
        return profile


class StudentUpdateSerializer(serializers.ModelSerializer):
    current_section = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=Section.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False)
    email = serializers.EmailField(source="user.email", required=False)
    phone_number = serializers.CharField(source="user.phone_number", required=False, allow_blank=True)
    date_of_birth = serializers.DateField(source="user.date_of_birth", required=False, allow_null=True)

    class Meta:
        model = StudentProfile
        fields = [
            "first_name", "last_name", "email", "phone_number", "date_of_birth",
            "admission_date", "gender", "blood_group", "current_section",
            "roll_number", "status", "is_active",
        ]

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exclude(pk=self.instance.user_id).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        section = attrs.get("current_section", getattr(self.instance, "current_section", None))
        roll = attrs.get("roll_number", getattr(self.instance, "roll_number", None))
        if section and roll:
            qs = StudentProfile.objects.filter(current_section=section, roll_number=roll)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"roll_number": "This roll number is already used in the section."}
                )
        return attrs

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        if user_data:
            for field, value in user_data.items():
                setattr(instance.user, field, value)
            instance.user.save()
        return super().update(instance, validated_data)


class TeacherProfileSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    full_name = serializers.CharField(source="user.get_full_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    sections = serializers.SerializerMethodField()

    class Meta:
        model = TeacherProfile
        fields = [
            "uuid", "user", "full_name", "email", "employee_id", "qualification",
            "specialization", "joining_date", "employment_type", "sections",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_sections(self, obj):
        from apps.academics.access import teacher_sections

        return [
            {"uuid": str(section.uuid), "name": str(section)}
            for section in teacher_sections(obj.user)
        ]


class TeacherCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    qualification = serializers.CharField(max_length=150, required=False, allow_blank=True)
    specialization = serializers.CharField(max_length=150, required=False, allow_blank=True)
    joining_date = serializers.DateField(required=False, allow_null=True)
    employment_type = serializers.ChoiceField(
        choices=TeacherProfile._meta.get_field("employment_type").choices,
        required=False,
    )
    password = serializers.CharField(required=False, write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_password(self, value):
        if value:
            try:
                validate_password(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    @transaction.atomic
    def create(self, validated_data):
        self.temporary_password = None
        password = validated_data.pop("password", None)
        if not password:
            password = _generate_temporary_password()
            self.temporary_password = password
        user = User.objects.create_user(
            email=validated_data.pop("email"),
            first_name=validated_data.pop("first_name"),
            last_name=validated_data.pop("last_name"),
            phone_number=validated_data.pop("phone_number", ""),
            password=password,
        )
        user.must_change_password = True
        user.save(update_fields=["must_change_password"])
        _ensure_role(user, "Teacher", self.context["request"].user)
        return TeacherProfile.objects.create(user=user, **validated_data)


class TeacherUpdateSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False)
    email = serializers.EmailField(source="user.email", required=False)
    phone_number = serializers.CharField(source="user.phone_number", required=False, allow_blank=True)

    class Meta:
        model = TeacherProfile
        fields = [
            "first_name", "last_name", "email", "phone_number", "qualification",
            "specialization", "joining_date", "employment_type", "is_active",
        ]

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exclude(pk=self.instance.user_id).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for field, value in user_data.items():
            setattr(instance.user, field, value)
        instance.user.save()
        return super().update(instance, validated_data)


class GuardianLinkSerializer(serializers.ModelSerializer):
    guardian = serializers.SlugRelatedField(
        slug_field="uuid", queryset=GuardianProfile.objects.all()
    )
    student = serializers.SlugRelatedField(
        slug_field="uuid", queryset=StudentProfile.objects.all()
    )
    full_name = serializers.CharField(source="guardian.user.get_full_name", read_only=True)
    email = serializers.EmailField(source="guardian.user.email", read_only=True)
    phone_number = serializers.CharField(source="guardian.user.phone_number", read_only=True)
    user_uuid = serializers.UUIDField(source="guardian.user.uuid", read_only=True)

    class Meta:
        model = GuardianStudent
        fields = [
            "uuid", "guardian", "student", "relation", "is_primary",
            "full_name", "email", "phone_number", "user_uuid", "is_active",
        ]
        read_only_fields = ["uuid"]


class AddGuardianSerializer(serializers.Serializer):
    """Link an existing Parent account to a student."""

    user = serializers.UUIDField(help_text="UUID of an existing user with the Parent role.")
    relation = serializers.ChoiceField(choices=GuardianStudent.RELATION_CHOICES, default="guardian")
    is_primary = serializers.BooleanField(default=False)

    def validate_user(self, value):
        user = User.objects.filter(uuid=value, is_active=True).first()
        if not user:
            raise serializers.ValidationError("User not found.")
        if not user.has_role("Parent"):
            raise serializers.ValidationError(
                "This user does not have the Parent role. Assign the role first."
            )
        return user

    def create(self, validated_data):
        student = self.context["student"]
        user = validated_data["user"]
        guardian, _ = GuardianProfile.objects.get_or_create(user=user)
        if validated_data.get("is_primary"):
            GuardianStudent.objects.filter(student=student).update(is_primary=False)
        link, created = GuardianStudent.objects.get_or_create(
            guardian=guardian,
            student=student,
            defaults={
                "relation": validated_data["relation"],
                "is_primary": validated_data["is_primary"],
            },
        )
        if not created:
            link.relation = validated_data["relation"]
            link.is_primary = validated_data["is_primary"]
            link.is_active = True
            link.save()
        return link
