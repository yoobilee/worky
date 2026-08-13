import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("github_pat, github_repo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "GitHub 연동 상태 조회 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    connected: Boolean(data?.github_pat),
    repo: data?.github_repo ?? null,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const { pat, repo } = body as { pat?: string; repo?: string };

  if (!pat || !repo) {
    return NextResponse.json({ error: "pat, repo 필드가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, github_pat: pat, github_repo: repo }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
