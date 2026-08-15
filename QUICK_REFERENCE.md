# Quick Reference Card - School ERP Backend

## 🚀 Quick Start Commands

```bash
# 1. Setup
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 2. Configure
copy .env.example .env

# 3. Initialize
python manage.py migrate
python manage.py create_initial_roles
python manage.py createsuperuser

# 4. Run
python manage.py runserver
```

## 🔌 API Endpoints Quick Reference

### Authentication
```
POST   /api/v1/accounts/auth/register/          Register user
POST   /api/v1/accounts/auth/login/             Get JWT tokens
POST   /api/v1/accounts/auth/logout/            Logout user
POST   /api/v1/accounts/auth/token/refresh/     Refresh token
POST   /api/v1/accounts/auth/change-password/   Change password
GET    /api/v1/accounts/auth/me/                Get current user
PATCH  /api/v1/accounts/auth/me/                Update profile
```

### User Management
```
GET    /api/v1/accounts/users/                  List users (admin)
POST   /api/v1/accounts/users/                  Create user (admin)
GET    /api/v1/accounts/users/{uuid}/           Get user
PUT    /api/v1/accounts/users/{uuid}/           Update user
PATCH  /api/v1/accounts/users/{uuid}/           Partial update
DELETE /api/v1/accounts/users/{uuid}/           Delete user (soft)
```

## 📝 Authentication Example

```bash
# Register
curl -X POST http://localhost:8000/api/v1/accounts/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","first_name":"John","last_name":"Doe","password":"pass123","password_confirm":"pass123"}'

# Login
curl -X POST http://localhost:8000/api/v1/accounts/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"pass123"}'

# Use Token
curl -X GET http://localhost:8000/api/v1/accounts/auth/me/ \
  -H "Authorization: Bearer {access_token}"
```

## 🗄️ Models Overview

```
User                    ← Email-based authentication
├── UserRole           ← Links to Role
└── LoginHistory       ← Audit trail

Role                    ← System roles (Admin, Teacher, etc.)
├── UserRole           ← Users assigned to role
└── RolePermission     ← Permissions assigned to role

Permission             ← Fine-grained permissions
└── RolePermission     ← Assigned to roles
```

## 👥 System Roles

- **Admin** - Full access to all features
- **Teacher** - Can manage courses and grades
- **Student** - View-only access to courses/grades
- **Parent** - View-only access to student grades

## 🔑 JWT Tokens

```
Access Token:  Expires in 24 hours, use for API requests
Refresh Token: Expires in 7 days, use to get new access token

Header: Authorization: Bearer {access_token}
```

## 📁 Project Structure

```
backend/
├── apps/accounts/           ← User management
│   ├── models/             ← Database models
│   ├── api/                ← Views
│   ├── serializers/        ← Validation
│   └── urls.py             ← Routing
├── config/settings/         ← Django settings
├── manage.py
└── requirements.txt
```

## ⚙️ Key Configuration Files

### .env
```ini
DEBUG=True
SECRET_KEY=your-key-here
ALLOWED_HOSTS=127.0.0.1,localhost
JWT_EXPIRATION_HOURS=24
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
```

### settings/base.py
- REST Framework config
- JWT settings
- CORS configuration
- Database setup
- Logging config

## 🛠️ Useful Commands

```bash
# Migrations
python manage.py makemigrations
python manage.py migrate
python manage.py migrate --fake-initial

# Django Shell
python manage.py shell

# Create Superuser
python manage.py createsuperuser

# Create Initial Roles
python manage.py create_initial_roles

# Collect Static
python manage.py collectstatic

# System Check
python manage.py check

# Clear Cache
python manage.py clear_cache
```

## 📊 Database Models

### User
- uuid, email (unique), first_name, last_name
- phone_number, date_of_birth, address
- city, state, country, postal_code
- profile_image, is_active, created_at, updated_at

### Role
- uuid, name (unique), description
- is_system_role, is_active

### Permission
- uuid, code (unique), name, description
- category, is_active

### UserRole
- user, role, assigned_at, assigned_by

### RolePermission
- role, permission

### LoginHistory
- user, email, status, ip_address
- login_time, logout_time, session_duration
- user_agent, device_type, failure_reason

## 🔐 Security

✅ JWT authentication  
✅ Password hashing (PBKDF2)  
✅ CORS protection  
✅ Email validation  
✅ Role-based access control  
✅ Login auditing  
✅ Soft deletes  
✅ Environment variables for secrets  

## 🌐 URLs

```
Admin:  http://localhost:8000/admin/
API:    http://localhost:8000/api/v1/
Docs:   See API_DOCUMENTATION.md
```

## 📚 Documentation Files

- **API_DOCUMENTATION.md** - Complete API reference
- **ARCHITECTURE.md** - System design
- **SETUP_GUIDE.md** - Setup instructions
- **README.md** - Project overview
- **IMPLEMENTATION_COMPLETE.md** - What was fixed

## ❌ Troubleshooting

### Port Already in Use
```bash
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Database Issues
```bash
# Reset database (dev only)
rm db.sqlite3
python manage.py migrate
```

### Import Errors
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

### Migration Conflicts
```bash
# Show migrations
python manage.py showmigrations

# Reset migrations (dev only)
python manage.py migrate app_name zero
```

## 💡 Tips

1. Always use JWT tokens for API authentication
2. Store tokens securely on frontend (localStorage/sessionStorage)
3. Implement token refresh before expiry
4. Use admin interface for role/permission management
5. Check LoginHistory for security audits
6. Create custom permissions as needed
7. Use serializers for all API input/output

## 🎯 Next Steps

1. Build frontend (React/Vue)
2. Integrate API authentication
3. Implement role-based UI
4. Add more modules (courses, grades, etc.)
5. Deploy to production

## 📞 API Response Format

### Success
```json
{
  "message": "Success",
  "data": {...}
}
```

### Error
```json
{
  "error": "Error message",
  "details": {...}
}
```

## 🚀 Performance Tips

- Enable query optimization (select_related, prefetch_related)
- Use pagination for large datasets
- Cache frequently accessed data
- Index important database fields (done)
- Use connection pooling in production
- Monitor LoginHistory for suspicious activity

---

**Version:** 1.0.0  
**Status:** ✅ Ready for Production  
**Last Updated:** January 2024
