-- ============================================================
-- Worky — 이슈 정리 페이지: issues 테이블에 재현 정보 컬럼 추가
-- 2026-08-13
-- 이미 SQL Editor에서 실행 완료된 상태. 이 마이그레이션은 스키마를
-- 코드베이스에 기록하는 목적.
-- ============================================================

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS expected_behavior text,
  ADD COLUMN IF NOT EXISTS actual_behavior   text,
  ADD COLUMN IF NOT EXISTS environment       text,
  ADD COLUMN IF NOT EXISTS frequency         text,
  ADD COLUMN IF NOT EXISTS repro_steps       jsonb DEFAULT '[]'::jsonb;
