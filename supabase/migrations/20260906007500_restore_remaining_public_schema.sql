-- Restore production schema details that predate the repository history.
--
-- This migration preserves existing announcement read rows while replacing the
-- historical composite primary key with the hosted id primary key and an
-- equivalent composite UNIQUE constraint. It also restores hosted columns,
-- defaults, nullability, and owner policies used by current application code.
-- Privilege hardening remains isolated in the following migration.

ALTER TABLE public.announcement_reads
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.announcement_reads
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.announcement_reads
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

DO $$
DECLARE
  current_primary_key name;
BEGIN
  SELECT constraint_name.conname
  INTO current_primary_key
  FROM pg_catalog.pg_constraint AS constraint_name
  WHERE constraint_name.conrelid = 'public.announcement_reads'::regclass
    AND constraint_name.contype = 'p';

  IF current_primary_key IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS primary_key
    WHERE primary_key.conrelid = 'public.announcement_reads'::regclass
      AND primary_key.contype = 'p'
      AND primary_key.conkey = ARRAY[
        (
          SELECT attribute.attnum::smallint
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = 'public.announcement_reads'::regclass
            AND attribute.attname = 'id'
            AND NOT attribute.attisdropped
        )
      ]::smallint[]
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.announcement_reads DROP CONSTRAINT %I',
      current_primary_key
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS primary_key
    WHERE primary_key.conrelid = 'public.announcement_reads'::regclass
      AND primary_key.contype = 'p'
  ) THEN
    ALTER TABLE public.announcement_reads
      ADD CONSTRAINT announcement_reads_pkey PRIMARY KEY (id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS named_constraint
    WHERE named_constraint.conrelid = 'public.announcement_reads'::regclass
      AND named_constraint.conname = 'announcement_reads_user_id_announcement_id_key'
      AND NOT (
        named_constraint.contype = 'u'
        AND named_constraint.conkey = ARRAY[
          (
            SELECT attribute.attnum::smallint
            FROM pg_catalog.pg_attribute AS attribute
            WHERE attribute.attrelid = 'public.announcement_reads'::regclass
              AND attribute.attname = 'user_id'
              AND NOT attribute.attisdropped
          ),
          (
            SELECT attribute.attnum::smallint
            FROM pg_catalog.pg_attribute AS attribute
            WHERE attribute.attrelid = 'public.announcement_reads'::regclass
              AND attribute.attname = 'announcement_id'
              AND NOT attribute.attisdropped
          )
        ]::smallint[]
      )
  ) THEN
    RAISE EXCEPTION 'announcement_reads composite UNIQUE constraint name has an unexpected definition';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS unique_constraint
    WHERE unique_constraint.conrelid = 'public.announcement_reads'::regclass
      AND unique_constraint.contype = 'u'
      AND unique_constraint.conkey = ARRAY[
        (
          SELECT attribute.attnum::smallint
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = 'public.announcement_reads'::regclass
            AND attribute.attname = 'user_id'
            AND NOT attribute.attisdropped
        ),
        (
          SELECT attribute.attnum::smallint
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = 'public.announcement_reads'::regclass
            AND attribute.attname = 'announcement_id'
            AND NOT attribute.attisdropped
        )
      ]::smallint[]
  ) THEN
    ALTER TABLE public.announcement_reads
      ADD CONSTRAINT announcement_reads_user_id_announcement_id_key
      UNIQUE (user_id, announcement_id);
  END IF;
END;
$$;

DROP POLICY IF EXISTS "본인 읽음 기록만 조회" ON public.announcement_reads;
DROP POLICY IF EXISTS "본인 읽음 기록만 삽입" ON public.announcement_reads;
DROP POLICY IF EXISTS "본인 읽음 기록만 수정" ON public.announcement_reads;
DROP POLICY IF EXISTS "users can manage own reads" ON public.announcement_reads;
CREATE POLICY "users can manage own reads" ON public.announcement_reads
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "본인 데이터만 조회" ON public.qa_histories;
DROP POLICY IF EXISTS "본인 데이터만 삽입" ON public.qa_histories;
DROP POLICY IF EXISTS "본인 데이터만 수정" ON public.qa_histories;
DROP POLICY IF EXISTS "본인 데이터만 삭제" ON public.qa_histories;
DROP POLICY IF EXISTS "users can manage own qa histories" ON public.qa_histories;
CREATE POLICY "users can manage own qa histories" ON public.qa_histories
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.announcements
  ALTER COLUMN type SET DEFAULT 'patch'::text,
  ALTER COLUMN is_active DROP NOT NULL;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS kakao_chat_name text,
  ADD COLUMN IF NOT EXISTS report_template text;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'ko'::text,
  ADD COLUMN IF NOT EXISTS speed_dial_custom jsonb DEFAULT '[]'::jsonb;

UPDATE public.user_settings
SET language = 'ko'::text
WHERE language IS NULL;

ALTER TABLE public.user_settings
  ALTER COLUMN language SET DEFAULT 'ko'::text,
  ALTER COLUMN language SET NOT NULL,
  ALTER COLUMN speed_dial_custom SET DEFAULT '[]'::jsonb;
