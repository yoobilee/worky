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

  // 이미 저장된 저장소가 있고, 그것과 다른 저장소로 바꾸는 경우에만
  // 이전 웹훅 정보를 명시적으로 초기화한다 (처음 저장하는 경우는 해당 없음)
  const isRepoChange = Boolean(existing?.github_repo) && existing?.github_repo !== repo;
  const reuseExistingWebhook = existing?.github_repo === repo && Boolean(existing?.github_webhook_id);

  const upsertPayload: {
    user_id: string;
    github_pat: string;
    github_repo: string;
    github_webhook_secret?: null;
    github_webhook_id?: null;
  } = { user_id: user.id, github_pat: pat, github_repo: repo };

  if (isRepoChange) {
    upsertPayload.github_webhook_secret = null;
    upsertPayload.github_webhook_id = null;
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert(upsertPayload, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  // 같은 저장소를 재저장한 경우(설정만 다시 누른 경우)는 기존 웹훅을 재사용
  if (reuseExistingWebhook) {
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
  // 프론트에서 다국어(t()) 처리할 수 있도록 코드값만 반환한다.
  // 매핑: translations.ts의 "webhook_registration_failed" 키
  const WEBHOOK_FAIL_WARNING = "webhook_registration_failed";

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
