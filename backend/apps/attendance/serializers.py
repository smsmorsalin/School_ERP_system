"""Attendance serializers."""

from django.utils import timezone
from rest_framework import serializers

from apps.academics.models import Section, StudentProfile
from apps.attendance.models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    student = serializers.SlugRelatedField(
        slug_field="uuid", queryset=StudentProfile.objects.filter(is_active=True)
    )
    section = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Section.objects.filter(is_active=True)
    )
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)
    student_uuid = serializers.UUIDField(source="student.uuid", read_only=True)
    section_name = serializers.CharField(source="section.__str__", read_only=True)
    marked_by_name = serializers.CharField(source="marked_by.get_full_name", read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "uuid", "student", "student_uuid", "student_name", "student_code",
            "section", "section_name", "date", "status", "remarks",
            "marked_by", "marked_by_name", "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "marked_by", "created_at", "updated_at"]

    def validate_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("You cannot record attendance for a future date.")
        return value

    def validate(self, attrs):
        student = attrs.get("student", getattr(self.instance, "student", None))
        section = attrs.get("section", getattr(self.instance, "section", None))
        date = attrs.get("date", getattr(self.instance, "date", None))
        if student and section and student.current_section_id != section.id:
            raise serializers.ValidationError(
                {"student": "This student does not belong to the selected section."}
            )
        if student and date:
            qs = Attendance.objects.filter(student=student, date=date)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"date": "Attendance for this student has already been recorded."}
                )
        return attrs


class BulkAttendanceRecordSerializer(serializers.Serializer):
    student = serializers.UUIDField()
    status = serializers.ChoiceField(choices=Attendance.STATUS_CHOICES)
    remarks = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class BulkAttendanceSerializer(serializers.Serializer):
    section = serializers.UUIDField()
    date = serializers.DateField()
    records = serializers.ListField(
        child=BulkAttendanceRecordSerializer(), min_length=1, max_length=200
    )

    def validate_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("You cannot record attendance for a future date.")
        return value

    def validate(self, attrs):
        section = Section.objects.filter(uuid=attrs["section"], is_active=True).first()
        if not section:
            raise serializers.ValidationError({"section": "Section not found."})
        attrs["section_obj"] = section

        seen = set()
        for record in attrs["records"]:
            student_uuid = str(record["student"])
            if student_uuid in seen:
                raise serializers.ValidationError(
                    {"records": "Duplicate students in the same request."}
                )
            seen.add(student_uuid)

        students = {
            str(student.uuid): student
            for student in StudentProfile.objects.filter(
                uuid__in=seen, current_section=section, is_active=True
            )
        }
        missing = seen - set(students.keys())
        if missing:
            raise serializers.ValidationError(
                {"records": "One or more students do not belong to this section."}
            )
        attrs["students_by_uuid"] = students
        return attrs
