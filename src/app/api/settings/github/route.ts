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

  const { data: existing, error: existingError } = await supabase
    .from("user_settings")
    .select("github_pat, github_repo, github_webhook_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // 기존 설정 조회 자체가 실패하면 현재 저장소/웹훅 상태를 알 수 없으므로
  // fail-closed: 웹훅 생성/삭제는 물론 PAT/repo 저장도 진행하지 않는다.
  if (existingError) {
    return NextResponse.json({ error: "GitHub 설정 조회 중 오류가 발생했습니다." }, { status: 500 });
  }

  // 이미 저장된 저장소가 있고, 그것과 다른 저장소로 바꾸는 경우에만
  // 이전 웹훅 정보를 명시적으로 초기화한다 (처음 저장하는 경우는 해당 없음)
  const isRepoChange = Boolean(existing?.github_repo) && existing?.github_repo !== repo;
  const reuseExistingWebhook = existing?.github_repo === repo && Boolean(existing?.github_webhook_id);

  const warnings: string[] = [];

  // 저장소가 바뀌는 경우, 새 웹훅을 등록하기 전에 이전 저장소의 웹훅을 정리
  if (isRepoChange && existing?.github_webhook_id && existing.github_repo && existing.github_pat) {
    const deleted = await deleteWebhook(existing.github_pat, existing.github_repo, existing.github_webhook_id);
    if (!deleted) {
      warnings.push("old_webhook_delete_failed");
    }
  }

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
    return NextResponse.json({ success: true, ...(warnings.length ? { warnings } : {}) });
  }

  const registerResult = await registerWebhook({ supabase, userId: user.id, pat, repo, siteOrigin: req.nextUrl.origin });

  if (registerResult.fatalError) {
    return NextResponse.json({ error: registerResult.fatalError }, { status: 500 });
  }
  if (registerResult.warning) {
    warnings.push(registerResult.warning);
  }

  return NextResponse.json({ success: true, ...(warnings.length ? { warnings } : {}) });
}

// 웹훅 삭제. 이미 삭제돼 404가 나는 경우도 성공으로 간주한다.
async function deleteWebhook(pat: string, repo: string, webhookId: number): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/hooks/${webhookId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
      },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function registerWebhook(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  pat: string;
  repo: string;
  siteOrigin: string;
}): Promise<{ warning?: string; fatalError?: string }> {
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
    return { warning: WEBHOOK_FAIL_WARNING };
  }

  if (!hookRes.ok) {
    return { warning: WEBHOOK_FAIL_WARNING };
  }

  const hook = (await hookRes.json()) as { id?: number };

  const { error: secretError } = await supabase
    .from("user_settings")
    .update({ github_webhook_secret: secret, github_webhook_id: hook.id ?? null })
    .eq("user_id", userId);

  if (secretError) {
    // 고아 웹훅 방지: DB 저장에 실패했으므로 방금 만든 웹훅을 보상 삭제한다.
    if (hook.id) {
      await deleteWebhook(pat, repo, hook.id);
    }
    return { fatalError: "웹훅 등록 후 저장에 실패해 방금 등록한 웹훅을 삭제했습니다. 다시 시도해 주세요." };
  }

  return {};
}
