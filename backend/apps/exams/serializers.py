"""Exam serializers."""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.academics.models import (
    AcademicYear,
    ClassSubject,
    Section,
    StudentProfile,
    Subject,
)
from apps.exams.models import Exam, ExamResult, ExamSubject
from apps.exams.utils import grade_for_percentage


class ExamSerializer(serializers.ModelSerializer):
    academic_year = serializers.SlugRelatedField(
        slug_field="uuid", queryset=AcademicYear.objects.all()
    )
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    subject_count = serializers.IntegerField(read_only=True)
    section_count = serializers.IntegerField(read_only=True)
    result_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Exam
        fields = [
            "uuid", "name", "academic_year", "academic_year_name", "term",
            "start_date", "end_date", "description", "is_published",
            "published_at", "subject_count", "section_count", "result_count",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = [
            "uuid", "is_published", "published_at", "created_at", "updated_at",
        ]

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})
        return attrs


class ExamSubjectSerializer(serializers.ModelSerializer):
    exam = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Exam.objects.all()
    )
    section = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Section.objects.filter(is_active=True)
    )
    subject = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Subject.objects.filter(is_active=True)
    )
    exam_name = serializers.CharField(source="exam.name", read_only=True)
    exam_uuid = serializers.UUIDField(source="exam.uuid", read_only=True)
    section_name = serializers.CharField(source="section.__str__", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    teacher_name = serializers.SerializerMethodField()
    result_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ExamSubject
        fields = [
            "uuid", "exam", "exam_name", "exam_uuid", "section", "section_name",
            "subject", "subject_name", "subject_code", "teacher_name",
            "exam_date", "start_time", "max_marks", "pass_marks", "result_count",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def get_teacher_name(self, obj) -> str | None:
        assignment = (
            ClassSubject.objects.filter(section=obj.section, subject=obj.subject)
            .select_related("teacher")
            .first()
        )
        return assignment.teacher.get_full_name() if assignment and assignment.teacher else None

    def validate(self, attrs):
        exam = attrs.get("exam", getattr(self.instance, "exam", None))
        section = attrs.get("section", getattr(self.instance, "section", None))
        subject = attrs.get("subject", getattr(self.instance, "subject", None))
        max_marks = attrs.get("max_marks", getattr(self.instance, "max_marks", 100))
        pass_marks = attrs.get("pass_marks", getattr(self.instance, "pass_marks", 40))
        exam_date = attrs.get("exam_date", getattr(self.instance, "exam_date", None))

        if max_marks is not None and max_marks <= 0:
            raise serializers.ValidationError({"max_marks": "Must be greater than zero."})
        if pass_marks is not None and max_marks is not None and pass_marks > max_marks:
            raise serializers.ValidationError({"pass_marks": "Cannot exceed maximum marks."})
        if exam and exam_date and not (exam.start_date <= exam_date <= exam.end_date):
            raise serializers.ValidationError(
                {"exam_date": "Exam date must fall inside the exam window."}
            )
        if section and subject:
            qs = ExamSubject.objects.filter(section=section, subject=subject)
            if exam:
                qs = qs.filter(exam=exam)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"subject": "This subject is already added to the exam for this section."}
                )
        return attrs


class ExamResultSerializer(serializers.ModelSerializer):
    exam_subject = serializers.SlugRelatedField(
        slug_field="uuid", queryset=ExamSubject.objects.all()
    )
    entered_by = serializers.SlugRelatedField(slug_field="uuid", read_only=True)
    student = serializers.SlugRelatedField(
        slug_field="uuid", queryset=StudentProfile.objects.filter(is_active=True)
    )
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)
    student_uuid = serializers.UUIDField(source="student.uuid", read_only=True)
    subject_name = serializers.CharField(source="exam_subject.subject.name", read_only=True)
    subject_code = serializers.CharField(source="exam_subject.subject.code", read_only=True)
    exam_name = serializers.CharField(source="exam_subject.exam.name", read_only=True)
    max_marks = serializers.DecimalField(
        source="exam_subject.max_marks", max_digits=6, decimal_places=2, read_only=True
    )
    percentage = serializers.FloatField(read_only=True)
    is_pass = serializers.SerializerMethodField()

    class Meta:
        model = ExamResult
        fields = [
            "uuid", "exam_subject", "exam_name", "student", "student_uuid",
            "student_name", "student_code", "subject_name", "subject_code",
            "marks_obtained", "max_marks", "percentage", "grade", "is_pass",
            "remarks", "entered_by", "created_at", "updated_at",
        ]
        read_only_fields = ["uuid", "grade", "entered_by", "created_at", "updated_at"]

    def get_is_pass(self, obj) -> bool:
        return obj.percentage >= 40

    def validate(self, attrs):
        exam_subject = attrs.get("exam_subject", getattr(self.instance, "exam_subject", None))
        student = attrs.get("student", getattr(self.instance, "student", None))
        marks = attrs.get("marks_obtained", getattr(self.instance, "marks_obtained", None))

        if exam_subject and student:
            if student.current_section_id != exam_subject.section_id:
                raise serializers.ValidationError(
                    {"student": "This student is not in the exam's section."}
                )
            qs = ExamResult.objects.filter(exam_subject=exam_subject, student=student)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"student": "A result for this student already exists."}
                )
        if exam_subject and marks is not None:
            if marks < 0:
                raise serializers.ValidationError({"marks_obtained": "Marks cannot be negative."})
            if marks > exam_subject.max_marks:
                raise serializers.ValidationError(
                    {"marks_obtained": f"Marks cannot exceed {exam_subject.max_marks}."}
                )
        return attrs


class BulkResultRowSerializer(serializers.Serializer):
    student = serializers.UUIDField()
    marks_obtained = serializers.DecimalField(max_digits=6, decimal_places=2)
    remarks = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class BulkResultSerializer(serializers.Serializer):
    exam_subject = serializers.UUIDField()
    results = serializers.ListField(child=BulkResultRowSerializer(), min_length=1, max_length=300)

    def validate(self, attrs):
        exam_subject = (
            ExamSubject.objects.select_related("exam", "section")
            .filter(uuid=attrs["exam_subject"])
            .first()
        )
        if not exam_subject:
            raise serializers.ValidationError({"exam_subject": "Exam subject not found."})
        if exam_subject.exam.is_published:
            raise serializers.ValidationError(
                {"exam_subject": "Results are published and can no longer be edited."}
            )

        seen = set()
        for row in attrs["results"]:
            student_uuid = str(row["student"])
            if student_uuid in seen:
                raise serializers.ValidationError({"results": "Duplicate students in request."})
            seen.add(student_uuid)
            if row["marks_obtained"] < 0 or row["marks_obtained"] > exam_subject.max_marks:
                raise serializers.ValidationError(
                    {"results": f"Marks must be between 0 and {exam_subject.max_marks}."}
                )

        students = {
            str(student.uuid): student
            for student in StudentProfile.objects.filter(
                uuid__in=seen,
                current_section=exam_subject.section,
                is_active=True,
            )
        }
        if len(students) != len(seen):
            raise serializers.ValidationError(
                {"results": "One or more students do not belong to this section."}
            )
        attrs["exam_subject_obj"] = exam_subject
        attrs["students_by_uuid"] = students
        return attrs
