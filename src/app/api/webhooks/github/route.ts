import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

interface GithubIssuesWebhookPayload {
  action?: string;
  issue?: { number?: number; updated_at?: string };
  repository?: { full_name?: string };
}

// GitHub이 세션 없이 호출하는 엔드포인트. 인증 대신 X-Hub-Signature-256 서명
// 검증으로 신뢰성을 확보한다. 서명 불일치/대상 없음은 정보 노출 방지를 위해
// 항상 200으로 조용히 무시한다.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const rawBody = await req.text();

  if (!signature) {
    return NextResponse.json({ ok: true });
  }

  let payload: GithubIssuesWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const repoFullName = payload.repository?.full_name;
  const issueNumber = payload.issue?.number;
  const action = payload.action;

  if (!repoFullName || !issueNumber || (action !== "closed" && action !== "reopened")) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  const { data: candidates, error: candidatesError } = await admin
    .from("user_settings")
    .select("user_id, github_webhook_secret")
    .eq("github_repo", repoFullName)
    .not("github_webhook_secret", "is", null);

  // 실제 DB 조회 실패(연결 오류 등)는 GitHub이 재시도하도록 500 반환.
  // 단순히 매칭되는 저장소가 없는 것(candidates가 빈 배열)은 정상 케이스이므로 200.
  if (candidatesError) {
    return NextResponse.json({ error: "user_settings 조회 중 오류가 발생했습니다." }, { status: 500 });
  }

  const receivedBuf = Buffer.from(signature);
  const match = (candidates ?? []).find((c) => {
    if (!c.github_webhook_secret) return false;
    const expected = `sha256=${createHmac("sha256", c.github_webhook_secret).update(rawBody).digest("hex")}`;
    const expectedBuf = Buffer.from(expected);
    return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
  });

  // 서명 불일치 또는 매칭되는 저장소 없음 — 정상적으로 무관한 이벤트일 수 있으므로 조용히 200
  if (!match) {
    return NextResponse.json({ ok: true });
  }

  const { data: existingIssue, error: fetchError } = await admin
    .from("issues")
    .select("id, updated_at")
    .eq("user_id", match.user_id)
    .eq("repo", repoFullName)
    .eq("github_issue_number", issueNumber)
    .maybeSingle();

  // 실제 DB 조회 실패는 GitHub이 재시도하도록 500 반환
  if (fetchError) {
    return NextResponse.json({ error: "이슈 조회 중 오류가 발생했습니다." }, { status: 500 });
  }

  // 매칭되는 이슈 자체가 없음 — 정상적으로 무관한 이벤트일 수 있으므로 조용히 200
  if (!existingIssue) {
    return NextResponse.json({ ok: true });
  }

  const eventUpdatedAt = payload.issue?.updated_at ? new Date(payload.issue.updated_at) : null;

  // 오래된 이벤트가 최신 상태를 덮어쓰지 않도록, 저장된 갱신 시각보다 이전(또는 동일)
  // 이벤트는 무시한다. 이벤트에 updated_at이 없으면 비교할 수 없으므로 그대로 진행.
  if (eventUpdatedAt && !Number.isNaN(eventUpdatedAt.getTime())) {
    const storedUpdatedAt = new Date(existingIssue.updated_at);
    if (eventUpdatedAt.getTime() <= storedUpdatedAt.getTime()) {
      return NextResponse.json({ ok: true });
    }
  }

  const { error: updateError } = await admin
    .from("issues")
    .update({
      status: action === "closed" ? "closed" : "open",
      updated_at: (eventUpdatedAt && !Number.isNaN(eventUpdatedAt.getTime()) ? eventUpdatedAt : new Date()).toISOString(),
    })
    .eq("id", existingIssue.id);

  // 실제 DB 업데이트 실패는 GitHub이 재시도하도록 500 반환
  if (updateError) {
    return NextResponse.json({ error: "이슈 상태 업데이트 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
