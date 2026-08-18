import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

interface GithubIssuesWebhookPayload {
  action?: string;
  issue?: { number?: number };
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
  const { data: candidates } = await admin
    .from("user_settings")
    .select("user_id, github_webhook_secret")
    .eq("github_repo", repoFullName)
    .not("github_webhook_secret", "is", null);

  const receivedBuf = Buffer.from(signature);
  const match = (candidates ?? []).find((c) => {
    if (!c.github_webhook_secret) return false;
    const expected = `sha256=${createHmac("sha256", c.github_webhook_secret).update(rawBody).digest("hex")}`;
    const expectedBuf = Buffer.from(expected);
    return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
  });

  if (!match) {
    return NextResponse.json({ ok: true });
  }

  await admin
    .from("issues")
    .update({ status: action === "closed" ? "closed" : "open" })
    .eq("user_id", match.user_id)
    .eq("repo", repoFullName)
    .eq("github_issue_number", issueNumber);

  return NextResponse.json({ ok: true });
}
