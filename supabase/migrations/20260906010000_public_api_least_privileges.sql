-- Restrict Data API client roles to the operations used by Worky.
--
-- service_role is intentionally left unchanged. It is used by trusted server,
-- webhook, scheduled workflow, and Edge Function paths and bypasses RLS.
--
-- The preceding migration restores the four production tables that were absent
-- from the repository history. Missing prerequisites fail closed so an
-- incomplete database cannot silently record this security migration as applied.

DO $$
DECLARE
  table_name text;
  grant_spec record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'announcement_reads',
    'announcements',
    'calendar_events',
    'clients',
    'data_cleaner_history',
    'glossary',
    'issues',
    'members',
    'memos',
    'qa_histories',
    'seating_desks',
    'todos',
    'usage_stats',
    'user_notifications',
    'user_settings'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Required table public.% is missing', table_name;
    END IF;

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      table_name
    );
  END LOOP;

  FOR grant_spec IN
    SELECT *
    FROM (VALUES
      -- The unauthenticated keep-alive workflow performs this read. RLS returns no rows.
      ('user_settings',       'anon',          'SELECT'),

      ('announcements',       'authenticated', 'SELECT'),
      ('announcement_reads',  'authenticated', 'SELECT, INSERT, UPDATE'),
      ('calendar_events',     'authenticated', 'SELECT, INSERT, UPDATE, DELETE'),
      ('clients',             'authenticated', 'SELECT, INSERT, UPDATE, DELETE'),
      ('data_cleaner_history','authenticated', 'SELECT, INSERT, DELETE'),
      ('glossary',            'authenticated', 'SELECT, INSERT, UPDATE, DELETE'),
      ('issues',              'authenticated', 'SELECT, INSERT, UPDATE'),
      ('members',             'authenticated', 'SELECT, INSERT, UPDATE, DELETE'),
      ('memos',               'authenticated', 'SELECT, INSERT, UPDATE'),
      ('qa_histories',        'authenticated', 'SELECT, INSERT, UPDATE'),
      ('seating_desks',       'authenticated', 'SELECT, INSERT, UPDATE, DELETE'),
      ('todos',               'authenticated', 'SELECT, INSERT, UPDATE'),
      ('usage_stats',         'authenticated', 'SELECT, INSERT, UPDATE'),
      ('user_notifications',  'authenticated', 'SELECT, INSERT, UPDATE'),
      ('user_settings',       'authenticated', 'SELECT, INSERT, UPDATE')
    ) AS grants(table_name, role_name, privilege_list)
  LOOP
    EXECUTE format(
      'GRANT %s ON TABLE public.%I TO %I',
      grant_spec.privilege_list,
      grant_spec.table_name,
      grant_spec.role_name
    );
  END LOOP;
END;
$$;

-- Tables and sequences created later by postgres in public require explicit
-- client grants, provided no global defaults or inherited grants allow access.
-- These changes do not affect existing objects, which are handled above.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- Function defaults are deferred. A schema-scoped REVOKE does not remove the
-- built-in global PUBLIC EXECUTE default. Revoking it globally would also affect
-- other schemas and needs a separate review of platform/application functions.
-- New sensitive functions must explicitly REVOKE EXECUTE in their own migration.

-- supabase_admin owns a separate set of default privileges in the hosted
-- database. They are intentionally not changed here: migration runners are not
-- guaranteed to be a member of that internal role. Apply the equivalent default
-- privilege changes separately only after Supabase confirms that doing so is
-- supported for the project.

-- Prevent an authenticated user from assigning a desk to another user's member.
-- The existing permissive owner policies continue to authorize the operation;
-- these restrictive policies add a tenant-consistency requirement.
DO $$
BEGIN
  IF to_regclass('public.seating_desks') IS NULL
     OR to_regclass('public.members') IS NULL THEN
    RAISE EXCEPTION 'Required seating ownership tables are missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.seating_desks AS desk
    JOIN public.members AS member ON member.id = desk.member_id
    WHERE desk.member_id IS NOT NULL
      AND member.user_id <> desk.user_id
  ) THEN
    RAISE EXCEPTION 'Cross-user seating member references must be repaired before applying ownership guards';
  END IF;

  DROP POLICY IF EXISTS seating_desks_member_owner_insert_guard
    ON public.seating_desks;
  CREATE POLICY seating_desks_member_owner_insert_guard
    ON public.seating_desks
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
      (SELECT auth.uid()) = user_id
      AND (
        member_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.members AS member
          WHERE member.id = seating_desks.member_id
            AND member.user_id = seating_desks.user_id
        )
      )
    );

  DROP POLICY IF EXISTS seating_desks_member_owner_update_guard
    ON public.seating_desks;
  CREATE POLICY seating_desks_member_owner_update_guard
    ON public.seating_desks
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK (
      (SELECT auth.uid()) = user_id
      AND (
        member_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.members AS member
          WHERE member.id = seating_desks.member_id
            AND member.user_id = seating_desks.user_id
        )
      )
    );
END;
$$;

-- Existing function privileges are deliberately unchanged:
-- - reset_guest_demo_data() is already executable only by postgres/service_role.
-- - handle_updated_at() is trigger-only, but its EXECUTE privilege is deferred
--   until trigger behavior is verified against the production PostgreSQL version.
