-- clients 테이블에 연락처 마스킹 여부 컬럼 추가
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS mask_phone boolean DEFAULT false;
