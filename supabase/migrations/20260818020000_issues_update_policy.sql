-- ============================================================
-- Worky — issues 테이블에 누락된 UPDATE RLS 정책 추가
-- 2026-08-18
-- SELECT/INSERT 정책만 있고 UPDATE 정책이 없어, 사용자 세션 기반
-- 클라이언트(anon/authenticated 키)로 issues.update()를 시도하면
-- RLS에 의해 조용히 0 rows affected로 막히는 문제를 해결.
-- (service role 클라이언트를 쓰는 웹훅 수신 경로는 RLS를 우회하므로
-- 이 정책과 무관하게 항상 정상 동작했음)
-- ============================================================

DROP POLICY IF EXISTS "본인 이슈만 수정" ON public.issues;
CREATE POLICY "본인 이슈만 수정" ON public.issues
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
