# IQAC Academic Monitoring and Management System

This project is a full-stack, role-based IQAC platform built to help an institution monitor academic quality, manage operational records, support accreditation work, track placements, and give guided self-service access to students and faculty. The system combines a React + Vite frontend, an Express + MongoDB backend, and an optional Python MongoDB query utility. It supports five primary user roles: `iqac_admin`, `hod`, `faculty`, `staff`, and `student`.

## Purpose

Institutions need more than raw records. They need a system that can turn student, faculty, department, placement, research, and accreditation data into dashboards, workflows, and actionable insights. This project is designed to support that need by bringing together:

- academic monitoring
- department and student performance tracking
- role-based operational management
- placement and career readiness workflows
- NAAC/NBA documentation support
- report generation
- AI-assisted chatbot access with role-aware data boundaries

## What We Implemented

The current system includes the following major modules:

- Authentication and role-based access control using JWT
- Admin and staff user management workflows
- Department dashboards and performance monitoring
- Student records, progress tracking, attendance, marks, and backlog analysis
- Faculty workspace for subjects, students, contributions, and documents
- Research and faculty achievement management
- Placement record management, placement drives, and student placement applications
- Report generation and analytics endpoints
- NAAC and NBA accreditation documentation modules
- Events, notifications, participation, and achievements
- Jorvis AI chatbot with scoped access, reports, insights, and exports

## System Architecture

This project has three runtime pieces:

1. `frontend/`
   React + Vite application for dashboards, workspaces, forms, analytics, and chatbot UI.
2. `backend/`
   Express API with MongoDB models, business logic, file uploads, role checks, reports, analytics, and chatbot services.
3. `app.py`
   Optional FastAPI-based MongoDB query helper for direct natural-language database exploration. This is not the main application runtime.

### Runtime Flow

```text
Browser
  -> React + Vite frontend
  -> Axios API calls / Vite dev proxy
  -> Express backend (/api/*)
  -> MongoDB via Mongoose

Optional:
CLI or API client
  -> app.py (FastAPI utility)
  -> MongoDB via PyMongo
```

## Tech Stack

### Frontend

- React 18
- Vite
- React Router
- Axios
- Recharts
- Tailwind CSS
- Lucide React

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- JWT authentication
- Multer for file uploads

### AI and Export Features

- Gemini integration for chatbot intelligence
- PDF export support
- DOCX export support

### Optional Utility

- FastAPI
- PyMongo
- Uvicorn

## Role-Based Workflows

### Access Matrix

| Capability | iqac_admin | hod | faculty | staff | student |
| --- | --- | --- | --- | --- | --- |
| Institutional dashboard | Yes | Yes | No | Limited | No |
| Department performance monitoring | Yes | Yes | Limited | Yes | No |
| Student records management | Yes | Yes | Limited | Yes | Own data only |
| Faculty workspace access | Oversight | Oversight | Own workspace | Limited | No |
| Placement drive management | Yes | Yes | No | No | No |
| Student placement self-service | No | No | No | No | Yes |
| Reports and analytics | Yes | Yes | Selected areas | Yes | Limited/self-service |
| NAAC / NBA modules | Yes | Yes | Selected workflows | Limited | No |
| Chatbot access | Yes | Yes | Yes | Yes | Yes, scoped to safe personal/public data |

### IQAC Admin / HOD Flow

IQAC Admins and HODs use the main dashboard to review institutional or department-level KPIs, academic trends, placement performance, research data, and accreditation readiness. They can manage departments, students, faculty visibility, placement drives, reports, and administrative workflows.

### Faculty Workspace Flow

Faculty users are directed into a dedicated workspace with sections for overview, subjects, students, contributions, and documents. This flow is designed around a faculty member's operational scope rather than institution-wide control.

### Staff Operations Flow

Staff users access a dedicated staff dashboard for records, departments, documentation, reports, and analytics support. Staff workflows are operational and administrative rather than academic policy ownership.

### Student Portal Flow

Student users enter a personal workspace where they can view profile data, academic progress, attendance, backlogs, achievements, feedback, documents, participation, and placement status. Their access is intentionally self-service and limited to their own records.

### Chatbot Access Flow

All authenticated roles can use the chatbot, but access is scoped differently per role. Admin and HOD queries can be broader, while student chatbot access is restricted to their own records plus safe public or scoped information such as eligible drives or approved summaries.

## How Major Modules Work

### 1. Authentication and JWT Session Flow

