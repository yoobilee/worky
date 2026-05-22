-- ============================================================
-- Worky — Initial Schema Migration
-- 2026-05-22
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. user_settings
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_info      jsonb    DEFAULT '{}'::jsonb,   -- 발신자 정보 (이름, 부서, 직책 등)
  menu_settings    jsonb    DEFAULT '{}'::jsonb,   -- 메뉴 활성화 여부 맵
  menu_order       text[]   DEFAULT '{}'::text[],  -- 사이드바 메뉴 순서
  help_button      boolean  DEFAULT true,
  job_preset       text,                           -- 직업군 프리셋 키
  theme            text     DEFAULT 'system',      -- 'light' | 'dark' | 'system'
  sidebar_collapsed boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- ──────────────────────────────────────────────────────────
-- 2. todos
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.todos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,               -- 'YYYY-MM-DD'
  todos      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- ──────────────────────────────────────────────────────────
-- 3. memos
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_memo     text DEFAULT '',
  meeting_memo  text DEFAULT '',
  personal_memo text DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- ──────────────────────────────────────────────────────────
-- 4. calendar_events
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  date        date NOT NULL,
  time        text,
  location    text,
  description text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 5. clients
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  contact_person   text,
  phone            text,
  link             text,
  tags             jsonb    DEFAULT '[]'::jsonb,
  contract_start   date,
  contract_period  text,
  memo             text,
  status           text     DEFAULT 'active',  -- 'active' | 'inactive'
  history          jsonb    DEFAULT '[]'::jsonb,
  progress         jsonb    DEFAULT '[]'::jsonb,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 6. glossary
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.glossary (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term        text NOT NULL,
  definition  text,
  category    text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 7. usage_stats
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_stats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date NOT NULL,             -- 주 시작일 (월요일 기준)
  stats       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);


-- ============================================================
-- updated_at 자동 갱신 트리거 함수
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_settings', 'todos', 'memos',
    'calendar_events', 'clients', 'glossary', 'usage_stats'
  ]
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON public.%s
       FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;


-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_settings', 'todos', 'memos',
    'calendar_events', 'clients', 'glossary', 'usage_stats'
  ]
  LOOP
    -- RLS 활성화
    EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY;', tbl);

    -- SELECT
    EXECUTE format(
      'CREATE POLICY "본인 데이터만 조회" ON public.%s
       FOR SELECT USING (auth.uid() = user_id);', tbl
    );
    -- INSERT
    EXECUTE format(
      'CREATE POLICY "본인 데이터만 삽입" ON public.%s
       FOR INSERT WITH CHECK (auth.uid() = user_id);', tbl
    );
    -- UPDATE
    EXECUTE format(
      'CREATE POLICY "본인 데이터만 수정" ON public.%s
       FOR UPDATE USING (auth.uid() = user_id);', tbl
    );
    -- DELETE
    EXECUTE format(
      'CREATE POLICY "본인 데이터만 삭제" ON public.%s
       FOR DELETE USING (auth.uid() = user_id);', tbl
    );
  END LOOP;
END;
$$;


-- ============================================================
-- 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_todos_user_date       ON public.todos(user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_user_date    ON public.calendar_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_clients_user_id       ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_glossary_user_term    ON public.glossary(user_id, term);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_week ON public.usage_stats(user_id, week_start);
