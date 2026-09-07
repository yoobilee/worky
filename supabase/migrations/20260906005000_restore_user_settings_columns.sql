-- Columns used by getSettings() but absent from the recorded schema history.
-- Confirmed using production metadata SELECTs on 2026-09-07. All six columns
-- are nullable, with no additional CHECK/UNIQUE/FK constraints. Existing hosted
-- definitions are left unchanged. PostgreSQL appends newly added local columns;
-- their ordinal positions therefore need not match the hosted table.
-- This file restores schema only; API privilege changes remain separate.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS custom_field_keys jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS join_date date,
  ADD COLUMN IF NOT EXISTS leave_standard text DEFAULT 'fiscal_year'::text,
  ADD COLUMN IF NOT EXISTS used_leaves numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'new'::text,
  ADD COLUMN IF NOT EXISTS granted_leaves numeric DEFAULT 0;
