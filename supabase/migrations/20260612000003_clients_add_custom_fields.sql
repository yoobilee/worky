-- clients 테이블에 커스텀 속성 컬럼 추가
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]';

-- user_settings 테이블에 커스텀 속성 키 목록 컬럼 추가
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS custom_field_keys jsonb DEFAULT '[]';
