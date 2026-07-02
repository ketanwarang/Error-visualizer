-- ============================================================================
-- ShelfWatch Error Annotation Portal — Supabase schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

create extension if not exists "pgcrypto";

-- One row per uploaded df_out CSV
create table if not exists public.sw_datasets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  created_at    timestamptz not null default now(),
  total_rows    integer not null default 0,   -- all rows in the source CSV
  error_rows    integer not null default 0,   -- SKU rows with wrong_group/wrong_class
  image_count   integer not null default 0,
  has_class_info boolean not null default false
);

-- Only error rows are persisted (the portal's working set)
create table if not exists public.sw_annotations (
  id                   bigint generated always as identity primary key,
  dataset_id           uuid not null references public.sw_datasets(id) on delete cascade,
  image_id             text not null,
  url                  text not null,
  shop_name            text,
  category_name        text,
  visit_date           text,
  annotation_id        text,
  actual_class         text,
  predicted_class      text,
  actual_group         text,
  predicted_group      text,
  wrong_group          smallint not null default 0,
  wrong_class          smallint not null default 0,
  x_min                double precision not null,
  y_min                double precision not null,
  x_max                double precision not null,
  y_max                double precision not null,
  annotated_image_link text
);

-- Optional: SKU reference images from the group/class info CSV
create table if not exists public.sw_class_images (
  id         bigint generated always as identity primary key,
  dataset_id uuid not null references public.sw_datasets(id) on delete cascade,
  class_name text not null,
  image_url  text not null
);

create index if not exists sw_ann_dataset_idx  on public.sw_annotations (dataset_id);
create index if not exists sw_ann_image_idx    on public.sw_annotations (dataset_id, image_id);
create index if not exists sw_cls_dataset_idx  on public.sw_class_images (dataset_id, class_name);

-- ----------------------------------------------------------------------------
-- RLS: open to the anon key for an internal tool.
-- To lock this behind magic-link auth later, replace `using (true)` with
-- `using (auth.role() = 'authenticated')` (and same for `with check`).
-- ----------------------------------------------------------------------------
alter table public.sw_datasets     enable row level security;
alter table public.sw_annotations  enable row level security;
alter table public.sw_class_images enable row level security;

drop policy if exists "sw_datasets_all"     on public.sw_datasets;
drop policy if exists "sw_annotations_all"  on public.sw_annotations;
drop policy if exists "sw_class_images_all" on public.sw_class_images;

create policy "sw_datasets_all"     on public.sw_datasets     for all using (true) with check (true);
create policy "sw_annotations_all"  on public.sw_annotations  for all using (true) with check (true);
create policy "sw_class_images_all" on public.sw_class_images for all using (true) with check (true);
-- ============================================================================
-- Migration v2 — triage + remarks + device review sessions
-- Run in Supabase Dashboard -> SQL Editor (safe to re-run)
-- ============================================================================

-- 1. Triage status + remarks on every error annotation
alter table public.sw_annotations
  add column if not exists triage_status text
    check (triage_status in ('confirmed', 'bad_gt', 'ambiguous')),
  add column if not exists remarks text;

-- 2. Review sessions — one per (device, dataset), no login required.
--    The device_id is a random UUID stored in the browser's localStorage.
create table if not exists public.sw_sessions (
  id            bigint generated always as identity primary key,
  device_id     text not null,
  device_label  text,
  dataset_id    uuid not null references public.sw_datasets(id) on delete cascade,
  image_index   integer not null default 0,
  total_images  integer not null default 0,
  updated_at    timestamptz not null default now(),
  unique (device_id, dataset_id)
);

create index if not exists sw_sessions_device_idx
  on public.sw_sessions (device_id, updated_at desc);

alter table public.sw_sessions enable row level security;
drop policy if exists "sw_sessions_all" on public.sw_sessions;
create policy "sw_sessions_all" on public.sw_sessions
  for all using (true) with check (true);
