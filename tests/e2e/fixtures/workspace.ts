import { expect, type Page } from "@playwright/test";

export const greeting = "오늘은 중요한 업무부터 차분하게 정리하고, 함께 이어갈 다음 단계를 준비해 보세요.";
const optional = ["/content", "/clients", "/members", "/template", "/document", "/translate", "/summary", "/data", "/insight", "/glossary", "/feedback", "/issues"];

// Real guest authentication; all workspace data and writes are isolated in this browser.
// No shared guest records are changed by this suite.
export async function workspace(page: Page, empty = false, account?: "full" | "partial" | "none" | "zero") {
  const today = "2026-09-27";
  await page.clock.setFixedTime(new Date("2026-09-27T09:00:00+09:00"));
  const settings: Record<string, unknown> = {
    sender_info: { name: "Worky", org: "제품팀", title: "매니저" },
    language: "ko", job_preset: "it", menu_settings: Object.fromEntries(optional.map(route => [route, !["/clients", "/members"].includes(route)])),
    menu_order: ["/data", "/summary", ...optional.filter(route => !["/data", "/summary"].includes(route))],
    custom_greeting: { enabled: true, mode: "basic", values: { default: greeting } },
    speed_dial_custom: [],
    ...(["full", "zero"].includes(account ?? "") ? { employment_type: "career", granted_leaves: 15, used_leaves: account === "zero" ? 15 : 11 } : {}),
  };
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const networkErrors: string[] = [];
  page.on("response", response => { if (response.status() >= 400) networkErrors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  page.on("requestfailed", request => {
    const path = new URL(request.url()).pathname;
    if (/\/(api|rest|auth)\//.test(path) && request.failure()?.errorText !== "net::ERR_ABORTED") networkErrors.push(path);
  });
  await page.route("**/api/groq", route => route.fulfill({ json: { content: "ok" } }));
  await page.route("**/api/settings/github", route => route.fulfill({ json: { connected: false, repo: null } }));
  await page.route("**/api/weather?**", route => route.fulfill({ json: { current_weather: { temperature: 22, weathercode: 0 } } }));
  await page.route("https://nominatim.openstreetmap.org/**", route => route.fulfill({ json: { address: { city: "서울" } } }));
  await page.route("**/rest/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    if (request.method() !== "GET") {
      if (table === "user_settings") Object.assign(settings, request.postDataJSON());
      return route.fulfill({ json: [] });
    }
    const single = request.headers().accept?.includes("vnd.pgrst.object");
    let data: unknown = [];
    if (table === "user_settings") data = settings;
    if (table === "todos") data = { date: today, todos: empty ? [] : [
      { id: "ui-task-1", text: "신규 서비스 제안서 검토 의견 정리하기", completed: false, createdAt: 1 },
      { id: "ui-task-2", text: "다음 주 프로젝트 일정과 담당자 확인하기", completed: false, createdAt: 2 },
      { id: "ui-task-3", text: "팀 주간 회의 기록 공유", completed: true, createdAt: 3 },
    ] };
    if (table === "calendar_events") data = empty ? [] : [
      { id: "ui-event-1", date: today, time: "10:30", title: "제품 개편 방향 검토", location: "회의실 A" },
      { id: "ui-event-2", date: today, time: "14:00", title: "다음 스프린트 업무와 일정 조율", location: "온라인" },
    ];
    if (table === "usage_stats") data = single ? { stats: {} } : [{ stats: { data: 4, clients: 3 } }];
    if (table === "usage_stats" && account) data = { stats: ["none", "zero"].includes(account) ? {} : { data: 8, summary: 4 } };
    if (!single && !Array.isArray(data)) data = [data];
    return route.fulfill({ json: data });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "게스트로 체험하기" }).click();
  await expect(page.locator("#worky-greeting")).toHaveText(greeting, { timeout: 20000 });
  await expect(page.locator("#worky-tasks")).toBeVisible();
  return { settings, errors, networkErrors };
}