- The backend exposes `/api/auth` for login, registration, and staff account creation.
- Login returns a JWT plus a sanitized user payload.
- The frontend stores the token in `localStorage` and attaches it through Axios interceptors.
- Protected frontend routes and backend middleware both enforce access rules.
- Student accounts can also be provisioned from seeded student records when the configured default student login flow is used.

### 2. Protected Routes and RBAC

- Frontend protection is handled with `ProtectedRoute` and role-based route mapping in `frontend/src/App.jsx`.
- Backend route protection is handled with:
  - `protect` middleware for JWT validation
  - `authorizeRoles` middleware for role checks
- This means route access is enforced at both UI and API level.

### 3. Analytics and Dashboard Data Flow

- Dashboard and analytics pages call grouped API services from `frontend/src/services/api.js`.
- The backend aggregates student, department, placement, attendance, and research data through dedicated analytics controllers and services.
- Different roles receive different analytics scopes depending on authorization.

### 4. Student Portal Flow

The student portal is exposed through `/api/student` and matching frontend student workspace routes. It supports:

- profile viewing and editing
- academic progress
- subjects
- attendance
- backlogs
- event participation
- achievements
- feedback
- documents
- placement visibility and application flow

This creates a complete student self-service layer separate from institution-wide admin screens.

### 5. Placement Flow

The placement module supports both management and self-service:

- Admin/HOD workflows manage placement records and placement drives.
- Students access their placement workspace through `/api/student/placements` and `/api/student/placements/apply`.
- Placement data includes:
  - final placement records
  - placement drives
  - placement applications
- The chatbot can also interpret placement questions, scope them by role, and return readiness, eligibility, drive, or record-level answers depending on permissions.

### 6. Accreditation and Document Workflow

The system includes dedicated route families for:

- NAAC criteria and documentation
- NBA criteria and status tracking
- document upload, review, and evidence support

These modules allow quality and compliance work to happen inside the same platform as academic monitoring.

### 7. Chatbot Flow

The Jorvis AI chatbot is exposed from `/api/chatbot` and supports:

- scoped chat responses
- data queries
- report-oriented replies
- insights and recommendations
- export endpoints for reports and insight documents

At a high level the flow is:

1. frontend sends a message
2. backend resolves authenticated access scope
3. query intent and domain are interpreted
4. RBAC filters and safe-scope checks are applied
5. response is returned as text, table, report, insight, or answer card
6. optional export endpoints produce downloadable output

The detailed admin query guide lives in [README_ADMIN_CHATBOT_QUERIES.md](README_ADMIN_CHATBOT_QUERIES.md).

### 8. Reports Flow

The reports layer combines live data, analytics, and export services. Depending on role and endpoint, the system can generate student, department, placement, documentation, and institutional summaries suitable for operational review.

## Project Structure

This is a trimmed structure view focused on the main building blocks:

```text
iqac-systemfinal/
+-- .github/
|   `-- workflows/
|       `-- ci.yml          # Basic GitHub Actions checks
+-- .gitignore              # Repo hygiene for envs, uploads, and build output
+-- backend/
|   +-- config/              # DB connection and backend configuration
|   +-- controllers/         # Route handlers for auth, analytics, placements, chatbot, etc.
|   +-- middleware/          # JWT auth, role checks, uploads, validation
|   +-- models/              # MongoDB/Mongoose data models
|   +-- routes/              # API route families under /api/*
|   +-- scripts/             # Seed and sync scripts
|   +-- services/            # Business logic, analytics, chatbot, report helpers
|   +-- uploads/             # Runtime uploads (ignored from Git)
|   +-- utils/               # Validation and helper utilities
|   +-- .env.example         # Example backend environment file
|   +-- package.json         # Backend scripts and dependencies
|   `-- server.js            # Main Express server entrypoint
+-- frontend/
|   +-- .env.example         # Example frontend environment file
|   +-- src/
|   |   +-- components/      # Shared UI, chatbot, placements, student/faculty widgets
|   |   +-- context/         # Auth and theme context
|   |   +-- pages/           # Dashboards, workspaces, reports, accreditation pages
|   |   +-- services/        # Axios API wrappers
|   |   +-- App.jsx          # Frontend route map
|   |   `-- main.jsx         # Frontend entrypoint
|   +-- package.json         # Frontend scripts and dependencies
|   `-- vite.config.js       # Dev proxy and build config
+-- app.py                   # Optional FastAPI Mongo query utility
`-- README_ADMIN_CHATBOT_QUERIES.md
```

## Data Model Overview

The backend model layer covers the core academic and institutional entities:

