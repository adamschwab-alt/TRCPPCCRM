# Redland CRM & Pipeline Tracker

A web-based CRM and Pipeline Tracker for **The Redland Company (TRC)** — civil site development and infrastructure contractor (SE Florida). Replaces a fully manual pipeline/backlog/margin process with a structured, opt-in, modular system.

The build is intentionally simple. Big buttons, obvious workflows, mobile-first.

---

## Tech Stack

- **Frontend** — React 18 + TypeScript + Vite + Tailwind CSS + Recharts + React Router
- **Backend** — Node.js + Express + TypeScript + Zod
- **Database** — PostgreSQL 16 + Prisma ORM
- **Auth** — Username/password + bcrypt + JWT (12-hour session)
- **Container** — Docker + docker-compose
- **Deployment** — Azure-ready (App Service / Container Instances / Container Apps)

---

## Quick Start (Local, Docker)

```bash
docker compose up --build
```

Once running:

| Service          | URL                                        |
| ---------------- | ------------------------------------------ |
| Web app          | http://localhost:8080                      |
| API              | http://localhost:4000/api                  |
| Postgres         | `postgresql://redland:redland@localhost:5432/redland` |

The first boot will run the Prisma migration and seed users + dropdown options. The DB starts blank of opportunity/customer data.

---

## Default Credentials

All seeded users share the default password **`Redland2026!`**. Every account is flagged `must_change_password = true`, so the first login forces a password change.

| Username         | Name                    | Role        |
| ---------------- | ----------------------- | ----------- |
| `chad.munz`      | Chad Munz               | Leadership  |
| `pinky.munz`     | Pinky Munz              | Leadership  |
| `david.merring`  | David Merring           | Estimator   |
| `jon.hegler`     | Jon Hegler (Finance)    | Read-Only   |
| `eddie`          | Eddie (BD)              | Read-Only   |
| `estimator2/3/4` | Estimators              | Estimator   |
| `pm1/pm2/pm3`    | Project Managers        | PM          |
| `adam.schwab`    | Adam Schwab (PPC)       | **Admin**   |

> Admins manage users, modules, dropdowns, and thresholds from the **Admin** screen.

---

## Local Dev (without Docker)

```bash
# 1. Start Postgres locally (or use the Docker db service)
docker compose up db

# 2. Backend
cd backend
cp .env.example .env  # if you create one; otherwise set DATABASE_URL/JWT_SECRET inline
export DATABASE_URL="postgresql://redland:redland@localhost:5432/redland"
export JWT_SECRET="dev-secret"
npm install
npx prisma db push           # creates the schema (or use `prisma migrate dev` to track migrations)
npm run seed
npm run dev    # listens on :4000

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev    # http://localhost:5173 (proxies /api -> :4000)
```

---

## Module Architecture

Each module after Module 1 is **opt-in**. Toggle modules in **Admin → Modules** (requires Admin or Leadership role).

| # | Module                       | Status | Toggle key                              |
| - | ---------------------------- | ------ | --------------------------------------- |
| 1 | Pipeline / Opportunity Mgmt  | MVP — always on | n/a                            |
| 2 | Go/No-Go Decision Framework  | Opt-in | `module_go_no_go_enabled`               |
| 3 | Bid Tracking & Analytics     | Opt-in | `module_bid_analytics_enabled`          |
| 4 | Estimator Workload & Capacity| Opt-in | `module_estimator_workload_enabled`     |
| 5 | Customer Management          | Opt-in | `module_customer_mgmt_enabled`          |
| 6 | Backlog Overview             | Opt-in | `module_backlog_enabled`                |
| 7 | Reporting Dashboard          | Opt-in | `module_dashboard_enabled`              |

**Deferred to Phase 2** (data hooks present, UI not built):
- Post-Project Feedback Loop (estimating ↔ execution) — `PostProjectReview` table stub
- Integrations (Sage 300, HeavyBid, Agtek, ProjectSight, SkyBitz) — `IntegrationLog` table stub

---

## Roles & Permissions

| Role         | Read pipeline | Create/Edit opportunities | Notes | Admin |
| ------------ | :---: | :---: | :---: | :---: |
| Admin        | ✓ | ✓ | ✓ | ✓ |
| Leadership   | ✓ | ✓ | ✓ | ✓ (no user CRUD) |
| Estimator    | ✓ | ✓ | ✓ | — |
| PM           | ✓ | ✓ | ✓ | — |
| Read-Only    | ✓ | — | — | — |

---

## Data Model (Text ERD)

```
User ─┬─< Opportunity (estimatorId)         OpportunityNote >─┐
      ├─< Opportunity (pmId)                                  │
      ├─< Customer    (ownerId)             StageHistory >────┤
      └─< GoNoGoDecisionRecord (approverId)                   │
                                                              ▼
Customer ─< Opportunity (customerId) ─────< OpportunityNote, StageHistory, GoNoGoDecisionRecord

Setting           (key/value config; module toggles, weights, thresholds)
DropdownOption    (category, value, sortOrder, isActive)

Phase-2 stubs:
  PostProjectReview  (foreign key reserved to Opportunity)
  IntegrationLog     (source-tagged JSON payloads)
```

**Audit & soft delete:**
- Every table has `createdAt`, `updatedAt`, and `createdById/updatedById` where applicable.
- All deletes are soft (`isArchived = true`); records are never hard-deleted.
- All currency stored as integer cents (BigInt). All dates stored UTC, rendered in `America/New_York`.

