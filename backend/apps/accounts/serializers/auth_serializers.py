"""
Authentication Serializers
==========================================================
Serializers for user registration, login, and token management.
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError
from apps.accounts.models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'uuid',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone_number',
            'profile_image',
            'date_of_birth',
            'address',
            'city',
            'state',
            'country',
            'postal_code',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'uuid',
            'is_active',
            'created_at',
            'updated_at',
        ]
    
    def get_full_name(self, obj):
        """Return the full name of the user."""
        return obj.get_full_name()


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        min_length=8,
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        min_length=8,
    )
    
    class Meta:
        model = User
        fields = [
            'email',
            'first_name',
            'last_name',
            'password',
            'password_confirm',
            'phone_number',
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
        }
    
    def validate(self, data):
        """Validate password confirmation."""
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })
        
        # Check password strength
        if len(data['password']) < 8:
            raise serializers.ValidationError({
                'password': 'Password must be at least 8 characters long.'
            })
        
        return data
    
    def validate_email(self, value):
        """Validate unique email."""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Email already exists.')
        return value
    
    def create(self, validated_data):
        """Create a new user."""
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        
        return user


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login."""
    
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
    )
    
    def validate(self, data):
        """Authenticate user credentials."""
        email = data.get('email')
        password = data.get('password')
        
        # Authenticate using email
        user = authenticate(username=email, password=password)
        
        if user is None:
            raise serializers.ValidationError({
                'email': 'Invalid email or password.'
            })
        
        if not user.is_active:
            raise serializers.ValidationError({
                'email': 'User account is inactive.'
            })
        
        data['user'] = user
        return data


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer with user data."""
    
    def get_token(cls, user):
        """Get token and add custom claims."""
        token = super().get_token(user)
        
        # Add custom claims
        token['email'] = user.email
        token['full_name'] = user.get_full_name()
        
        return token
    
    @classmethod
    def get_token(cls, user):
        """Override to add custom claims."""
        token = super().get_token(user)
        
        token['email'] = user.email
        token['full_name'] = user.get_full_name()
        
        return token
    
    def validate(self, attrs):
        """Validate using email instead of username."""
        # Get user by email
        try:
            user = User.objects.get(email=attrs['username'])
            attrs['username'] = user.username or user.email
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {'email': 'Invalid email or password.'}
            )
        
        return super().validate(attrs)


class TokenRefreshResponseSerializer(serializers.Serializer):
    """Serializer for token refresh response."""
    
    access = serializers.CharField()
    refresh = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing user password."""
    
    old_password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
    )
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        min_length=8,
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        min_length=8,
    )
    
    def validate(self, data):
        """Validate password fields."""
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': 'Passwords do not match.'
            })
        
        return data
