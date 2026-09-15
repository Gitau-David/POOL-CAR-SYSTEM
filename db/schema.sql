create table if not exists users (
  id            bigint generated always as identity primary key,
  name          text not null,
  role          text not null check (role in ('user','admin')),
  pin_hash      text,                          -- null for staff (name-only login)
  created_at    timestamptz not null default now()
);

create table if not exists vehicles (
  id            bigint generated always as identity primary key,
  reg_no        text unique not null,
  model         text not null,
  active        boolean not null default true, -- soft-delete instead of hard delete
  created_at    timestamptz not null default now()
);

create table if not exists drivers (
  id            bigint generated always as identity primary key,
  name          text not null,
  phone         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- One row per requisition. This IS the Allocation Log.
create table if not exists requisitions (
  id            bigint generated always as identity primary key,
  sno           bigint generated always as identity,
  requester     text not null,
  department    text not null,
  start_date    date not null,
  end_date      date not null,
  origin        text not null,
  destination   text not null,
  purpose       text,
  vehicle_id    bigint references vehicles(id),
  driver_id     bigint references drivers(id),
  status        text generated always as (
                   case
                     when vehicle_id is null then 'Pending Allocation'
                     when current_date > end_date then 'Completed'
                     when current_date >= start_date then 'Active'
                     else 'Scheduled'
                   end
                 ) stored,
  created_at    timestamptz not null default now(),
  allocated_at  timestamptz,
  check (end_date >= start_date)
);

-- Append-only audit trail — every submit / allocate / fleet change lands here
create table if not exists activity_log (
  id             bigint generated always as identity primary key,
  requisition_id bigint references requisitions(id),
  actor_role     text not null check (actor_role in ('user','admin','system')),
  action         text not null,          -- e.g. 'submitted', 'allocated', 'vehicle_added'
  details        jsonb,
  created_at     timestamptz not null default now()
);

-- Speeds up the double-booking / availability check (date-range overlap scan)
create index if not exists idx_req_vehicle_dates on requisitions (vehicle_id, start_date, end_date);
create index if not exists idx_req_driver_dates on requisitions (driver_id, start_date, end_date);

-- Row Level Security: all reads/writes for this app go through the server
-- (Next.js API routes) using the Supabase service-role key, which bypasses
-- RLS by design. RLS is enabled here as defense-in-depth in case the
-- anon/public key is ever exposed to the browser.
alter table users enable row level security;
alter table vehicles enable row level security;
alter table drivers enable row level security;
alter table requisitions enable row level security;
alter table activity_log enable row level security;

-- ---------------------------------------------------------------------
-- Seed data (safe to re-run: guarded by not-exists checks)
-- ---------------------------------------------------------------------
insert into vehicles (reg_no, model)
select * from (values
  ('UBD 094S', 'Toyota Hiace'),
  ('UA 991AB', 'Toyota Land Cruiser'),
  ('UBS 840H', 'Toyota Hilux')
) as v(reg_no, model)
where not exists (select 1 from vehicles where vehicles.reg_no = v.reg_no);

insert into drivers (name, phone)
select * from (values
  ('Ivan Mugisha', '0700 000 001'),
  ('Samuel Okello', '0700 000 002'),
  ('Grace Namuli', '0700 000 003')
) as d(name, phone)
where not exists (select 1 from drivers where drivers.name = d.name);

-- Demo admin account, PIN 1234 (sha256 hash — see lib/session.ts hashPin(),
-- which must stay in sync with this value).
insert into users (name, role, pin_hash)
select 'Fleet Manager', 'admin', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f'
where not exists (select 1 from users where name = 'Fleet Manager' and role = 'admin');

