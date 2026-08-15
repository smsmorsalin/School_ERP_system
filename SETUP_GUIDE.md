# School ERP Backend - Setup & Getting Started Guide

## ✅ What's Been Fixed & Implemented

### **Phase 1: Configuration & Dependencies** ✅
- [x] Fixed corrupted `requirements.txt` with proper UTF-8 encoding
- [x] Created `.env` and `.env.example` for environment variables
- [x] Configured Django settings with REST Framework, JWT, and CORS
- [x] Removed duplicate app registration in `INSTALLED_APPS`
- [x] Setup logging configuration

### **Phase 2: Database Models** ✅
- [x] Implemented custom `User` model with email authentication
- [x] Created `Role` model for RBAC
- [x] Created `Permission` model for fine-grained access control
- [x] Implemented `UserRole` junction table
- [x] Implemented `RolePermission` junction table
- [x] Created `LoginHistory` model for audit trails
- [x] Setup BaseModel with UUID, soft deletes, and timestamps

### **Phase 3: Authentication** ✅
- [x] Setup JWT authentication with simple-jwt
- [x] Implemented user registration endpoint
- [x] Implemented user login with JWT tokens
- [x] Created logout endpoint with session tracking
- [x] Implemented token refresh mechanism
- [x] Created password change endpoint
- [x] Implemented current user profile endpoint

### **Phase 4: API Endpoints** ✅
- [x] Created authentication serializers with validation
- [x] Implemented auth views (register, login, logout, change password)
- [x] Created UserViewSet for user management
- [x] Setup URL routing for API endpoints
- [x] Configured Django admin for model management
- [x] Created management command for initial data setup

### **Phase 5: Documentation** ✅
- [x] Created comprehensive API documentation
- [x] Created architecture overview document
- [x] Added inline code documentation
- [x] Setup logging for debugging

---

## 🚀 Quick Start Guide

### 1. **Prerequisites**
- Python 3.8+
- pip (Python package manager)
- Virtual environment

### 2. **Install Dependencies**

```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install packages
pip install -r requirements.txt
```

### 3. **Setup Environment Variables**

```bash
# Copy example file
copy .env.example .env

# Edit .env with your settings
# Important: Change SECRET_KEY in production
```

### 4. **Initialize Database**

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create initial roles and permissions
python manage.py create_initial_roles

# Create superuser (admin account)
python manage.py createsuperuser
```

### 5. **Run Development Server**

```bash
python manage.py runserver
```

Server runs at: `http://localhost:8000`

---

## 📚 API Endpoints Summary

### Authentication Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| POST | `/api/v1/accounts/auth/register/` | Register new user | ❌ |
| POST | `/api/v1/accounts/auth/login/` | Get JWT tokens | ❌ |
| POST | `/api/v1/accounts/auth/logout/` | Logout user | ✅ |
| POST | `/api/v1/accounts/auth/token/refresh/` | Refresh access token | ❌ |
| POST | `/api/v1/accounts/auth/change-password/` | Change password | ✅ |
| GET | `/api/v1/accounts/auth/me/` | Get current user | ✅ |
| PATCH | `/api/v1/accounts/auth/me/` | Update profile | ✅ |

### User Management Endpoints

| Method | Endpoint | Purpose | Permission |
|--------|----------|---------|-----------|
| GET | `/api/v1/accounts/users/` | List all users | Admin only |
| POST | `/api/v1/accounts/users/` | Create user | Admin only |
| GET | `/api/v1/accounts/users/{uuid}/` | Get user details | Authenticated |
| PUT | `/api/v1/accounts/users/{uuid}/` | Update user | Authenticated |
| PATCH | `/api/v1/accounts/users/{uuid}/` | Partial update | Authenticated |
| DELETE | `/api/v1/accounts/users/{uuid}/` | Delete user (soft) | Admin only |

---

## 🔐 Authentication Example

### 1. Register New User

```bash
curl -X POST http://localhost:8000/api/v1/accounts/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "password": "securepass123",
    "password_confirm": "securepass123",
    "phone_number": "1234567890"
  }'
```

### 2. Login User

```bash
curl -X POST http://localhost:8000/api/v1/accounts/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "securepass123"
  }'
```

Response includes:
- `access` token (24 hours)
- `refresh` token (7 days)
- User profile data

### 3. Use Access Token

```bash
curl -X GET http://localhost:8000/api/v1/accounts/auth/me/ \
  -H "Authorization: Bearer {access_token}"
```

### 4. Refresh Token

```bash
curl -X POST http://localhost:8000/api/v1/accounts/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "{refresh_token}"}'
```

---

## 🗄️ Database Models

### User Model
- Custom user model using email as primary identifier
- Extends Django's AbstractUser
- Contains profile information and contact details
- Soft delete support

**Key Fields:**
- `uuid` - Public identifier
- `email` - Unique email address
- `first_name`, `last_name` - Name fields
- `phone_number`, `date_of_birth` - Contact info
- `address`, `city`, `state`, `country`, `postal_code` - Address
- `profile_image` - Profile picture
- `is_active` - Soft delete flag
- `created_at`, `updated_at` - Timestamps

