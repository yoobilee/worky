-- Keep fresh environments aligned with the deployed calendar_events schema.
-- The column is nullable text with no default; IF NOT EXISTS preserves environments
-- where it was added manually before this migration was introduced.
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_group_id text;
