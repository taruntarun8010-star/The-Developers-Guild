# Hosting Guide (Frontend + Backend Separated)

This project is already separated into two deployable apps:

- frontend/ (Vite React app)
- backend/ (Node/Express API)

## 1) Backend Hosting

Deploy backend/ on any Node host (Render, Railway, Fly.io, VPS, etc.).

### Required environment variables

Use backend/.env.example as base:

- PORT=5000
- FRONTEND_BASE_URL=https://your-frontend-domain.com
- JWT_SECRET=...
- REFRESH_JWT_SECRET=...
- ADMIN_JWT_SECRET=...
- ADMIN_EMAIL=...
- ADMIN_PASSWORD=...
- SMTP_HOST=...
- SMTP_PORT=587
- SMTP_USER=...
- SMTP_PASS=...
- SMTP_FROM=...

### Start command

```bash
npm install
npm run start
```

### Health check

- GET /api/health

## 2) Frontend Hosting

Deploy frontend/ on Vercel/Netlify/Cloudflare Pages/static host.

### Required environment variable

Create frontend/.env.production (or set in host panel):

- VITE_API_BASE_URL=https://your-backend-domain.com

Example:

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Build command

```bash
npm install
npm run build
```

### Output directory

- dist/

## 3) Local Dev

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

## 4) Notes

- Frontend runtime now rewrites old localhost API calls to VITE_API_BASE_URL automatically.
- Refresh token flow uses HTTP-only cookies. Keep backend CORS credentials enabled and frontend/backend domains configured correctly.
- If frontend and backend are on different domains, ensure secure cookie settings and HTTPS in production.
