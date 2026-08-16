# School ERP Backend API Documentation

## Overview

This is the API documentation for the School ERP backend built with Django REST Framework and JWT authentication.

## Base URL

```
http://localhost:8000/api/v1/
```

---

## Authentication Endpoints

### 1. User Registration

**Endpoint:** `POST /accounts/auth/register/`

**Description:** Register a new user account

**Request Body:**
```json
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password": "securepassword123",
  "password_confirm": "securepassword123",
  "phone_number": "1234567890"
}
```

**Response:** `201 Created`
```json
{
  "message": "User registered successfully.",
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "full_name": "John Doe",
    "phone_number": "1234567890",
    "profile_image": null,
    "date_of_birth": null,
    "address": null,
    "city": null,
    "state": null,
    "country": null,
    "postal_code": null,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "tokens": {
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

---

### 2. User Login

**Endpoint:** `POST /accounts/auth/login/`

**Description:** Authenticate user and get JWT tokens

**Request Body:**
```json
{
  "username": "user@example.com",
  "password": "securepassword123"
}
```

**Note:** The `username` field accepts the user's email address.

**Response:** `200 OK`
```json
{
  "message": "Login successful.",
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "full_name": "John Doe",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "tokens": {
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

---

### 3. Logout

**Endpoint:** `POST /accounts/auth/logout/`

**Description:** Logout the authenticated user

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "message": "Logout successful."
}
```

---

### 4. Refresh Token

**Endpoint:** `POST /accounts/auth/token/refresh/`

**Description:** Get a new access token using refresh token

**Request Body:**
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response:** `200 OK`
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

### 5. Change Password

**Endpoint:** `POST /accounts/auth/change-password/`

**Description:** Change the authenticated user's password

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "old_password": "oldpassword123",
  "new_password": "newpassword123",
  "new_password_confirm": "newpassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password changed successfully."
}
```

---

### 6. Get Current User

**Endpoint:** `GET /accounts/auth/me/`

**Description:** Get the authenticated user's profile information

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "full_name": "John Doe",
  "phone_number": "1234567890",
  "profile_image": null,
  "date_of_birth": null,
  "address": null,
  "city": null,
  "state": null,
  "country": null,
  "postal_code": null,
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Update Profile:**

**Endpoint:** `PATCH /accounts/auth/me/`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "phone_number": "9876543210",
  "city": "Dhaka",
  "country": "Bangladesh"
}
```

**Response:** `200 OK`
```json
{
  "message": "Profile updated successfully.",
  "user": { ... }
}
```

---

## User Management Endpoints

### 7. List All Users

**Endpoint:** `GET /accounts/users/`

**Description:** List all active users (Admin only)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `search`: Search by email or name
- `page`: Page number (pagination)

**Response:** `200 OK`
```json
{
  "count": 10,
  "next": "http://localhost:8000/api/v1/accounts/users/?page=2",
  "previous": null,
  "results": [
    { ... user objects ... }
  ]
}
```

---

### 8. Get User Details

**Endpoint:** `GET /accounts/users/{uuid}/`

**Description:** Get details of a specific user

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "full_name": "John Doe",
  "phone_number": "1234567890",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### 9. Update User

**Endpoint:** `PUT /accounts/users/{uuid}/` or `PATCH /accounts/users/{uuid}/`

**Description:** Update user details

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "newemail@example.com",
  "phone_number": "9876543210"
}
```

**Response:** `200 OK`
```json
{ ... updated user object ... }
```

---

### 10. Delete User (Soft Delete)

**Endpoint:** `DELETE /accounts/users/{uuid}/`

**Description:** Deactivate a user (mark as inactive)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `204 No Content`
```json
{
  "message": "User deleted successfully."
}
```

---

## Models Overview

### User Model
- `uuid` - Unique identifier (UUID)
- `email` - Email address (unique)
- `first_name` - First name
- `last_name` - Last name
- `phone_number` - Contact number
- `profile_image` - Profile image
- `date_of_birth` - Date of birth
- `address` - Street address
- `city` - City
- `state` - State/Province
- `country` - Country
- `postal_code` - Postal/ZIP code
- `is_active` - Active status
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### Role Model
- `uuid` - Unique identifier
- `name` - Role name (unique)
- `description` - Role description
- `is_system_role` - System role indicator
- `is_active` - Active status

### Permission Model
- `uuid` - Unique identifier
- `code` - Permission code (unique)
- `name` - Permission name
- `description` - Permission description
- `category` - Permission category
- `is_active` - Active status

### UserRole Model
- Links users to roles (Many-to-Many)
- Tracks who assigned the role and when

### RolePermission Model
- Links roles to permissions (Many-to-Many)
- Tracks which permissions each role has

### LoginHistory Model
- Tracks all login attempts and sessions
- Records IP address, device type, and user agent
- Stores session duration and failure reasons

---

## System Roles

### Admin
- Full system access
- Can manage users, roles, and permissions
- Can create and manage courses and grades

### Teacher
- Can view courses
- Can add and modify grades
- Limited user management

### Student
- Read-only access to courses and personal grades

### Parent
- Read-only access to student grades

---

## Error Responses

### 400 Bad Request
```json
{
  "field_name": ["Error message"]
}
```

### 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### 403 Forbidden
```json
{
  "detail": "You do not have permission to perform this action."
}
```

### 404 Not Found
```json
{
  "detail": "Not found."
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error."
}
```

---

## Rate Limiting

Rate limiting is not currently enabled but can be added to settings.

---

## CORS

CORS is configured to allow requests from:
- `http://localhost:3000`
- `http://localhost:8000`

Add additional origins in `.env` file:
```
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,https://yourdomain.com
```

---

## Development Setup

### 1. Clone Repository
```bash
git clone <repo_url>
cd SchoolERP/backend
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/Scripts/activate  # Windows
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Setup Environment Variables
```bash
cp .env.example .env
# Edit .env with your settings
```

### 5. Run Migrations
```bash
python manage.py migrate
python manage.py create_initial_roles
```

### 6. Create Superuser
```bash
python manage.py createsuperuser
```

### 7. Run Development Server
```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/v1/`

---

## Admin Panel

Access Django admin at: `http://localhost:8000/admin/`

---

## Future Enhancements

- [ ] Student module (enrollment, attendance, etc.)
- [ ] Course module (curriculum, schedules)
- [ ] Grades/Assessment module
- [ ] Payment/Finance module
- [ ] Communication/Notification system
- [ ] Mobile app API endpoints
- [ ] Advanced reporting and analytics
- [ ] File upload/document management
- [ ] Email notifications
- [ ] SMS alerts
