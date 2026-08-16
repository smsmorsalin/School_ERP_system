"""
==========================================================
Accounts Models Package
==========================================================

This package contains all database models related to
authentication and authorization.

Keeping each model in its own file follows the Single
Responsibility Principle and makes the codebase easier
to maintain as it grows.
"""

from .user import User
from .role import Role
from .permission import Permission
from .user_role import UserRole
from .role_permission import RolePermission
from .login_history import LoginHistory

__all__ = [
    "User",
    "Role",
    "Permission",
    "UserRole",
    "RolePermission",
    "LoginHistory",
]