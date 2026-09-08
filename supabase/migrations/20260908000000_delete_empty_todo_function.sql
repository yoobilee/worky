-- ============================================================
-- Worky — 빈 todos 행 전용 삭제 함수
-- 2026-09-08
--
-- delete_empty_todo(target_id): 호출한 auth.uid() 소유이면서 todos 배열이
-- 비어있는(jsonb_array_length = 0) 행만 삭제할 수 있다. authenticated 롤에는
-- todos 테이블 DELETE 권한을 여전히 주지 않고(최소 권한 원칙 유지), 이
-- 함수를 통해서만 삭제가 가능하다. E2E 테스트 정리(teardown)가 남긴 빈
-- 행을 제거하는 용도로 사용된다.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_empty_todo(target_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.todos
  WHERE id = target_id
    AND user_id = auth.uid()
    AND jsonb_array_length(todos) = 0;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_empty_todo(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_empty_todo(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_empty_todo(uuid) TO authenticated;
