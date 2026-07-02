-- ============================================================================
-- Migration v3 — Expanded triage / remarks values
-- Run in Supabase Dashboard -> SQL Editor (safe to re-run)
-- ============================================================================

-- 1. Drop the old CHECK constraint (named automatically by Postgres)
ALTER TABLE public.sw_annotations
  DROP CONSTRAINT IF EXISTS sw_annotations_triage_status_check;

-- 2. Add updated CHECK with new remark values + legacy compat
ALTER TABLE public.sw_annotations
  ADD CONSTRAINT sw_annotations_triage_status_check
  CHECK (triage_status IN (
    'incorrectly_tagged',
    'ai_mistake',
    'visibility_issues',
    'sku_partially_visible',
    'ambiguous',
    -- Legacy values (kept for backward compatibility with existing rows)
    'confirmed',
    'bad_gt'
  ));
