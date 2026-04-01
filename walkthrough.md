# Walkthrough - The Developers' Guild Website

## Overview
This project is a full-stack coding club website for Accurate Institute of Management and Technology (AIMT).

It includes:
- React frontend with modern UI and 3D hero visuals
- Express backend with auth and events APIs
- FastAPI microservice for AI-style skill level suggestions

## Project Structure
- `frontend/` - Vite React app
- `backend/` - Express API and JSON data
- `backend/python_backend/` - FastAPI analyzer service

## Run Instructions

### 1) Start Backend (Node/Express)
From `backend/`:

```bash
npm install
npm run dev
```

Before running backend, create a `.env` file in `backend/` with SMTP values:

```bash
PORT=5000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=The Developers' Guild <your-email@gmail.com>
ADMIN_EMAIL=admin@aimt.in
ADMIN_PASSWORD=change-this-password
ADMIN_JWT_SECRET=change-this-secret
```

Server URL: `http://localhost:5000`

### 2) Start Python Backend (FastAPI)
From `backend/python_backend/`:

```bash
pip install fastapi uvicorn
python main.py
```

Service URL: `http://localhost:8000`

### 3) Start Frontend
From `frontend/`:

```bash
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Main User Flows

### Register
1. Open `/register`
2. Enter name, email, and college ID
3. Account is created if email domain is valid
4. Verification code is sent to email via SMTP
5. Verify the code on `/verify-email`

### Login
1. Open `/login`
2. Enter registered email
3. OTP is sent to email and user is redirected to `/login-otp`
4. Enter OTP to complete login and create user session
5. If email is not verified, user is redirected to `/verify-email`

### Browse and Register for Events
1. Open `/events`
2. Event list loads from backend
3. Logged-in users can register once per event

### Analyze Skills
1. Open `/about`
2. Enter name and comma-separated skills
3. Frontend calls `POST /api/analyze-skills` via Express proxy
4. Guild level recommendation is shown

### Admin Panel
1. Open `/admin/login`
2. Login with `ADMIN_EMAIL` and `ADMIN_PASSWORD`
3. Access `/admin` to create, update, or delete events

## Implemented APIs
- `GET /api/health`
- `GET /api/events`
- `POST /api/events/register`
- `GET /api/user/:userId/registrations`
- `GET /api/projects`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/login/verify-otp`
- `POST /api/auth/login/resend-otp`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/admin/login`
- `GET /api/admin/events`
- `POST /api/admin/events`
- `PUT /api/admin/events/:id`
- `DELETE /api/admin/events/:id`
- `GET /api/admin/projects`
- `POST /api/admin/projects`
- `PUT /api/admin/projects/:id`
- `DELETE /api/admin/projects/:id`
- `GET /api/admin/analytics`
- `POST /api/analyze-skills`

## Notes
- Auth is mock email-based auth (no password/OAuth)
- Data is stored in `backend/db.json`
- Rate limiter protects auth endpoints
