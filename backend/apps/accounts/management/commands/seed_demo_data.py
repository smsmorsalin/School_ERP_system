"""Seed a realistic demo school.

Idempotent: running it again only fills in missing records.

Demo accounts (password in parentheses, all must be changed in production):
    admin@school.example       (Admin@12345)
    teacher@school.example     (Teacher@12345)
    accountant@school.example  (Account@12345)
    student@school.example     (Student@12345)
    parent@school.example      (Parent@12345)
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

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
from apps.accounts.models import Role, User, UserRole
from apps.attendance.models import Attendance
from apps.communication.models import Announcement
from apps.exams.models import Exam, ExamResult, ExamSubject
from apps.finance.models import FeeCategory, FeeStructure, Invoice, Payment

FIRST_NAMES = [
    "Aarav", "Aisha", "Bilal", "Chloe", "Daniel", "Elena", "Farhan", "Grace",
    "Hasan", "Isla", "Jasmine", "Kabir", "Layla", "Mason", "Nadia", "Omar",
    "Priya", "Rafiq", "Sara", "Tariq", "Uma", "Victor", "Widad", "Yusuf",
]
LAST_NAMES = [
    "Ahmed", "Begum", "Chen", "Das", "Evans", "Farooq", "Garcia", "Hossain",
    "Ibrahim", "Jackson", "Khan", "Lopez", "Mia", "Noor", "Okafor", "Patel",
]


class Command(BaseCommand):
    help = "Seed demo classes, students, staff, attendance, exams and fees."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-superuser",
            action="store_true",
            help="Create admin@school.example as a superuser if missing.",
        )

    def handle(self, *args, **options):
        call_command("create_initial_roles")
        rng = random.Random(2026)
        today = timezone.localdate()

        year, _ = AcademicYear.objects.get_or_create(
            name="2026-2027",
            defaults={
                "start_date": date(2026, 8, 1),
                "end_date": date(2027, 6, 30),
                "is_current": True,
            },
        )
        if not year.is_current:
            year.is_current = True
            year.save(update_fields=["is_current"])

        # -- classes and sections -----------------------------------------
        classes = {}
        for level, name in [(6, "Grade 6"), (7, "Grade 7"), (8, "Grade 8")]:
            school_class, _ = SchoolClass.objects.get_or_create(
                level=level, defaults={"name": name}
            )
            if school_class.name != name:
                school_class.name = name
                school_class.save(update_fields=["name"])
            classes[level] = school_class

        sections = {}
        for level, school_class in classes.items():
            for section_name in ("A", "B"):
                section, _ = Section.objects.get_or_create(
                    school_class=school_class,
                    name=section_name,
                    defaults={
                        "academic_year": year,
                        "capacity": 35,
                        "room": f"{level}{section_name}",
                    },
                )
                sections[(level, section_name)] = section

        # -- subjects ------------------------------------------------------
        subject_data = [
            ("Mathematics", "MATH", 4),
            ("English", "ENG", 4),
            ("Science", "SCI", 3),
            ("Social Studies", "SOC", 2),
            ("Information Technology", "ICT", 2),
        ]
        subjects = {}
        for name, code, credits in subject_data:
            subject, _ = Subject.objects.get_or_create(
                code=code, defaults={"name": name, "credits": credits}
            )
            subjects[code] = subject

        # -- staff ---------------------------------------------------------
        admin_user = self._user(
            "admin@school.example",
            "System",
            "Administrator",
            "Admin@12345",
            roles=["Admin"],
            is_staff=True,
            is_superuser=options["with_superuser"],
        )
        teacher_user = self._user(
            "teacher@school.example",
            "Amina",
            "Rahman",
            "Teacher@12345",
            roles=["Teacher"],
            is_staff=True,
        )
        accountant_user = self._user(
            "accountant@school.example",
            "Ravi",
            "Sharma",
            "Account@12345",
            roles=["Accountant"],
            is_staff=True,
        )
        extra_teachers = [
            self._user(
                f"teacher{i}@school.example", first, last, "Teacher@12345",
                roles=["Teacher"], is_staff=True,
            )
            for i, (first, last) in enumerate(
                [("Jonas", "Weber"), ("Meera", "Iyer"), ("Samuel", "Okoro")], start=2
            )
        ]
        all_teachers = [teacher_user, *extra_teachers]

        for index, teacher in enumerate(all_teachers):
            profile, _ = TeacherProfile.objects.get_or_create(user=teacher)
            if not profile.qualification:
                profile.qualification = ["M.Ed", "M.Sc", "B.Ed", "M.A"][index % 4]
                profile.specialization = ["Mathematics", "Science", "English", "ICT"][index % 4]
                profile.joining_date = date(2022 + index, 6, 1)
                profile.save()

        # Assign class teachers
        section_list = list(sections.values())
        for index, section in enumerate(section_list):
            teacher = all_teachers[index % len(all_teachers)]
            if section.class_teacher_id != teacher.id:
                section.class_teacher = teacher
                section.save(update_fields=["class_teacher"])

        # Assign subjects to sections
        for index, section in enumerate(section_list):
            for subject_index, subject in enumerate(subjects.values()):
                teacher = all_teachers[(index + subject_index) % len(all_teachers)]
                ClassSubject.objects.get_or_create(
                    section=section,
                    subject=subject,
                    defaults={"teacher": teacher},
                )

        # -- timetable ------------------------------------------------------
        for index, section in enumerate(section_list):
            for day in range(5):
                subject_list = list(subjects.values())
                subject = subject_list[(index + day) % len(subject_list)]
                start = time(8 + day % 3, 0)
                end = time(8 + day % 3, 45)
                TimetableEntry.objects.get_or_create(
                    section=section,
                    day_of_week=day,
                    start_time=start,
                    defaults={
                        "end_time": end,
                        "subject": subject,
                        "teacher": all_teachers[(index + day) % len(all_teachers)],
                        "room": section.room,
                    },
                )

        # -- students -------------------------------------------------------
        students = []
        counter = 0
        for (level, section_name), section in sections.items():
            for roll in range(1, 5):
                first = FIRST_NAMES[counter % len(FIRST_NAMES)]
                last = LAST_NAMES[counter % len(LAST_NAMES)]
                email = f"student{counter + 1}@school.example"
                is_demo_student = (level, section_name, roll) == (6, "A", 1)
                if is_demo_student:
                    email = "student@school.example"
                user = self._user(
                    email, first, last, "Student@12345", roles=["Student"]
                )
                student, _ = StudentProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "student_id": f"STU-2026-{counter + 1:04d}",
                        "admission_date": date(2026, 8, 1),
                        "gender": "female" if counter % 2 else "male",
                        "blood_group": ["A+", "B+", "O+", "AB+"][counter % 4],
                        "current_section": section,
                        "roll_number": roll,
                        "status": "active",
                    },
                )
                if student.current_section_id != section.id:
                    student.current_section = section
                    student.roll_number = roll
                    student.save(update_fields=["current_section", "roll_number"])
                students.append(student)
                counter += 1

        # -- parents --------------------------------------------------------
        parent_specs = [
            ("parent@school.example", "Imran", "Hossain"),
            ("parent2@school.example", "Sadia", "Karim"),
            ("parent3@school.example", "Nadia", "Islam"),
            ("parent4@school.example", "Peter", "Mwangi"),
            ("parent5@school.example", "Lucia", "Fernandez"),
            ("parent6@school.example", "Abdul", "Sattar"),
        ]
        for index, (email, first, last) in enumerate(parent_specs):
            parent_user = self._user(
                email, first, last, "Parent@12345", roles=["Parent"]
            )
            guardian, _ = GuardianProfile.objects.get_or_create(
                user=parent_user,
                defaults={"occupation": ["Engineer", "Doctor", "Teacher", "Business"][index % 4]},
            )
            children = students[index * 4 : index * 4 + 4] or students[:4]
            for child_index, child in enumerate(children):
                GuardianStudent.objects.get_or_create(
                    guardian=guardian,
                    student=child,
                    defaults={
                        "relation": "father" if index % 2 == 0 else "mother",
                        "is_primary": child_index == 0,
                    },
                )

        # -- attendance -----------------------------------------------------
        statuses = ["present"] * 8 + ["present", "late", "absent", "excused"]
        date_cursor = today
        days_done = 0
        while days_done < 12:
            if date_cursor.weekday() < 5:
                for section in section_list:
                    for student in [s for s in students if s.current_section_id == section.id]:
                        Attendance.objects.get_or_create(
                            student=student,
                            date=date_cursor,
                            defaults={
                                "section": section,
                                "status": rng.choice(statuses),
                                "marked_by": section.class_teacher,
                            },
                        )
                days_done += 1
            date_cursor -= timedelta(days=1)

        # -- exams ----------------------------------------------------------
        exam, _ = Exam.objects.get_or_create(
            name="Mid Term Examination 2026",
            defaults={
                "academic_year": year,
                "term": "mid_term",
                "start_date": today - timedelta(days=14),
                "end_date": today - timedelta(days=7),
                "description": "Mid-term assessment covering the first half of the term.",
            },
        )
        if not exam.is_published:
            exam.is_published = True
            exam.published_at = timezone.now()
            exam.published_by = admin_user
            exam.save(update_fields=["is_published", "published_at", "published_by"])

        for section in section_list:
            for subject_index, subject in enumerate(subjects.values()):
                exam_subject, _ = ExamSubject.objects.get_or_create(
                    exam=exam,
                    section=section,
                    subject=subject,
                    defaults={
                        "exam_date": exam.start_date + timedelta(days=subject_index),
                        "max_marks": Decimal("100.00"),
                        "pass_marks": Decimal("40.00"),
                    },
                )
                for student in [s for s in students if s.current_section_id == section.id]:
                    score = Decimal(rng.randint(38, 99))
                    ExamResult.objects.get_or_create(
                        exam_subject=exam_subject,
                        student=student,
                        defaults={"marks_obtained": score, "entered_by": teacher_user},
                    )

        upcoming, _ = Exam.objects.get_or_create(
            name="Annual Examination 2027",
            defaults={
                "academic_year": year,
                "term": "annual",
                "start_date": today + timedelta(days=45),
                "end_date": today + timedelta(days=55),
                "description": "End of year examination.",
            },
        )

        # -- finance --------------------------------------------------------
        categories = {}
        for name in ("Tuition", "Transport", "Library"):
            category, _ = FeeCategory.objects.get_or_create(
                name=name, defaults={"description": f"{name} fees"}
            )
            categories[name] = category

        fee_amounts = {"Tuition": Decimal("4500.00"), "Transport": Decimal("800.00"), "Library": Decimal("300.00")}
        for level, school_class in classes.items():
            for name, category in categories.items():
                structure, _ = FeeStructure.objects.get_or_create(
                    academic_year=year,
                    school_class=school_class,
                    category=category,
                    title=f"{name} Fee - {school_class.name}",
                    defaults={
                        "amount": fee_amounts[name],
                        "due_date": today + timedelta(days=15),
                    },
                )
                for student in [s for s in students if s.current_section and s.current_section.school_class_id == school_class.id]:
                    invoice, created = Invoice.objects.get_or_create(
                        student=student,
                        fee_structure=structure,
                        defaults={
                            "title": structure.title,
                            "amount": structure.amount,
                            "due_date": structure.due_date,
                            "issued_by": accountant_user,
                        },
                    )
                    if created and name == "Tuition":
                        pattern = rng.choice(["full", "partial", "none", "full"])
                        if pattern == "full":
                            Payment.objects.create(
                                invoice=invoice,
                                amount=invoice.amount,
                                method=rng.choice(["cash", "card", "bank_transfer"]),
                                received_by=accountant_user,
                                paid_at=timezone.now() - timedelta(days=rng.randint(1, 25)),
                            )
                        elif pattern == "partial":
                            Payment.objects.create(
                                invoice=invoice,
                                amount=(invoice.amount / 2).quantize(Decimal("0.01")),
                                method="cash",
                                received_by=accountant_user,
                                paid_at=timezone.now() - timedelta(days=rng.randint(1, 20)),
                            )

        # -- announcements --------------------------------------------------
        announcements = [
            (
                "Welcome to the 2026-2027 academic year",
                "Classes begin on 1 August. Please review the updated timetable in your portal.",
                "all",
                True,
            ),
            (
                "Mid-term results published",
                "Mid-term results are now available. Parents can view report cards from the Results page.",
                "all",
                False,
            ),
            (
                "Parent-teacher meeting",
                "Our parent-teacher meeting will be held next Saturday from 9:00 to 12:00 in the main hall.",
                "parents",
                True,
            ),
            (
                "Library book return",
                "All borrowed library books must be returned before the end of the month.",
                "students",
                False,
            ),
        ]
        for title, body, audience, pinned in announcements:
            Announcement.objects.get_or_create(
                title=title,
                defaults={
                    "body": body,
                    "audience": audience,
                    "is_pinned": pinned,
                    "created_by": admin_user,
                },
            )

        self.stdout.write(self.style.SUCCESS("\nDemo data ready."))
        self.stdout.write("Demo accounts:")
        for email, password in [
            ("admin@school.example", "Admin@12345"),
            ("teacher@school.example", "Teacher@12345"),
            ("accountant@school.example", "Account@12345"),
            ("student@school.example", "Student@12345"),
            ("parent@school.example", "Parent@12345"),
        ]:
            self.stdout.write(f"  {email:28} {password}")

    def _user(self, email, first, last, password, roles, is_staff=False, is_superuser=False):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": first,
                "last_name": last,
                "is_staff": is_staff,
                "is_superuser": is_superuser,
            },
        )
        if created:
            user.set_password(password)
            user.save()
        if is_superuser and not user.is_superuser:
            user.is_superuser = True
            user.is_staff = True
            user.save(update_fields=["is_superuser", "is_staff"])
        for role_name in roles:
            role = Role.objects.filter(name=role_name).first()
            if role:
                UserRole.objects.get_or_create(user=user, role=role)
        user.clear_role_cache()
        return user
