-- Gemba Tools — Supabase (Postgres) şeması.
-- Supabase Dashboard > SQL Editor'de bir kere çalıştırılır. Mevcut database.json'daki veriyi
-- taşımaz (bilinçli karar: production'a temiz başlanıyor, bkz. bootstrap-production.ts).
--
-- Tasarım: auth-kritik üç varlık (organizations/users/invitations) gerçek, tipli tablolar;
-- geri kalan ~20 gevşek tipli koleksiyon (processes, kaizens, vsm_projects, five_s_*, vb.)
-- tek bir generic "records" tablosunda tutulur — src/server/db.ts'teki mevcut
-- FIVE_S_COLLECTIONS generic-CRUD deseninin tüm uygulamaya genelleştirilmiş hali.

create table if not exists organizations (
  id text primary key,
  organization_name text not null,
  domain text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  organization_id text not null references organizations(id),
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('Admin', 'Consultant', 'Customer User')),
  status text not null default 'Active' check (status in ('Active', 'Disabled')),
  last_login timestamptz,
  created_at timestamptz not null default now(),
  -- Only meaningful for role = 'Customer User': the specific customer(s) this account may access.
  assigned_customer_ids text[]
);

create table if not exists invitations (
  id text primary key,
  organization_id text not null references organizations(id),
  email text not null,
  role text not null check (role in ('Admin', 'Consultant', 'Customer User')),
  invitation_token text not null unique,
  expires_at timestamptz not null,
  accepted boolean not null default false,
  -- Set when the invite is scoped to one customer (Consultant or Customer User assignment).
  customer_id text
);
create index if not exists invitations_email_idx on invitations (email);

-- Generic store for every loosely-typed business collection (customers, processes, activities,
-- segments, kaizens, vsm_projects, opex_assessments, yamazumi_studies, copq_snapshots,
-- loss_capacity_settings, spaghetti_flow_settings, time_studies, smed_projects, ptr_records,
-- five_s_* x10, gemba_walk_findings). `data` holds the full record exactly as the app already
-- shapes it (including id/organization_id/factory_id duplicated inside), so application code
-- barely changes — only the storage primitive underneath each method does.
create table if not exists records (
  id text primary key,
  collection text not null,
  organization_id text not null,
  factory_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists records_scope_idx on records (collection, organization_id, factory_id);
