# Backend Architecture Overview

## Project Structure

```
SchoolERP/
├── backend/
│   ├── apps/
│   │   ├── accounts/              # User management and authentication
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── user.py        # Custom User model
│   │   │   │   ├── role.py        # Role model
│   │   │   │   ├── permission.py  # Permission model
│   │   │   │   ├── user_role.py   # User-Role junction
│   │   │   │   ├── role_permission.py  # Role-Permission junction
│   │   │   │   └── login_history.py # Login tracking
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth_views.py  # Authentication views
│   │   │   │   └── user_views.py  # User management views
│   │   │   ├── serializers/
│   │   │   │   ├── __init__.py
│   │   │   │   └── auth_serializers.py
│   │   │   ├── management/
│   │   │   │   └── commands/
│   │   │   │       └── create_initial_roles.py
│   │   │   ├── admin.py           # Django admin configuration
│   │   │   ├── urls.py            # URL routing
│   │   │   └── apps.py
│   │   │
│   │   └── core/                  # Core utilities
│   │       └── models/
│   │           └── base_model.py  # Abstract base model
│   │
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py            # Common settings
│   │   │   ├── development.py     # Development settings
│   │   │   └── production.py      # Production settings
│   │   ├── urls.py                # Project URL routing
│   │   ├── wsgi.py
│   │   └── asgi.py
│   │
│   ├── logs/                      # Application logs
│   ├── media/                     # User uploads
│   ├── static/                    # Static files
│   ├── templates/                 # HTML templates
│   ├── manage.py
│   ├── requirements.txt
│   └── .env                       # Environment variables
│
├── frontend/                      # React/Vue frontend (future)
├── docs/                          # Documentation
└── API_DOCUMENTATION.md           # API reference
```

---

## Architecture Layers

### 1. **Models Layer** (`apps/accounts/models/`)
Defines database schema and business logic

**Key Models:**
- `User` - Custom user model extending Django's AbstractUser
- `Role` - Role definitions for RBAC
- `Permission` - Fine-grained permission definitions
- `UserRole` - Junction table for User-Role relationships
- `RolePermission` - Junction table for Role-Permission relationships
- `LoginHistory` - Audit trail for login attempts
- `BaseModel` - Abstract base model with common fields (uuid, timestamps, soft delete)

### 2. **Serializers Layer** (`apps/accounts/serializers/`)
Data validation and transformation for API requests/responses

**Key Serializers:**
- `UserSerializer` - User data representation
- `UserRegistrationSerializer` - Registration validation
- `UserLoginSerializer` - Login credential validation
- `CustomTokenObtainPairSerializer` - JWT token generation with custom claims
- `ChangePasswordSerializer` - Password change validation

### 3. **API Views Layer** (`apps/accounts/api/`)
HTTP endpoints and business logic

**Key Views:**
- `RegisterView` - User registration endpoint
- `LoginView` - User authentication endpoint
- `LogoutView` - User logout with session tracking
- `ChangePasswordView` - Password change endpoint
- `CurrentUserView` - Get/update current user profile
- `UserViewSet` - User management CRUD operations
- `CustomTokenObtainPairView` - JWT token issuance with email support

### 4. **URL Routing** (`apps/accounts/urls.py`)
Maps endpoints to views

**URL Pattern:**
```
/api/v1/accounts/auth/register/       - User registration
/api/v1/accounts/auth/login/          - User login
/api/v1/accounts/auth/logout/         - User logout
/api/v1/accounts/auth/token/refresh/  - Refresh JWT token
/api/v1/accounts/auth/change-password/- Change password
/api/v1/accounts/auth/me/             - Get current user
/api/v1/accounts/users/               - List/create users
/api/v1/accounts/users/{uuid}/        - Retrieve/update user
```

### 5. **Configuration Layer** (`config/`)
Settings and global configuration

**Key Files:**
- `base.py` - Common settings for all environments
- `development.py` - Development-specific settings
- `production.py` - Production-specific settings

---

## Authentication Flow

### JWT Authentication

1. **User Registration**
   ```
   POST /api/v1/accounts/auth/register/
   → UserRegistrationSerializer validates data
   → User model creates account with hashed password
   → Tokens generated via RefreshToken.for_user()
   ```

2. **User Login**
   ```
   POST /api/v1/accounts/auth/login/
   → CustomTokenObtainPairSerializer validates credentials
   → JWT tokens generated with custom claims (email, full_name)
   → LoginHistory records login attempt
   ```

3. **Protected Endpoints**
   ```
   Authorization: Bearer <access_token>
   → JWTAuthentication validates token
   → User extracted from token claims
   → Permission checks applied
   ```

4. **Token Refresh**
   ```
   POST /api/v1/accounts/auth/token/refresh/
   → Refresh token validated
   → New access token issued
   → Refresh token rotated
   ```

---

## Authorization (RBAC)

### Role-Based Access Control

1. **Roles** - Define user categories
   - Admin
   - Teacher
   - Student
   - Parent

2. **Permissions** - Define allowed actions
   - `view_user`, `add_user`, `change_user`, `delete_user`
   - `view_course`, `add_course`, `change_course`, `delete_course`
   - `view_grade`, `add_grade`, `change_grade`, `delete_grade`

3. **Assignment Flow**
   ```
   User --[UserRole]--> Role --[RolePermission]--> Permission
   ```

