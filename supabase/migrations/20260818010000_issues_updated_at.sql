-- ============================================================
-- Worky — GitHub 웹훅 이벤트 순서 검증을 위한 issues.updated_at 컬럼
-- 2026-08-18
-- 오래된 웹훅 이벤트가 최신 상태를 덮어쓰지 않도록 이슈 갱신 시각을 저장.
-- ============================================================

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
