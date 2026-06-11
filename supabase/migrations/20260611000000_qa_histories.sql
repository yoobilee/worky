-- ============================================================
-- Worky — QnA 히스토리 테이블 추가
-- 2026-06-11
-- ============================================================

CREATE TABLE IF NOT EXISTS public.qa_histories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  messages   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.qa_histories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 데이터만 조회" ON public.qa_histories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 데이터만 삽입" ON public.qa_histories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 데이터만 삭제" ON public.qa_histories
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_qa_histories_user_created
  ON public.qa_histories(user_id, created_at DESC);
