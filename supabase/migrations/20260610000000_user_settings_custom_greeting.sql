-- user_settings 테이블에 커스텀 인사말 컬럼 추가
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS custom_greeting jsonb DEFAULT NULL;
