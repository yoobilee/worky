import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
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

  const { data: existing } = await supabase
    .from("user_settings")
    .select("github_repo, github_webhook_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, github_pat: pat, github_repo: repo }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  // 이미 같은 저장소에 웹훅이 등록돼 있으면 중복 등록하지 않음
  if (existing?.github_repo === repo && existing?.github_webhook_id) {
    return NextResponse.json({ success: true });
  }

  const warning = await registerWebhook({ supabase, userId: user.id, pat, repo, siteOrigin: req.nextUrl.origin });

  return NextResponse.json({ success: true, ...(warning ? { warning } : {}) });
}

async function registerWebhook(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  pat: string;
  repo: string;
  siteOrigin: string;
}): Promise<string | null> {
  const { supabase, userId, pat, repo, siteOrigin } = params;
  const WEBHOOK_FAIL_WARNING =
    "PAT/저장소는 저장됐지만 웹훅 등록에 실패했습니다. 이슈 상태 자동 동기화는 되지 않을 수 있습니다. GitHub PAT에 저장소 웹훅 권한이 있는지 확인해 주세요.";

  const origin = process.env.NEXT_PUBLIC_SITE_URL || siteOrigin;
  const secret = randomBytes(32).toString("hex");

  let hookRes: Response;
  try {
    hookRes = await fetch(`https://api.github.com/repos/${repo}/hooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["issues"],
        config: {
          url: `${origin}/api/webhooks/github`,
          content_type: "json",
          secret,
        },
      }),
    });
  } catch {
    return WEBHOOK_FAIL_WARNING;
  }

  if (!hookRes.ok) {
    return WEBHOOK_FAIL_WARNING;
  }

  const hook = (await hookRes.json()) as { id?: number };

  const { error: secretError } = await supabase
    .from("user_settings")
    .update({ github_webhook_secret: secret, github_webhook_id: hook.id ?? null })
    .eq("user_id", userId);

  if (secretError) {
    return WEBHOOK_FAIL_WARNING;
  }

  return null;
}
