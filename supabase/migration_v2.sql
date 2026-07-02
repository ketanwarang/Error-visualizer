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
