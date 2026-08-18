import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Vercel/Next.js가 이 GET 라우트를 정적으로 캐싱하지 못하도록 명시
export const dynamic = "force-dynamic";

// 웹훅 누락 등에 대비한 안전망: 로드 시점에 GitHub의 실제 이슈 상태를
// 재확인해 DB와 어긋난 것만 보정한다. 한 번에 너무 많은 GitHub API 호출을
// 하지 않도록 최근 이슈 20개로 제한한다.
const MAX_ISSUES_PER_SYNC = 20;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  console.log("[sync] start, user:", user.id);

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("github_pat, github_repo")
    .eq("user_id", user.id)
    .maybeSingle();

  console.log("[sync] settings:", {
    repo: settings?.github_repo,
    patLength: settings?.github_pat?.length ?? 0,
    settingsError,
  });

  if (settingsError) {
    return NextResponse.json({ error: "GitHub 설정 조회 중 오류가 발생했습니다." }, { status: 500 });
  }

  if (!settings?.github_pat || !settings?.github_repo) {
    return NextResponse.json({ updated: 0 });
  }

  const pat = settings.github_pat;
  const repo = settings.github_repo;

  const { data: openIssues, error: issuesError } = await supabase
    .from("issues")
    .select("id, github_issue_number")
    .eq("user_id", user.id)
    .eq("status", "open")
    .not("github_issue_number", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_ISSUES_PER_SYNC);

  console.log("[sync] openIssues count:", openIssues?.length, "numbers:", openIssues?.map((i) => i.github_issue_number));

  if (issuesError) {
    return NextResponse.json({ error: "이슈 목록 조회 중 오류가 발생했습니다." }, { status: 500 });
  }

  if (!openIssues?.length) {
    return NextResponse.json({ updated: 0 });
  }

  const closedOnGithub = await Promise.all(
    openIssues.map(async (issue) => {
      if (!issue.github_issue_number) return null;
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issue.github_issue_number}`, {
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        });
        if (!res.ok) {
          console.log("[sync] github issue", issue.github_issue_number, "status:", res.status, "ok:", res.ok);
          return null;
        }
        const ghIssue = (await res.json()) as { state?: string; updated_at?: string };
        console.log("[sync] github issue", issue.github_issue_number, "status:", res.status, "ok:", res.ok, "state:", ghIssue.state);
        if (ghIssue.state !== "closed") return null;
        return { id: issue.id, updatedAt: ghIssue.updated_at };
      } catch {
        return null;
      }
    })
  );

  console.log("[sync] closed candidates:", closedOnGithub.filter(Boolean).length);

  let updated = 0;
  for (const item of closedOnGithub) {
    if (!item) continue;
    // 대기 중 웹훅이 먼저 처리했을 수 있으므로 아직 open인 경우에만 갱신
    const { error, count } = await supabase
      .from("issues")
      .update(
        { status: "closed", updated_at: item.updatedAt ?? new Date().toISOString() },
        { count: "exact" }
      )
      .eq("id", item.id)
      .eq("status", "open");

    console.log("[sync] db update", item.id, "error:", error, "count:", count);

    if (!error && count) updated += count;
  }

  console.log("[sync] final updated:", updated);

  return NextResponse.json({ updated });
}
