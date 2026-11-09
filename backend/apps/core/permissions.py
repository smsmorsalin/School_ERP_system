"""Reusable role-based permission classes.

Role checks always hit the database through ``User.role_names`` (cached on the
instance) so a stale JWT can never grant privileges that were revoked.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_admin(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or "Admin" in user.role_names)
    )


def has_any_role(user, *roles) -> bool:
    if not user or not user.is_authenticated:
        return False
    if is_admin(user):
        return True
    names = set(user.role_names)
    return bool(names.intersection(roles))


class IsAdmin(BasePermission):
    message = "Administrator access is required."

    def has_permission(self, request, view):
        return is_admin(request.user)


class IsAdminOrReadOnly(BasePermission):
    message = "Administrators only can modify this resource."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return is_admin(request.user)


class IsStaffMember(BasePermission):
    """Admin, teacher or accountant."""

    message = "Staff access is required."

    def has_permission(self, request, view):
        return has_any_role(request.user, "Teacher", "Accountant")


class IsTeacherOrAdmin(BasePermission):
    message = "Teacher access is required."

    def has_permission(self, request, view):
        return has_any_role(request.user, "Teacher")


class IsAccountantOrAdmin(BasePermission):
    message = "Finance access is required."

    def has_permission(self, request, view):
        return has_any_role(request.user, "Accountant")


class CanViewFinance(BasePermission):
    """Read access to finance data.

    Administrators, accountants, students and parents may read finance
    records (students/parents are additionally scoped to their own invoices by
    the queryset helpers). Teachers and other roles are denied outright.
    """

    message = "Finance access is required."

    def has_permission(self, request, view):
        return has_any_role(request.user, "Accountant", "Student", "Parent")


class IsSelfOrAdmin(BasePermission):
    """Object permission for user-owned objects (``obj.user``)."""

    def has_object_permission(self, request, view, obj):
        owner = getattr(obj, "user", None) or obj
        return is_admin(request.user) or getattr(owner, "pk", None) == request.user.pk


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