4. **Permission Checking**
   - Custom permission classes can be created
   - Permission checks in views/viewsets
   - Admin actions restricted to superusers

---

## Database Design

### BaseModel (Abstract)
All models inherit common fields:
- `uuid` - Public identifier (UUID v4, indexed)
- `is_active` - Soft delete flag (indexed)
- `created_at` - Creation timestamp (indexed)
- `updated_at` - Last update timestamp

### Relationships

```
User (1) ---> (Many) UserRole
                        |
                    Role (1) ---> (Many) RolePermission
                                              |
                                        Permission

User (1) ---> (Many) LoginHistory

UserRole: user + role (unique together)
RolePermission: role + permission (unique together)
```

### Indexes
- `user.email` - Fast email lookups
- `user.is_active` - Filter active users
- `user.created_at` - Sort by creation date
- `role.name` - Fast role lookups
- `loginhistory.user, -login_time` - Recent logins
- `loginhistory.ip_address` - IP tracking

---

## Security Features

### 1. **Password Security**
- Passwords hashed using Django's PBKDF2 algorithm
- Minimum 8 characters required
- Password confirmation validation during registration

### 2. **JWT Tokens**
- Access tokens expire in 24 hours (configurable)
- Refresh tokens valid for 7 days
- Token rotation enabled
- Tokens include custom claims (email, full_name)

### 3. **CORS Protection**
- Whitelist of allowed origins
- Credentials allowed in requests
- Configurable per environment

### 4. **Login Auditing**
- All login attempts logged to LoginHistory
- IP address and device info recorded
- Failed login reasons captured
- Session duration tracked

### 5. **Soft Deletes**
- Records marked inactive instead of deleted
- Preserves referential integrity
- Historical data preserved

---

## API Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": { ... }
}
```

---

## Environment Configuration

### .env File

```ini
# Django
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=127.0.0.1,localhost

# Database
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=db.sqlite3

# JWT
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# Internationalization
LANGUAGE_CODE=en-us
TIME_ZONE=Asia/Dhaka
```

---

## Management Commands

### Create Initial Roles
```bash
python manage.py create_initial_roles
```

Creates system roles and their associated permissions:
- Admin (all permissions)
- Teacher (course + grade permissions)
- Student (view permissions)
- Parent (view grade permissions)

---

## Dependencies

### Core
- `Django 6.0.6` - Web framework
- `djangorestframework 3.14.0` - REST API framework

### Authentication
- `django-rest-framework-simplejwt 5.3.2` - JWT tokens
- `PyJWT 2.8.1` - JWT library

### Utilities
- `python-decouple 3.8` - Environment variables
- `django-cors-headers 4.3.0` - CORS support
- `Pillow 10.1.0` - Image processing

### Testing
- `pytest 7.4.3` - Testing framework
- `pytest-django 4.7.0` - Django testing

### Optional
- `psycopg2-binary 2.9.9` - PostgreSQL driver
- `celery 5.3.4` - Task queue
- `redis 5.0.1` - Cache/message broker

---

## Performance Considerations

### Database Optimization
- Indexed frequently queried fields
- Foreign key relationships optimized
- Unique constraints on role/permission codes

### Query Optimization
- Use `select_related()` for FK lookups
- Use `prefetch_related()` for reverse lookups
- Pagination enabled (20 items per page)

### Caching
- Can integrate Redis for token blacklisting
- Cache user permissions after first load
- Cache role information

---

## Testing Strategy

### Unit Tests
- Model validation
- Serializer validation
- Permission checking

### Integration Tests
- API endpoint testing
- Authentication flow
- RBAC functionality

### Coverage
- Aim for 80%+ code coverage
- Critical paths fully tested

---

## Deployment Checklist

- [ ] Set DEBUG=False in production
- [ ] Generate strong SECRET_KEY
- [ ] Use PostgreSQL for production
- [ ] Enable HTTPS
- [ ] Configure proper CORS origins
- [ ] Setup email service for password reset
- [ ] Enable rate limiting
- [ ] Setup monitoring and logging
- [ ] Create database backups
- [ ] Use environment-specific settings
- [ ] Enable CSRF protection
- [ ] Configure security headers

---

## Future Enhancements

1. **Student Module**
   - Student enrollment
   - Attendance tracking
   - Class assignments

2. **Course Module**
   - Course creation and management
   - Curriculum planning
   - Schedule management

3. **Academic Module**
   - Grade management
   - Assessment tools
   - Report generation

4. **Finance Module**
   - Fee management
   - Payment tracking
   - Financial reports

5. **Communication**
   - Email notifications
   - SMS alerts
   - In-app messaging

6. **Advanced Features**
   - GraphQL API
   - Real-time updates (WebSockets)
   - Mobile app support
   - Advanced reporting

---

## Troubleshooting

### Common Issues

**Issue: URL namespace not unique**
- Solution: Check for duplicate URL includes in main urls.py

**Issue: Duplicate app in INSTALLED_APPS**
- Solution: Ensure each app listed only once in settings

**Issue: Migration conflicts**
- Solution: Delete conflicting migrations and rerun

**Issue: CORS errors**
- Solution: Add frontend URL to CORS_ALLOWED_ORIGINS in .env

---

## Support & Documentation

- Django: https://docs.djangoproject.com/
- DRF: https://www.django-rest-framework.org/
- JWT: https://django-rest-framework-simplejwt.readthedocs.io/
- API Documentation: See `API_DOCUMENTATION.md`
