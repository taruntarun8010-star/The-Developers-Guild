# The Developers' Guild - Frontend

Frontend for The Developers' Guild coding club website built with React, Vite, Tailwind CSS, Framer Motion, and React Three Fiber.

## Features

- Home page with animated 3D hero section
- About page with AIMT club details and AI Skill Analyzer UI
- Events page with live event listing and registration flow
- Event lifecycle with capacity, deadline, and waitlist states
- Login and registration pages connected to backend APIs
- SMTP email verification flow (`/verify-email`)
- Login OTP verification flow (`/login-otp`)
- Admin panel with secure login and event management (`/admin/login`, `/admin`)
- Project showcase connected to backend (`/projects`)
- Admin analytics widgets and trend data in dashboard
- Dark/light theme toggle with persistent local storage
- Route transitions with Framer Motion

## Tech Stack

- React 19 + Vite
- React Router DOM
- Framer Motion
- Tailwind CSS
- React Three Fiber + Drei + Three.js

## Run Frontend

1. Install dependencies:

	```bash
	npm install
	```

2. Start development server:

	```bash
	npm run dev
	```

3. Build production bundle:

	```bash
	npm run build
	```

4. Lint the project:

	```bash
	npm run lint
	```

## API Expectations

Frontend API base URL is now environment-driven.

Set this variable in your hosting provider:

- `VITE_API_BASE_URL=https://your-backend-domain.com`

Local development fallback remains:

- `http://localhost:5000`

See also:

- `../HOSTING.md`
