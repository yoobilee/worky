-- calendar_events 테이블에 장소 연결 URL 컬럼 추가
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS location_url text;
