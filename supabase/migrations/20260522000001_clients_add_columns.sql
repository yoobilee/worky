-- clients 테이블에 누락된 컬럼 추가
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contract_days   integer,
  ADD COLUMN IF NOT EXISTS report_tone     text,
  ADD COLUMN IF NOT EXISTS show_grass_grid boolean DEFAULT false;