**Enums:**
- `PipelineStage` — LEAD, REVIEWING_ITB, GO_NO_GO, ESTIMATING, BID_SUBMITTED, AWAITING_DECISION, WON, LOST, NO_BID, WITHDRAWN
- `Role` — ADMIN, LEADERSHIP, ESTIMATOR, PM, READ_ONLY
- `CustomerType` — GC, DEVELOPER, GOVERNMENT, OWNER_DIRECT
- `RelationshipTier` — PLATINUM, GOLD, SILVER, NEW
- `BacklogStatus` — ACTIVE, COMPLETE, ON_HOLD, CANCELLED
- `GoNoGoDecision` — GO, NO_GO, DEFER

---

## Module Toggle Instructions

1. Log in as an **Admin** or **Leadership** user.
2. Click **Admin** in the nav bar.
3. Open the **Modules** tab.
4. Flip the switch for any opt-in module and click **Save**.
5. The UI reflects the change immediately — disabled modules show a "Module disabled" placeholder on their page, and Admin Settings link is hidden from the nav for users who can't access it.

The same Admin screen also lets you:
- Adjust **estimator capacity threshold**, **default bid margin**, and **Go/No-Go approval limits** (Config tab)
- Tune **Go/No-Go scoring weights** so they sum to 100 (Config tab)
- Add/deactivate users and reset passwords (Users tab)
- Add new dropdown options for regions/project types/scopes/loss reasons/no-bid reasons/sources (Dropdowns tab)

---

## Azure Deployment Guide

The app deploys cleanly to Azure with three components:

### Option A — Azure Container Apps (recommended)

1. **Create the database** — *Azure Database for PostgreSQL Flexible Server*. Grab the connection string.
2. **Build & push images** to *Azure Container Registry* (ACR):
   ```bash
   az acr build -r <your-acr> -t redland-backend:latest ./backend
   az acr build -r <your-acr> -t redland-frontend:latest ./frontend
   ```
3. **Create a Container Apps environment** and two apps:
   - **backend** — image `redland-backend:latest`, port `4000`. Env: `DATABASE_URL`, `JWT_SECRET`. Ingress: internal.
   - **frontend** — image `redland-frontend:latest`, port `80`. Ingress: external. Add a custom domain when ready.
4. **Schema sync & seed** run automatically on backend container start (`prisma db push --accept-data-loss && node dist/seed.js && node dist/index.js`). For migration-tracked deployments, replace `db push` with `migrate deploy` and check generated migrations into source control under `backend/prisma/migrations/`.

### Option B — Azure App Service (Container)

1. Push images to ACR as above.
2. Deploy each as a separate Linux Container App Service. Configure App Settings for `DATABASE_URL` and `JWT_SECRET`. Wire the frontend's nginx proxy to the backend's public URL (override `nginx.conf` if needed).

### Option C — Container Instances (lowest cost / demo)

Use the same images. Spin up a single `docker-compose.yml`-style ACI deployment via:
```bash
az container create --resource-group redland-rg --file aci.yml
```

### Critical Production Settings

- **`JWT_SECRET`** — Replace the development default with a random 64+ character string.
- **HTTPS** — Front-end nginx is HTTP-only by default. Terminate TLS at Azure Front Door, Container App ingress, or a custom domain binding.
- **DB backups** — Enable point-in-time restore on Azure DB for PostgreSQL Flexible Server (default: 7-day retention).
- **Default password** — Rotate `Redland2026!` on first deploy. All seeded users are flagged `mustChangePwd`, so they cannot keep the default.

---

## Branding

- Primary red — `#8B1A1A`
- Charcoal — `#2D2D2D`
- Gold accent — `#C9A84C`
- Light gray — `#F5F5F5`
- Font — Inter (loaded from Google Fonts)

Drop a real logo at `frontend/public/logo.png` and swap the `<div>R</div>` placeholder in `frontend/src/components/Layout.tsx` when ready.

---

## Common Tasks

| Task                                | How                                                                 |
| ----------------------------------- | ------------------------------------------------------------------- |
| Reset a user password               | Admin → Users → "Reset PW"                                          |
| Add a new dropdown option           | Admin → Dropdowns                                                   |
| Change capacity threshold           | Admin → Configuration                                               |
| Adjust Go/No-Go weights             | Admin → Configuration (target total: 100%)                          |
| Export the pipeline                 | Pipeline screen → "Export CSV"                                      |
| Archive an opportunity              | Opportunity detail → "Archive" (admin/leadership only, soft delete) |

---

## Project Structure

```
.
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.ts          # Express server + all routes
│       ├── auth.ts           # JWT + role middleware
│       ├── db.ts             # Prisma client
│       ├── util.ts           # money/date helpers, project numbering
│       └── seed.ts           # users + dropdowns + settings seed
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx · App.tsx · api.ts · auth.tsx · settings.tsx · types.ts
        ├── components/
        │   ├── Layout.tsx · Modal.tsx
        │   ├── OpportunityForm.tsx
        │   ├── StageChangePrompt.tsx
        │   └── GoNoGoForm.tsx
        └── pages/
            ├── Login.tsx · ChangePassword.tsx
            ├── Dashboard.tsx          # Module 7
            ├── Pipeline.tsx           # Module 1 (MVP)
            ├── OpportunityDetail.tsx  # Module 1 + Module 2
            ├── BidAnalytics.tsx       # Module 3
            ├── EstimatorWorkload.tsx  # Module 4
            ├── Customers.tsx          # Module 5
            ├── Backlog.tsx            # Module 6
            └── AdminSettings.tsx
```

---

## License & Ownership

Built by **Palm Peak Capital (PPC)** for **The Redland Company**. Single-tenant deployment.
