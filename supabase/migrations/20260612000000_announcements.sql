-- ============================================================
-- Worky — 공지/알림 기능 추가
-- 2026-06-12
-- ============================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL DEFAULT 'notice',
  title      text NOT NULL,
  content    text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "로그인 사용자 공지 조회" ON public.announcements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at         timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 읽음 기록만 조회" ON public.announcement_reads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 읽음 기록만 삽입" ON public.announcement_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_announcements_active_created
  ON public.announcements(is_active, created_at DESC);
