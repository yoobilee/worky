import { createClient } from "@supabase/supabase-js";

// service role 키를 사용하는 서버 전용 클라이언트. RLS를 우회하므로
// 로그인 세션이 없는 서버 간 통신(GitHub 웹훅 수신 등)에서만 사용할 것.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
