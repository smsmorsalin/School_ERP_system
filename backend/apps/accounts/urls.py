"""
Accounts API URLs
==========================================================
URL routing for accounts app API endpoints.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.api import (
    RegisterView,
    LoginView,
    LogoutView,
    ChangePasswordView,
    CurrentUserView,
    CustomTokenObtainPairView,
    UserViewSet,
)

# Create router for viewsets
router = DefaultRouter()
router.register(r'accounts/users', UserViewSet, basename='user')

app_name = 'v1'

urlpatterns = [
    # Authentication endpoints
    path('accounts/auth/register/', RegisterView.as_view(), name='register'),
    path('accounts/auth/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('accounts/auth/logout/', LogoutView.as_view(), name='logout'),
    path('accounts/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('accounts/auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('accounts/auth/me/', CurrentUserView.as_view(), name='current_user'),
    
    # Viewset routes
    path('', include(router.urls)),
]

