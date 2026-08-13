import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CreateIssueBody {
  title: string;
  expectedBehavior: string;
  actualBehavior: string;
  environment: string;
  frequency: string;
  reproSteps: string[];
  severity: string;
}

function buildIssueBody(body: CreateIssueBody): string {
  const stepsText = body.reproSteps.length
    ? body.reproSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")
    : "";
  return [
    "## 예상 동작",
    body.expectedBehavior,
    "",
    "## 실제 동작",
    body.actualBehavior,
    "",
    "## 재현 방법",
    stepsText,
    "",
    "## 환경",
    body.environment,
    "",
    "## 발생 빈도",
    body.frequency,
    "",
    `심각도: ${body.severity}`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as Partial<CreateIssueBody>;
  const {
    title,
    expectedBehavior = "",
    actualBehavior = "",
    environment = "",
    frequency = "",
    reproSteps = [],
    severity = "",
  } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "title 필드가 필요합니다." }, { status: 400 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("github_pat, github_repo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settingsError || !settings?.github_pat || !settings?.github_repo) {
    return NextResponse.json(
      { error: "GitHub 연동이 필요합니다. 설정에서 GitHub PAT과 저장소를 등록해 주세요." },
      { status: 400 }
    );
  }

  const pat  = settings.github_pat;
  const repo = settings.github_repo;

  const issueBody = buildIssueBody({
    title, expectedBehavior, actualBehavior, environment, frequency, reproSteps, severity,
  });

  let ghRes: Response;
  try {
    ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body: issueBody }),
    });
  } catch {
    return NextResponse.json({ error: "GitHub API 호출 중 오류가 발생했습니다." }, { status: 502 });
  }

  if (!ghRes.ok) {
    if (ghRes.status === 401) {
      return NextResponse.json(
        { error: "GitHub PAT이 유효하지 않습니다. 설정에서 토큰을 다시 확인해 주세요." },
        { status: 400 }
      );
    }
    if (ghRes.status === 404) {
      return NextResponse.json(
        { error: "저장소를 찾을 수 없거나 접근 권한이 없습니다. 저장소 이름과 토큰 권한을 확인해 주세요." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: `GitHub Issue 생성에 실패했습니다. (HTTP ${ghRes.status})` },
      { status: 502 }
    );
  }

  const ghIssue = await ghRes.json();

  const { error: insertError } = await supabase.from("issues").insert({
    user_id: user.id,
    source: "manual",
    title,
    description: issueBody,
    severity,
    repo,
    github_issue_number: ghIssue.number,
    github_issue_url: ghIssue.html_url,
    status: "open",
    expected_behavior: expectedBehavior,
    actual_behavior: actualBehavior,
    environment,
    frequency,
    repro_steps: reproSteps,
  });

  if (insertError) {
    console.error("issues 테이블 기록 실패:", insertError);
  }

  return NextResponse.json({ success: true, issueUrl: ghIssue.html_url, issueNumber: ghIssue.number });
}
