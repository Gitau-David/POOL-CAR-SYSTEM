# Pool Car Dispatch — Requisition & Allocation System

A full-stack web app for requesting and allocating pool cars, backed by
**Supabase (PostgreSQL)**.

## Languages / stack

| Layer      | Technology |
|------------|------------|
| Frontend   | TypeScript, React (Next.js App Router), Tailwind CSS |
| Backend    | Node.js / TypeScript — Next.js API routes |
| Database   | PostgreSQL on Supabase, accessed via `@supabase/supabase-js` |
| Auth       | Custom signed session cookie (HMAC-SHA256) — no password for staff, name + PIN for admin |

Everything — frontend, backend, and database access — is TypeScript running
in one Next.js project. There's no separate backend server: the `app/api/*`
routes *are* the backend, and they talk to Supabase's Postgres database
directly with the service-role key.

## 1. Create the Supabase project & schema

1. Go to [supabase.com](https://supabase.com) → New project.
2. Once it's ready, open **SQL Editor → New query**, paste the entire
   contents of `db/schema.sql`, and run it. This creates all five tables
   (`users`, `vehicles`, `drivers`, `requisitions`, `activity_log`) and
   seeds 3 vehicles + 3 drivers + a demo admin account.
3. Open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role key** (not the anon key) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the two Supabase values above, plus:
- `SESSION_SECRET` — any long random string (used to sign the login cookie)
- `ADMIN_PIN` — defaults to `1234` to match the seeded demo admin account

## 3. Install & run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. You'll land on the **Choose role** page:
- **Staff** → name-only login → submit requisitions, view the dashboard.
- **Admin** → name + PIN (`1234` by default) → allocate vehicles, manage
  the fleet, plus everything staff can do.

## How the four pages map to the spec

- **Dashboard** (`/dashboard`) — live fleet/driver availability +
  "Requisitions & Scheduled Trips" table, polling the database every few
  seconds so it reflects new submissions/allocations without a manual
  refresh.
- **New Requisition** (`/request`) — the data-entry form. On submit it
  inserts a row with `vehicle_id`/`driver_id` still `NULL`; Postgres's
  generated `status` column immediately reads that as `Pending
  Allocation`. The confirmation shows the assigned `S.no`.
- **Allocate Vehicle** (`/admin/allocate`, admin only) — pick a pending
  requisition; the server (`GET /api/availability`) runs the date-overlap
  query against the database and returns only vehicles/drivers that are
  actually free — the admin never manually checks. Confirming calls
  `POST /api/requisitions/:id/allocate`, which re-runs that same check
  server-side before writing, so a stale client can't double-book.
- **Manage Fleet** (`/admin/fleet`, admin only) — add/remove vehicles and
  drivers. Removing one currently tied to a Scheduled or Active trip is
  blocked with an inline error; removal is a soft-delete (`active = false`)
  so history and the audit log stay intact.

Every submit, allocation, and fleet change writes a row to `activity_log`
for auditability, per the spec.

## Project structure

```
app/
  page.tsx                 Role-choice landing page
  login/user/page.tsx      Staff login (name only)
  login/admin/page.tsx     Admin login (name + PIN)
  dashboard/page.tsx       Availability + requisitions table
  request/page.tsx         New Requisition form
  admin/allocate/page.tsx  Allocate Vehicle (admin)
  admin/fleet/page.tsx     Manage Fleet (admin)
  api/                     Backend — one route file per endpoint
lib/
  supabase.ts              Server-side Supabase client (service role)
  data.ts                  All database queries (async)
  session.ts / auth.ts     Signed cookie session handling
  api.ts                   Client-side fetch wrappers used by the pages
  types.ts                 Shared TypeScript types
components/
  AppShell.tsx             Sidebar nav + session guard used by every page
  StatusBadge.tsx           Pending/Scheduled/Active/Completed status pill
db/
  schema.sql               Run this once in the Supabase SQL editor
```

## Notes

- The Postgres `status` column is a `GENERATED ALWAYS AS (...) STORED`
  expression, not something the app ever writes to directly — this is the
  exact bug class that was fixed in the earlier Excel version (a
  blank/unassigned row can never silently read as available or scheduled).
- Row Level Security is enabled on every table as defense-in-depth, but
  all access in this app goes through the server using the service-role
  key, which bypasses RLS by design — RLS matters if you ever expose the
  anon key to the browser directly.
- To deploy, push this to Vercel (or any Node host) and set the same
  three env vars there. No further Supabase configuration is needed.
