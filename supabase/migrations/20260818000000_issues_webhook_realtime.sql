-- ============================================================
-- Worky — GitHub Webhook 기반 이슈 상태 자동 동기화
-- 2026-08-18
-- user_settings에 웹훅 시크릿/ID 컬럼 추가.
-- issues 테이블을 Supabase Realtime publication에 추가해 상태 변경 시
-- 프론트에서 postgres_changes 구독으로 실시간 반영되도록 함.
-- 마지막 ALTER PUBLICATION 문은 이미 추가된 테이블에 재실행하면 에러가
-- 나므로(IF NOT EXISTS 미지원), 한 번만 실행할 것.
-- ============================================================

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS github_webhook_secret text,
  ADD COLUMN IF NOT EXISTS github_webhook_id     bigint;

ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;
