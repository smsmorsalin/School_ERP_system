# School ERP System

A comprehensive School Enterprise Resource Planning (ERP) system built with Django and React to manage all aspects of school administration.

## 📋 Project Overview

School ERP is a full-stack web application designed to streamline school management operations including:
- User and role management
- Academic tracking
- Grade management
- Finance and payments
- Student enrollment
- Communication and notifications

## 🏗️ Architecture

### Backend
- **Framework**: Django 6.0.6
- **API**: Django REST Framework
- **Authentication**: JWT (Simple JWT)
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Language**: Python 3.8+

### Frontend (Planned)
- **Framework**: React/Vue
- **State Management**: Redux/Pinia
- **Styling**: TailwindCSS/Bootstrap
- **Language**: TypeScript/JavaScript

## 📁 Project Structure

```
SchoolERP/
├── backend/                    # Django backend API
│   ├── apps/
│   │   ├── accounts/          # User & auth
│   │   └── core/              # Core utilities
│   ├── config/                # Django settings
│   ├── manage.py
│   └── requirements.txt
├── frontend/                  # React/Vue frontend (WIP)
├── docs/                      # Documentation
├── API_DOCUMENTATION.md       # API reference
├── ARCHITECTURE.md            # System architecture
├── SETUP_GUIDE.md             # Setup instructions
└── README.md                  # This file
```

## 🚀 Quick Start

### Backend Setup

1. **Navigate to backend**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Setup environment**
   ```bash
   copy .env.example .env
   # Edit .env with your settings
   ```

5. **Initialize database**
   ```bash
   python manage.py migrate
   python manage.py create_initial_roles
   python manage.py createsuperuser
   ```

6. **Run development server**
   ```bash
   python manage.py runserver
   ```

Backend available at: `http://localhost:8000`

---

## 🔌 API Endpoints

### Authentication
- `POST /api/v1/accounts/auth/register/` - Register user
- `POST /api/v1/accounts/auth/login/` - Login user
- `POST /api/v1/accounts/auth/logout/` - Logout user
- `POST /api/v1/accounts/auth/change-password/` - Change password
- `GET /api/v1/accounts/auth/me/` - Get current user

### User Management
- `GET /api/v1/accounts/users/` - List users (admin)
- `GET /api/v1/accounts/users/{uuid}/` - Get user
- `PUT /api/v1/accounts/users/{uuid}/` - Update user
- `DELETE /api/v1/accounts/users/{uuid}/` - Delete user (soft)

**For complete API documentation**, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

---

## 👥 System Roles

| Role | Description | Permissions |
|------|-------------|------------|
| **Admin** | System administrator | Full access to all features |
| **Teacher** | Educator | Can manage courses and grades |
| **Student** | Learner | View-only access to courses and personal grades |
| **Parent** | Guardian | View-only access to student grades |

---

## 🗄️ Database Models

### Core Models
- **User** - Custom user model with email authentication
- **Role** - User roles for RBAC
- **Permission** - Fine-grained permissions
- **UserRole** - User-Role relationship
- **RolePermission** - Role-Permission relationship
- **LoginHistory** - Login audit trail

**For detailed model documentation**, see [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 🔐 Security Features

- ✅ JWT token-based authentication
- ✅ Password hashing (PBKDF2)
- ✅ Email as unique identifier
- ✅ Role-Based Access Control (RBAC)
- ✅ Login attempt tracking
- ✅ Soft delete for data preservation
- ✅ CORS protection
- ✅ Environment variable configuration

---

## 📚 Documentation

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Detailed setup instructions
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API reference
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture overview

---

## 🛠️ Tech Stack

### Backend
- Django 6.0.6
- Django REST Framework 3.14.0
- django-rest-framework-simplejwt 5.3.2
- django-cors-headers 4.3.0
- python-decouple 3.8
- Pillow 10.1.0

### Database
- SQLite (development)
- PostgreSQL (production)

### Testing
- pytest
- pytest-django

### Tools
- Docker (optional)
- Git
- Virtual Environment

---

## 📋 Features Status

### ✅ Implemented
- [x] User authentication (JWT)
- [x] User registration and login
- [x] User profile management
- [x] Role-based access control
- [x] Permission system
- [x] Login history tracking
- [x] Django admin interface
- [x] API documentation

### 🚧 In Progress
- [ ] Frontend (React/Vue)
- [ ] Student module
- [ ] Course management
- [ ] Grade management

### 📅 Planned
- [ ] Finance/Payment module
- [ ] Communication system
- [ ] Advanced reporting
- [ ] Mobile app
- [ ] GraphQL API

---

## 🧪 Testing

```bash
# Run all tests
pytest

# Run specific app tests
pytest apps/accounts/

# With coverage
pytest --cov

# Verbose output
pytest -v
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Database Issues
```bash
# Reset database (development only)
rm db.sqlite3
python manage.py migrate
```

### Import Errors
```bash
# Ensure virtual environment is activated
pip install -r requirements.txt
```

**For more issues**, see [SETUP_GUIDE.md](SETUP_GUIDE.md#-troubleshooting)

---

## 🤝 Contributing

1. Create a feature branch
   ```bash
   git checkout -b feature/your-feature
   ```

2. Make changes and commit
   ```bash
   git add .
   git commit -m "Add your feature"
   ```

3. Push to repository
   ```bash
   git push origin feature/your-feature
   ```

4. Create a pull request

---

## 📞 Support

For issues and questions:
- Check documentation files
- Review API documentation
- Check Django/DRF documentation

---

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

---

## 👨‍💻 Authors

- Backend Architecture & Implementation

---

## 🎯 Goals

- Create a modern, scalable school management system
- Provide comprehensive admin dashboard
- Support multiple user roles and permissions
- Ensure data security and integrity
- Facilitate easy customization and expansion

---

## 📈 Project Status

**Current Version:** 1.0.0 (Backend Ready)
**Status:** ✅ Backend architecture complete and tested
**Next Phase:** Frontend development

---

## 🔄 Environment Setup

### Development
```
DEBUG=True
DATABASE=SQLite
TESTING=True
```

### Production
```
DEBUG=False
DATABASE=PostgreSQL
TESTING=False
```

---

## 📞 Contact & Resources

- **Django**: https://www.djangoproject.com/
- **DRF**: https://www.django-rest-framework.org/
- **JWT**: https://jwt.io/
- **REST API Design**: https://restfulapi.net/

---

**Last Updated:** January 2024

**⭐ If you find this project helpful, please star it!**
