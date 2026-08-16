"""
User API Views
==========================================================
Views for user management operations.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer


class UserViewSet(viewsets.ModelViewSet):
    """
    UserViewSet for managing users.
    
    - List all users (admin only)
    - Create new user (admin only)
    - Retrieve user details
    - Update user
    - Delete user (admin only)
    """
    
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'uuid'
    
    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['create', 'destroy', 'list']:
            # Only admin can create, delete, and list
            permission_classes = [permissions.IsAdminUser]
        else:
            permission_classes = [permissions.IsAuthenticated]
        
        return [permission() for permission in permission_classes]
    
    def list(self, request, *args, **kwargs):
        """List all active users."""
        return super().list(request, *args, **kwargs)
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve specific user details."""
        return super().retrieve(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """Update user details."""
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """Partial update of user details."""
        return super().partial_update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete user (mark as inactive)."""
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        
        return Response(
            {'message': 'User deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )
