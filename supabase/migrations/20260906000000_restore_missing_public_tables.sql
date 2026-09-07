-- Restore production tables that predate the repository migration history.
--
-- Production metadata was inspected read-only before this migration was
-- written. CREATE TABLE IF NOT EXISTS leaves the existing production objects
-- untouched while allowing a clean local database to reproduce them.
-- Policies are added only when their production policy name is absent.
-- Privilege hardening is intentionally handled by the following migration.

CREATE TABLE IF NOT EXISTS public.members (
  id uuid CONSTRAINT contacts_pkey PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    CONSTRAINT contacts_user_id_fkey
    REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  position text,
  department text,
  phone text,
  email text,
  kakao_id text,
  birthday text,
  memo text,
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_cleaner_history (
  id uuid CONSTRAINT data_cleaner_history_pkey PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    CONSTRAINT data_cleaner_history_user_id_fkey
    REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text text NOT NULL,
  result_html text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seating_desks (
  id uuid CONSTRAINT seating_desks_pkey PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    CONSTRAINT seating_desks_user_id_fkey
    REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid
    CONSTRAINT seating_desks_member_id_fkey
    REFERENCES public.members(id) ON DELETE SET NULL,
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  rotation integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid CONSTRAINT user_notifications_pkey PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    CONSTRAINT user_notifications_user_id_fkey
    REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'schedule'::text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_cleaner_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_desks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.members'::regclass
      AND polname = '본인 데이터만 조회'
  ) THEN
    CREATE POLICY "본인 데이터만 조회" ON public.members
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.members'::regclass
      AND polname = '본인 데이터만 삽입'
  ) THEN
    CREATE POLICY "본인 데이터만 삽입" ON public.members
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.members'::regclass
      AND polname = '본인 데이터만 수정'
  ) THEN
    CREATE POLICY "본인 데이터만 수정" ON public.members
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.members'::regclass
      AND polname = '본인 데이터만 삭제'
  ) THEN
    CREATE POLICY "본인 데이터만 삭제" ON public.members
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.data_cleaner_history'::regclass
      AND polname = '본인 데이터만 조회'
  ) THEN
    CREATE POLICY "본인 데이터만 조회" ON public.data_cleaner_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.data_cleaner_history'::regclass
      AND polname = '본인 데이터만 삽입'
  ) THEN
    CREATE POLICY "본인 데이터만 삽입" ON public.data_cleaner_history
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.data_cleaner_history'::regclass
      AND polname = '본인 데이터만 삭제'
  ) THEN
    CREATE POLICY "본인 데이터만 삭제" ON public.data_cleaner_history
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.seating_desks'::regclass
      AND polname = '본인 데이터만 조회'
  ) THEN
    CREATE POLICY "본인 데이터만 조회" ON public.seating_desks
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.seating_desks'::regclass
      AND polname = '본인 데이터만 삽입'
  ) THEN
    CREATE POLICY "본인 데이터만 삽입" ON public.seating_desks
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.seating_desks'::regclass
      AND polname = '본인 데이터만 수정'
  ) THEN
    CREATE POLICY "본인 데이터만 수정" ON public.seating_desks
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.seating_desks'::regclass
      AND polname = '본인 데이터만 삭제'
  ) THEN
    CREATE POLICY "본인 데이터만 삭제" ON public.seating_desks
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.user_notifications'::regclass
      AND polname = '본인 알림만 조회'
  ) THEN
    CREATE POLICY "본인 알림만 조회" ON public.user_notifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.user_notifications'::regclass
      AND polname = '본인 알림만 삽입'
  ) THEN
    CREATE POLICY "본인 알림만 삽입" ON public.user_notifications
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.user_notifications'::regclass
      AND polname = '본인 알림만 수정'
  ) THEN
    CREATE POLICY "본인 알림만 수정" ON public.user_notifications
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.user_notifications'::regclass
      AND polname = '본인 알림만 삭제'
  ) THEN
    CREATE POLICY "본인 알림만 삭제" ON public.user_notifications
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END;
$$;
