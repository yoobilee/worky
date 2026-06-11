-- announcements 테이블에 metadata 컬럼 추가 (자동 알림 중복 방지용)
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;
