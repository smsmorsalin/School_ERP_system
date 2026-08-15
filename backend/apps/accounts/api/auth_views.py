"""
Authentication API Views
==========================================================
Views for user registration, login, and authentication endpoints.
"""

from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth import authenticate
from django.utils import timezone
from apps.accounts.models import User, LoginHistory
from apps.accounts.serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    UserLoginSerializer,
    CustomTokenObtainPairSerializer,
    ChangePasswordSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token view with email support."""
    
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = (AllowAny,)


class RegisterView(views.APIView):
    """
    User registration endpoint.
    
    POST: Register a new user account
    """
    
    permission_classes = (AllowAny,)
    
    def post(self, request, *args, **kwargs):
        """Register a new user."""
        serializer = UserRegistrationSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.save()
            
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'message': 'User registered successfully.',
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(views.APIView):
    """
    User login endpoint.
    
    POST: Authenticate user and return JWT tokens
    """
    
    permission_classes = (AllowAny,)
    
    def post(self, request, *args, **kwargs):
        """Authenticate user and return tokens."""
        serializer = UserLoginSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            # Log login
            ip_address = self._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            
            LoginHistory.objects.create(
                user=user,
                email=user.email,
                status='success',
                ip_address=ip_address,
                user_agent=user_agent,
            )
            
            return Response({
                'message': 'Login successful.',
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_200_OK)
        
        # Log failed login
        email = request.data.get('email', '')
        ip_address = self._get_client_ip(request)
        
        LoginHistory.objects.create(
            email=email,
            status='failed',
            ip_address=ip_address,
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            failure_reason='Invalid credentials',
        )
        
        return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)
    
    @staticmethod
    def _get_client_ip(request):
        """Get client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class LogoutView(views.APIView):
    """
    User logout endpoint.
    
    POST: Invalidate user session/tokens
    """
    
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, *args, **kwargs):
        """Logout user."""
        # Log logout
        ip_address = self._get_client_ip(request)
        
        LoginHistory.objects.create(
            user=request.user,
            email=request.user.email,
            status='logout',
            ip_address=ip_address,
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            logout_time=timezone.now(),
        )
        
        return Response(
            {'message': 'Logout successful.'},
            status=status.HTTP_200_OK
        )
    
    @staticmethod
    def _get_client_ip(request):
        """Get client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class ChangePasswordView(views.APIView):
    """
    Change password endpoint.
    
    POST: Change the authenticated user's password
    """
    
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, *args, **kwargs):
        """Change user password."""
        serializer = ChangePasswordSerializer(data=request.data)
        
        if serializer.is_valid():
            user = request.user
            
            # Verify old password
            if not user.check_password(serializer.validated_data['old_password']):
                return Response(
                    {'old_password': 'Incorrect password.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Set new password
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            return Response(
                {'message': 'Password changed successfully.'},
                status=status.HTTP_200_OK
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(views.APIView):
    """
    Get current user details.
    
    GET: Retrieve authenticated user information
    """
    
    permission_classes = (IsAuthenticated,)
    
    def get(self, request, *args, **kwargs):
        """Get current user details."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def patch(self, request, *args, **kwargs):
        """Update current user details."""
        serializer = UserSerializer(
            request.user,
            data=request.data,
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'message': 'Profile updated successfully.', 'user': serializer.data},
                status=status.HTTP_200_OK
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
