"""
Create initial roles and permissions.
"""

from django.core.management.base import BaseCommand
from apps.accounts.models import Role, Permission, RolePermission


class Command(BaseCommand):
    """Management command to initialize roles and permissions."""
    
    help = 'Create initial roles and permissions for the School ERP'
    
    def handle(self, *args, **options):
        """Execute the command."""
        self.stdout.write(self.style.HTTP_INFO('Creating initial roles and permissions...'))
        
        # Create permissions
        permissions_data = [
            # User Management
            {'code': 'view_user', 'name': 'View User', 'category': 'user_management'},
            {'code': 'add_user', 'name': 'Add User', 'category': 'user_management'},
            {'code': 'change_user', 'name': 'Change User', 'category': 'user_management'},
            {'code': 'delete_user', 'name': 'Delete User', 'category': 'user_management'},
            
            # Role Management
            {'code': 'view_role', 'name': 'View Role', 'category': 'role_management'},
            {'code': 'add_role', 'name': 'Add Role', 'category': 'role_management'},
            {'code': 'change_role', 'name': 'Change Role', 'category': 'role_management'},
            {'code': 'delete_role', 'name': 'Delete Role', 'category': 'role_management'},
            
            # Permission Management
            {'code': 'view_permission', 'name': 'View Permission', 'category': 'permission_management'},
            {'code': 'add_permission', 'name': 'Add Permission', 'category': 'permission_management'},
            {'code': 'change_permission', 'name': 'Change Permission', 'category': 'permission_management'},
            {'code': 'delete_permission', 'name': 'Delete Permission', 'category': 'permission_management'},
            
            # Academic
            {'code': 'view_course', 'name': 'View Course', 'category': 'academic'},
            {'code': 'add_course', 'name': 'Add Course', 'category': 'academic'},
            {'code': 'change_course', 'name': 'Change Course', 'category': 'academic'},
            {'code': 'delete_course', 'name': 'Delete Course', 'category': 'academic'},
            
            # Grades
            {'code': 'view_grade', 'name': 'View Grade', 'category': 'academic'},
            {'code': 'add_grade', 'name': 'Add Grade', 'category': 'academic'},
            {'code': 'change_grade', 'name': 'Change Grade', 'category': 'academic'},
            {'code': 'delete_grade', 'name': 'Delete Grade', 'category': 'academic'},
        ]
        
        created_permissions = {}
        for perm_data in permissions_data:
            perm, created = Permission.objects.get_or_create(
                code=perm_data['code'],
                defaults={
                    'name': perm_data['name'],
                    'category': perm_data['category'],
                }
            )
            created_permissions[perm_data['code']] = perm
            status = 'Created' if created else 'Already exists'
            self.stdout.write(
                self.style.SUCCESS(f"  ✓ {perm_data['code']}: {status}")
            )
        
        # Create roles
        roles_data = [
            {
                'name': 'Admin',
                'description': 'System administrator with full access',
                'is_system_role': True,
                'permissions': [
                    'view_user', 'add_user', 'change_user', 'delete_user',
                    'view_role', 'add_role', 'change_role', 'delete_role',
                    'view_permission', 'add_permission', 'change_permission', 'delete_permission',
                    'view_course', 'add_course', 'change_course', 'delete_course',
                    'view_grade', 'add_grade', 'change_grade', 'delete_grade',
                ]
            },
            {
                'name': 'Teacher',
                'description': 'Teacher with access to courses and grades',
                'is_system_role': True,
                'permissions': [
                    'view_course',
                    'view_grade', 'add_grade', 'change_grade',
                ]
            },
            {
                'name': 'Student',
                'description': 'Student with read-only access to courses and grades',
                'is_system_role': True,
                'permissions': [
                    'view_course',
                    'view_grade',
                ]
            },
            {
                'name': 'Parent',
                'description': 'Parent with access to student grades',
                'is_system_role': True,
                'permissions': [
                    'view_grade',
                ]
            },
        ]
        
        for role_data in roles_data:
            permissions = role_data.pop('permissions', [])
            
            role, created = Role.objects.get_or_create(
                name=role_data['name'],
                defaults=role_data
            )
            status = 'Created' if created else 'Already exists'
            self.stdout.write(
                self.style.SUCCESS(f"  ✓ {role_data['name']}: {status}")
            )
            
            # Assign permissions to role
            for perm_code in permissions:
                if perm_code in created_permissions:
                    RolePermission.objects.get_or_create(
                        role=role,
                        permission=created_permissions[perm_code],
                    )
        
        self.stdout.write(
            self.style.SUCCESS('\n✓ Initial roles and permissions created successfully!')
        )
