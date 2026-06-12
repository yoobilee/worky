-- clients 테이블에 거래처 연락처 및 마스킹 여부 컬럼 추가
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mask_company_phone boolean DEFAULT false;