- `User` - authenticated platform user with role and access context
- `Student` - student master record and academic identity
- `Faculty` - faculty profile and department association
- `Department` - department metadata and academic grouping
- `Attendance` - attendance records used for monitoring and analytics
- `Marks` - marks and assessment records
- `Subject` - course or subject catalog entity
- `StudentSemesterPerformance` - semester-level academic summary
- `StudentSemesterAttendance` - semester-level attendance summary
- `StudentFeedback` - student-submitted feedback entries
- `Placement` - final placement outcomes
- `PlacementDrive` - company drives, eligibility criteria, and openings
- `PlacementApplication` - student applications to drives
- `ResearchPaper` - research publication data
- `Document` - uploaded academic, evidence, or workflow documents
- `Event` - event records and participation tracking
- `Achievement` / `FacultyAchievement` - student and faculty recognition or accomplishments
- `NAACCriteria` - NAAC criteria tracking and documentation
- `NBACriteria` - NBA criteria tracking and status
- `Notification` - user-facing notification data
- `Report` - stored/generated report metadata

## API Overview

This project uses grouped API families instead of a single monolithic route design.

### Core Authentication

- `/api/auth`
- Purpose: login, registration, staff account creation, password-related account operations
- Access: public login/register with role-sensitive protected actions

### Student Records and Student Self-Service

- `/api/students`
- `/api/student`
- Purpose:
  - `/api/students` supports institution-side student data access and monitoring
  - `/api/student` powers the personal student workspace
- Access:
  - admin/hod/faculty/staff for monitored record flows
  - student-only for self-service portal endpoints

### Faculty

- `/api/faculty`
- Purpose: faculty data, faculty workspace, subjects, students, and contribution-related flows
- Access: role-specific, especially `faculty`, `hod`, and `iqac_admin`

### Departments

- `/api/departments`
- Purpose: department summaries, performance, and management operations
- Access: primarily `iqac_admin`, `hod`, and some faculty views

### Analytics

- `/api/analytics`
- Purpose: KPIs, pass percentage, attendance, placement analytics, research analytics, CGPA trends, and department dashboards
- Access: varies by endpoint, usually `iqac_admin` and `hod`, with some faculty-safe analytics

### Placements

- `/api/placements`
- Purpose: placement records, placement stats, placement drives, and drive management
- Access: mainly `iqac_admin` and `hod`, with some faculty visibility

### Research

- `/api/research`
- Purpose: research publication management and research views
- Access: `faculty`, `hod`, and `iqac_admin` depending on action

### Reports

- `/api/reports`
- Purpose: generated report endpoints for student, department, backlog, workload, placement, and institutional reporting
- Access: mostly `iqac_admin`, `hod`, and selected `staff`

### Documents

- `/api/documents`
- Purpose: document upload, evidence management, and documentation review flows
- Access: role-dependent across admin, hod, and faculty

### Events, Achievements, Notifications

- `/api/events`
- `/api/achievements`
- `/api/notifications`
- Purpose: event management, participation, achievements, and user notifications
- Access: mixed role support, including student event participation where allowed

### Accreditation

- `/api/nba`
- `/api/naac`
- Purpose: accreditation criteria tracking, updates, and evidence/document workflows
- Access: mostly `iqac_admin` and `hod`, with limited faculty participation in some flows

### Chatbot

- `/api/chatbot`
- Purpose: scoped assistant responses, report exports, and insight exports
- Access: authenticated users only, with data visibility controlled per role

## Setup and Run Instructions

### Prerequisites

- Node.js 18+ recommended
- npm
- MongoDB or MongoDB Atlas access
- Python 3.10+ if you want to run `app.py`

### 1. Backend Setup

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env`, fill in your real credentials, then run:

```bash
npm run dev
```

Available backend scripts:

- `npm start`
- `npm run dev`
- `npm run seed:students`
- `npm run seed:marks`
- `npm run seed:placement`
- `npm run seed:all`
- `npm run seed:full`
- `npm run seed:new-features`
- `npm run reduce:research-citations`
- `npm run sync:research`
- `npm run sync:performance`

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env` if you want to override the default API target, then run:

```bash
npm run dev
```

Available frontend scripts:

- `npm run dev`
- `npm run build`
- `npm run preview`

By default, Vite proxies `/api` to `http://localhost:5000` during development.

### 3. Optional Python Utility

The root `app.py` is separate from the main application and can be used for direct MongoDB question answering. It reads `MONGO_URI` from the environment or from `backend/.env`.

Example setup:

```bash
pip install fastapi uvicorn pymongo pydantic
python app.py --server
```

Useful commands:

```bash
python app.py --dump
python app.py --server
```

