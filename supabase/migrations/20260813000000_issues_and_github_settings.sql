-- ============================================================
-- Worky — issues 테이블 문서화, user_settings에 GitHub 연동 컬럼 추가
-- 2026-08-13
-- issues 테이블은 이미 SQL Editor에서 생성되어 자동 파이프라인(CodeRabbit
-- 결함 자동 등록)에서 운영 중. 이 마이그레이션은 스키마를 코드베이스에
-- 기록하는 목적. CREATE POLICY는 IF NOT EXISTS를 지원하지 않아
-- DROP POLICY IF EXISTS로 먼저 제거 후 재생성해 재실행 가능하게 함.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.issues (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id),
  source               text NOT NULL CHECK (source IN ('auto-pipeline', 'manual')),
  title                text NOT NULL,
  description          text NOT NULL,
  severity             text,
  repo                 text NOT NULL,
  github_issue_number  integer,
  github_issue_url     text,
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "본인 이슈만 조회" ON public.issues;
CREATE POLICY "본인 이슈만 조회" ON public.issues
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "본인 이슈만 삽입" ON public.issues;
CREATE POLICY "본인 이슈만 삽입" ON public.issues
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_settings에 GitHub 연동 컬럼 추가
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS github_pat  text,
  ADD COLUMN IF NOT EXISTS github_repo text;