### Role Model
- User roles: Admin, Teacher, Student, Parent
- Many-to-many relationship with users via UserRole
- Many-to-many relationship with permissions via RolePermission

### Permission Model
- Fine-grained permissions (e.g., `view_user`, `add_course`)
- Categorized (user_management, academic, etc.)
- Assigned to roles, not directly to users

### UserRole Model
- Junction table linking users and roles
- Tracks who assigned the role and when
- Supports multiple roles per user

### RolePermission Model
- Junction table linking roles and permissions
- Defines which permissions each role has

### LoginHistory Model
- Audit trail of all login attempts
- Records IP address, device, and browser info
- Tracks session duration
- Records failed login reasons
- Read-only (cannot be manually created)

---

## 👨‍💼 Admin Panel

Access Django admin at: `http://localhost:8000/admin/`

**Features:**
- User management
- Role configuration
- Permission assignment
- Login history viewing
- Customized admin interface for all models

---

## 🔧 Configuration Files

### settings/base.py
- Common settings for all environments
- Database configuration
- Installed apps
- Middleware setup
- REST Framework configuration
- JWT settings
- CORS configuration
- Logging setup

### .env File
```ini
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=127.0.0.1,localhost
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=db.sqlite3
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
LANGUAGE_CODE=en-us
TIME_ZONE=Asia/Dhaka
```

---

## 🛡️ Security Checklist

- [x] Custom user model with email authentication
- [x] Password hashing with PBKDF2
- [x] JWT tokens with expiration
- [x] Token rotation enabled
- [x] CORS protection configured
- [x] Login attempt auditing
- [x] Soft delete for data preservation
- [x] Environment variables for secrets
- [ ] HTTPS in production (TODO)
- [ ] Rate limiting (optional)
- [ ] Email verification (future)
- [ ] Two-factor authentication (future)

---

## 📝 Project Structure

```
backend/
├── apps/
│   ├── accounts/           # User & auth management
│   │   ├── models/         # Database models
│   │   ├── api/            # API views
│   │   ├── serializers/    # Data validation
│   │   ├── admin.py        # Admin configuration
│   │   ├── urls.py         # URL routing
│   │   └── management/     # Custom commands
│   └── core/               # Core utilities
│       └── models/
│           └── base_model.py
├── config/
│   ├── settings/           # Django settings
│   ├── urls.py             # Main URL routing
│   ├── wsgi.py
│   └── asgi.py
├── logs/                   # Application logs
├── media/                  # User uploads
├── static/                 # Static files
├── manage.py
├── requirements.txt
└── .env                    # Environment variables
```

---

## 🧪 Testing & Development

### Run Tests
```bash
pytest                      # Run all tests
pytest apps/accounts/       # Run specific app tests
pytest --cov                # With coverage report
```

### Make Migrations
```bash
python manage.py makemigrations    # Create migration files
python manage.py migrate           # Apply migrations
```

### Create Superuser
```bash
python manage.py createsuperuser
```

### Initialize Sample Data
```bash
python manage.py create_initial_roles
```

---

## 🐛 Troubleshooting

### Issue: "Address already in use"
```bash
# Find and kill process on port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:8000 | xargs kill -9
```

### Issue: "No module named 'django'"
```bash
# Ensure virtual environment is activated
pip install -r requirements.txt
```

### Issue: "ModuleNotFoundError: No module named 'rest_framework'"
```bash
pip install djangorestframework django-rest-framework-simplejwt
```

### Issue: Database locked
```bash
# Reset database (development only)
rm db.sqlite3
python manage.py migrate
python manage.py create_initial_roles
```

---

## 📞 Support & Resources

- **Django Documentation**: https://docs.djangoproject.com/
- **DRF Documentation**: https://www.django-rest-framework.org/
- **JWT Documentation**: https://django-rest-framework-simplejwt.readthedocs.io/
- **API Documentation**: See `API_DOCUMENTATION.md`
- **Architecture Guide**: See `ARCHITECTURE.md`

---

## 🔄 Next Steps

1. **Test the API**
   - Use Postman or cURL to test endpoints
   - Verify authentication flow
   - Test user management

2. **Create Frontend**
   - Build React/Vue frontend
   - Integrate with API
   - Handle authentication

3. **Expand Backend**
   - Add Student module
   - Add Course module
   - Add Grade management
   - Add Finance module

4. **Deploy**
   - Switch to PostgreSQL
   - Setup production server
   - Configure domain and SSL
   - Setup CI/CD pipeline

---

## 📄 Documentation Files

- **API_DOCUMENTATION.md** - Complete API reference
- **ARCHITECTURE.md** - System architecture overview
- **SETUP_GUIDE.md** - This file

---

**Status:** ✅ Backend architecture fully implemented and ready for development!

**Last Updated:** January 2024
**Framework:** Django 6.0.6 + Django REST Framework 3.14.0
**Authentication:** JWT with Simple JWT
**Database:** SQLite (development), PostgreSQL (production)