Important note: treat `app.py` as a local support tool. It should use a private MongoDB URI and should not be treated as the production application server.

## Environment Variables

Use placeholder values only. Do not commit real credentials.

### Backend (`backend/.env`)

| Variable | Example | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | Backend server port |
| `MONGO_URI` | `mongodb+srv://<user>:<password>@<cluster>/<db>` | MongoDB connection string |
| `MONGO_DB_NAME` | `iqac_system` | Optional fallback database name for `app.py` |
| `JWT_SECRET` | `replace-with-a-long-random-secret` | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | Token expiry window |
| `FRONTEND_URL` | `http://localhost:5173` | Main frontend origin |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Allowed origins |
| `NODE_ENV` | `development` | Runtime environment |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name |
| `GEMINI_INTENT_MODEL` | `gemini-2.5-flash` | Optional Gemini intent model override |
| `GEMINI_INSIGHT_MODEL` | `gemini-1.5-flash` | Optional Gemini insight model override |
| `GEMINI_PARSER_MODEL` | `gemini-2.5-flash` | Optional Gemini parser model override |
| `GEMINI_API_KEY` | `your-gemini-api-key` | Optional Gemini access key |
| `DEFAULT_STUDENT_LOGIN_PASSWORD` | `Student@123` | Optional seeded student login password |

### Frontend (`frontend/.env`)

| Variable | Example | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Backend API base URL |

## GitHub Readiness

- The repository includes a root `.gitignore` so local dependencies, build output, uploads, logs, and private environment files stay out of Git.
- Use `backend/.env.example` and `frontend/.env.example` as the only committed configuration templates.
- `backend/uploads/` is runtime-only content and should stay untracked.
- `.github/workflows/ci.yml` provides a lightweight GitHub Actions check for frontend build and backend dependency installation.
- If the credentials in your current local `.env` files were ever shared outside this machine, rotate them before publishing.

## Deployment

This repo supports two deployment styles:

1. **Single service (recommended):** one Node service serves the API and the built frontend.
2. **Split services:** deploy backend and frontend separately and connect via `VITE_API_BASE_URL`.

### Option A: Single Service on Render (Recommended)

This repo includes `render.yaml`, so you can deploy straight from GitHub.

1. Push the repo to GitHub.
2. In Render, choose **New** -> **Blueprint** and select your repo.
3. Set required environment variables in Render:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `FRONTEND_URL` and `CORS_ORIGINS` (set to your Render URL, e.g. `https://<service>.onrender.com`)
   - Optional: `GEMINI_API_KEY`

Notes:
- In production, `backend/server.js` will serve `frontend/dist` automatically when `NODE_ENV=production` (or `SERVE_FRONTEND=true`) and a frontend build is present.

### Option B: Docker (Any Host)

Build and run:

```bash
docker build -t iqac-system .
docker run -p 5000:5000 --env-file backend/.env iqac-system
```

### Option C: Split Deploy (Vercel + Render/Any Backend Host)

1. Deploy the backend and set `CORS_ORIGINS` to include your frontend domain.
2. Deploy the frontend and set `VITE_API_BASE_URL` to your backend URL + `/api`.


## Sample Usage

Once the backend and frontend are running, try these flows:

### Admin / HOD

- login as `iqac_admin` or `hod`
- open `/dashboard`
- review KPIs, trends, department data, placements, and reports
- explore accreditation sections such as `/naac` and `/nba`

### Faculty

- login as `faculty`
- open the faculty workspace
- review subjects, assigned students, contributions, and documents

### Staff

- login as `staff`
- open `/staff-dashboard`
- manage users, student/faculty records, department details, and documentation flows

### Student

- login as `student`
- open `/student-dashboard/overview`
- review attendance, backlogs, documents, achievements, and placement status
- apply to placement opportunities when available

### Chatbot

- open Jorvis AI from the application UI
- ask about reports, placements, department performance, student progress, or personal academic support depending on role
- export supported chatbot reports or insights when needed

## Known Notes and Extensions

- `README_ADMIN_CHATBOT_QUERIES.md` is a companion guide specifically for chatbot query examples.
- `app.py` is separate from the main React/Express app and should be treated as an optional utility.
- Many routes are intentionally role-restricted by design.
- The frontend and backend are started separately; there is no root monorepo start script.
- For production or public sharing, keep all database credentials, JWT secrets, and API keys out of source control and out of documentation.

## Supplemental Files

- Chatbot query guide: [README_ADMIN_CHATBOT_QUERIES.md](README_ADMIN_CHATBOT_QUERIES.md)
- Optional Mongo utility: [app.py](app.py)
