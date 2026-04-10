# Hosting Guide (Frontend + Backend + Database Separated)

This project can be deployed as three separate parts:

- frontend/ on Vercel/Netlify
- backend/ on Render/Railway/Fly.io
- database on MongoDB Atlas (recommended)

The backend now supports two database modes:

- MongoDB mode when MONGODB_URI is set (recommended for production)
- File mode fallback using backend/database/db.json

## 1) Database Hosting (MongoDB Atlas)

1. Create a free cluster in MongoDB Atlas.
2. Create a database user and allow network access from your backend host.
3. Copy the connection string and set it in backend env:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<dbName>?retryWrites=true&w=majority
```

## 2) Backend Hosting

Deploy backend/ on Render, Railway, Fly.io, VPS, etc.

Set these environment variables:

```env
PORT=5000
FRONTEND_BASE_URL=https://your-frontend-domain.com
FRONTEND_BASE_URLS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
REFRESH_JWT_SECRET=...
ADMIN_JWT_SECRET=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
```

Build/start commands:

```bash
npm install
npm run start
```

Health check:

- GET /api/health

## 3) Frontend Hosting

Deploy frontend/ on Vercel, Netlify, Cloudflare Pages, or any static host.

Set frontend env:

```env
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_API_URL=https://your-backend-domain.com
```

Build command:

```bash
npm install
npm run build
```

Output directory:

- dist/

## 4) Connection Checklist

1. Frontend env points to backend URL.
2. Backend CORS includes frontend domains via FRONTEND_BASE_URL or FRONTEND_BASE_URLS.
3. Backend has MONGODB_URI set for separate database hosting.
4. All three services use HTTPS in production.
5. Test: register, login, contact form, admin login, and event registration.

## 5) Local Development

Backend:

```bash
cd backend
npm run start
```

Frontend:

```bash
cd frontend
npm run dev
```
