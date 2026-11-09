"""Create the built-in roles, permissions and role-permission links."""

from django.core.management.base import BaseCommand

from apps.accounts.models import Permission, Role, RolePermission

PERMISSIONS = [
    # Accounts / RBAC
    ("view_user", "View users", "user_management"),
    ("add_user", "Create users", "user_management"),
    ("change_user", "Edit users", "user_management"),
    ("delete_user", "Deactivate users", "user_management"),
    ("view_role", "View roles", "user_management"),
    ("change_role", "Manage roles", "user_management"),
    ("view_permission", "View permissions", "user_management"),
    # Academics
    ("view_student", "View students", "academic"),
    ("add_student", "Admit students", "academic"),
    ("change_student", "Edit students", "academic"),
    ("delete_student", "Archive students", "academic"),
    ("view_teacher", "View teachers", "academic"),
    ("add_teacher", "Add teachers", "academic"),
    ("change_teacher", "Edit teachers", "academic"),
    ("view_class", "View classes", "academic"),
    ("add_class", "Create classes", "academic"),
    ("change_class", "Edit classes", "academic"),
    ("view_subject", "View subjects", "academic"),
    ("add_subject", "Create subjects", "academic"),
    ("change_subject", "Edit subjects", "academic"),
    ("view_timetable", "View timetable", "academic"),
    ("change_timetable", "Manage timetable", "academic"),
    # Attendance
    ("view_attendance", "View attendance", "attendance"),
    ("mark_attendance", "Mark attendance", "attendance"),
    # Exams
    ("view_exam", "View exams", "exams"),
    ("add_exam", "Create exams", "exams"),
    ("change_exam", "Edit exams", "exams"),
    ("enter_marks", "Enter marks", "exams"),
    ("publish_results", "Publish results", "exams"),
    # Finance
    ("view_fee", "View fees", "finance"),
    ("add_fee", "Create fee structures", "finance"),
    ("change_fee", "Edit fees", "finance"),
    ("view_invoice", "View invoices", "finance"),
    ("add_invoice", "Create invoices", "finance"),
    ("record_payment", "Record payments", "finance"),
    ("view_payment", "View payments", "finance"),
    # Communication
    ("view_announcement", "View announcements", "communication"),
    ("add_announcement", "Publish announcements", "communication"),
    ("change_announcement", "Edit announcements", "communication"),
]

ROLES = {
    "Admin": {
        "description": "Full system access and configuration.",
        "permissions": [code for code, _name, _category in PERMISSIONS],
    },
    "Teacher": {
        "description": "Manage classes, attendance and marks for assigned sections.",
        "permissions": [
            "view_user", "view_student", "view_teacher", "view_class", "view_subject",
            "view_timetable", "view_attendance", "mark_attendance", "view_exam",
            "enter_marks", "view_announcement", "add_announcement", "change_announcement",
        ],
    },
    "Accountant": {
        "description": "Manage fees, invoices and payments.",
        "permissions": [
            "view_student", "view_class", "view_fee", "add_fee", "change_fee",
            "view_invoice", "add_invoice", "record_payment", "view_payment",
            "view_announcement",
        ],
    },
    "Student": {
        "description": "Read-only access to personal academic records.",
        "permissions": [
            "view_subject", "view_timetable", "view_attendance", "view_exam",
            "view_fee", "view_invoice", "view_payment", "view_announcement",
        ],
    },
    "Parent": {
        "description": "Read-only access to their children's records.",
        "permissions": [
            "view_subject", "view_timetable", "view_attendance", "view_exam",
            "view_fee", "view_invoice", "view_payment", "view_announcement",
        ],
    },
}


class Command(BaseCommand):
    help = "Create initial roles and permissions (idempotent)."

    def handle(self, *args, **options):
        self.stdout.write("Creating permissions...")
        permissions = {}
        for code, name, category in PERMISSIONS:
            permission, created = Permission.objects.get_or_create(
                code=code,
                defaults={"name": name, "category": category},
            )
            changed = False
            if permission.name != name:
                permission.name = name
                changed = True
            if permission.category != category:
                permission.category = category
                changed = True
            if changed:
                permission.save(update_fields=["name", "category", "updated_at"])
            permissions[code] = permission
            self.stdout.write(
                f"  {'created' if created else 'exists '}: {code}"
            )

        self.stdout.write("\nCreating roles...")
        for role_name, config in ROLES.items():
            role, created = Role.objects.get_or_create(
                name=role_name,
                defaults={
                    "description": config["description"],
                    "is_system_role": True,
                },
            )
            if not role.is_system_role:
                role.is_system_role = True
                role.save(update_fields=["is_system_role", "updated_at"])
            self.stdout.write(f"  {'created' if created else 'exists '}: {role_name}")

            desired = {permissions[code] for code in config["permissions"]}
            RolePermission.objects.filter(role=role).exclude(
                permission__in=desired
            ).update(is_active=False)
            for permission in desired:
                link, _ = RolePermission.objects.get_or_create(
                    role=role, permission=permission
                )
                if not link.is_active:
                    link.is_active = True
                    link.save(update_fields=["is_active", "updated_at"])

        self.stdout.write(self.style.SUCCESS("\nRoles and permissions are ready."))
