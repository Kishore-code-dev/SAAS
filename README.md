# DriveMitra — Multi-Tenant Fleet Operations & Vehicle Finance SaaS

DriveMitra is a full-stack multi-tenant SaaS ERP built for commercial fleet operators. It combines self-serve workspace onboarding, strict server-enforced tenant isolation, role-based access control (RBAC), subscription & GST billing management, live corridor tracking, fuel & maintenance workflows, and vehicle loan/EMI finance operations.

## Core SaaS Capabilities

- **Self-Serve Workspace Onboarding (`/signup`, `POST /api/auth/register`)**: Fleet organizations can launch an isolated tenant workspace with a 14-day full-feature trial, dedicated owner (`org_admin`) credentials, HttpOnly session cookies, and an automated trial entry in the SaaS billing ledger.
- **Multi-Tenant Isolation & Platform Super Admin (`/platform-admin`)**: Strict `organization_id` scoping across SQLite tables (`organizations`, `users`, `auth_sessions`, `org_fleet_blobs`, `saas_billing_invoices`, normalized Fleetio/finance tables), instant tenant suspension/session revocation, and audit logging.
- **Subscription Tiers, Seat Quotas & GST Invoicing (`/dashboard/subscription`, `GET/PATCH /api/fleet/subscription`)**:
  - Monthly and Annual (20% off) billing cycles across **Starter**, **Growth**, and **Enterprise** plans.
  - Real-time Vehicle & Driver seat quota meters and server-side `PLAN_LIMIT_EXCEEDED` enforcement in `PUT /api/fleet/state`.
  - Automatic 18% GST tax invoice generation (`saas_billing_invoices`) with downloadable tax receipts.
- **Role-Based Access Control (RBAC)**: Enforces least-privilege permissions across `platform_admin`, `org_admin`, `fleet_manager`, `maintenance`, `finance`, and `viewer`.
- **Operations & Finance Modules**:
  - Live satellite corridor map, trip dispatch, and driver safety scoring.
  - Predictive component intelligence, work orders, parts inventory, purchase orders, and inspection forms.
  - Vehicle Finance & EMI ledger, bank/NBFC institution management, payment reconciliation, and document vault.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router v7, TanStack Query, Leaflet, Recharts
- **Backend**: Express 5 (`server.ts`), Node.js native `node:sqlite`, scrypt password hashing, SHA-256 HttpOnly session tokens
- **Testing**: Vitest + Testing Library + `node:test` (`tsx --test`)

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` if optional integrations (e.g. `GEMINI_API_KEY`, `SMTP_HOST`) are needed:
   ```bash
   cp .env.example .env
   ```

3. **Run development server** (Express API + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```

4. **Verify build, lint, and tests**:
   ```bash
   npm run build
   npm run lint
   npm test
   ```

5. **Run production server**:
   ```bash
   npm start
   ```
