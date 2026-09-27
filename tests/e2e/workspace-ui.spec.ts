import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ serviceWorkers: "block", timezoneId: "Asia/Seoul" });

const greeting = "오늘은 중요한 업무부터 차분하게 정리하고, 함께 이어갈 다음 단계를 준비해 보세요.";
const optional = ["/content", "/clients", "/members", "/template", "/document", "/translate", "/summary", "/data", "/insight", "/glossary", "/feedback", "/issues"];

// Real guest authentication; all workspace data and writes are isolated in this browser.
// No shared guest records are changed by this suite.
async function workspace(page: Page, empty = false) {
  const today = "2026-09-27";
  await page.clock.setFixedTime(new Date("2026-09-27T09:00:00+09:00"));
  const settings: Record<string, unknown> = {
    sender_info: { name: "Worky", org: "제품팀", title: "매니저" },
    language: "ko", job_preset: "it", menu_settings: Object.fromEntries(optional.map(route => [route, !["/clients", "/members"].includes(route)])),
    menu_order: ["/data", "/summary", ...optional.filter(route => !["/data", "/summary"].includes(route))],
    custom_greeting: { enabled: true, mode: "basic", values: { default: greeting } },
    speed_dial_custom: [],
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
    if (!single && !Array.isArray(data)) data = [data];
    return route.fulfill({ json: data });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "게스트로 체험하기" }).click();
  await expect(page.locator("#worky-greeting")).toHaveText(greeting, { timeout: 20000 });
  await expect(page.locator("#worky-tasks")).toBeVisible();
  return { settings, errors, networkErrors };
}

test("홈과 작업 레일의 개인화, 테마, 반응형, 키보드와 대비", async ({ page }) => {
  const { errors, networkErrors } = await workspace(page);
  await expect(page.locator('.wk-rail-nav a[href="/clients"]')).toHaveCount(0);
  const custom = page.locator(".wk-nav-group").nth(1).locator("a");
  await expect(custom.nth(0)).toHaveAttribute("href", "/data");
  await expect(custom.nth(1)).toHaveAttribute("href", "/summary");
  await expect(page.locator('.wk-tools a').nth(5)).toHaveAttribute("href", "/data");
  await expect(page.locator("#worky-focus")).toHaveText("신규 서비스 제안서 검토 의견 정리하기");

  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark") await page.getByRole("button", { name: "다크 모드", exact: true }).click();
    for (const [name, width, height] of [["desktop", 1440, 1000], ["laptop", 1100, 768], ["mobile", 390, 844], ["small-mobile", 320, 740]] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.locator("#worky-greeting")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      expect(await page.locator("main").evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
      await page.screenshot({ path: `test-results/ui/${name}-${theme}.png`, fullPage: true });
      if (name === "mobile") {
        await page.locator(".wk-tools").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/ui/mobile-tools-${theme}.png` });
        await page.locator("main").evaluate(element => element.scrollTo(0, 0));
      }
      const a11y = await new AxeBuilder({ page }).include(".wk-shell").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(a11y.violations).toEqual([]);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "메뉴 열기" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "로그아웃" })).toBeVisible();
  await page.screenshot({ path: "test-results/ui/mobile-navigation-dark.png" });
  const drawerA11y = await new AxeBuilder({ page }).include("#worky-navigation").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(drawerA11y.violations).toEqual([]);
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")))).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await trigger.evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("#worky-greeting")).toHaveText(greeting);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  expect(await page.locator("main").evaluate(element => getComputedStyle(element).outlineStyle)).toBe("solid");
  expect(errors).toEqual([]);
  expect(networkErrors).toEqual([]);
});

test("설정의 인사말·프리셋·메뉴 변경을 홈에서 보존한다", async ({ page }) => {
  const { settings } = await workspace(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "커스텀 인사말", exact: true }).click();
  const input = page.getByPlaceholder("오늘도 좋은 하루 보내세요!");
  await input.fill("설정에서 저장한 나의 업무 인사말");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => JSON.stringify(settings.custom_greeting)).toContain("설정에서 저장한 나의 업무 인사말");
  await page.getByRole("button", { name: "직업군 설정", exact: true }).click();
  await page.getByRole("button", { name: /디자이너/ }).click();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect.poll(() => settings.job_preset).toBe("designer");
  await page.locator('.wk-rail-nav a[href="/"]').click();
  await expect(page.locator("#worky-greeting")).toHaveText("설정에서 저장한 나의 업무 인사말");
  await expect(page.locator('.wk-rail-nav a[href="/data"]')).toHaveCount(0);
  await expect(page.locator('.wk-tools a[href="/data"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#worky-greeting")).toHaveText("설정에서 저장한 나의 업무 인사말");
  await expect(page.locator('.wk-rail-nav a[href="/data"]')).toHaveCount(0);
  await page.getByRole("button", { name: "사이드바 접기" }).click();
  await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toBeVisible();
  await page.getByRole("button", { name: "사이드바 펼치기" }).click();
  await page.locator('.wk-rail-nav a[href="/summary"]').click();
  await expect(page).toHaveURL(/\/summary$/, { timeout: 20000 });
  await expect(page.locator(".wk-topbar")).toContainText("AI 지원");
  await expect(page.locator(".wk-topbar")).not.toContainText("처리 중");
  await page.locator('.wk-rail-nav a[href="/"]').click();
  await expect(page.locator('.wk-recent a[href="/summary"]')).toBeVisible();
});

test("메뉴 표시와 드래그 순서 변경이 같은 화면과 새로고침에 반영된다", async ({ page }) => {
  const { settings } = await workspace(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "메뉴 설정", exact: true }).click();
  const dataRow = page.locator('main [draggable="true"]').filter({ hasText: "/data" });
  await dataRow.getByRole("switch").click();
  await expect.poll(() => (settings.menu_settings as Record<string, boolean>)["/data"]).toBe(false);
  await expect(page.locator('.wk-rail-nav a[href="/data"]')).toHaveCount(0);
  const template = page.locator('main [draggable="true"]').filter({ hasText: "/template" });
  const summary = page.locator('main [draggable="true"]').filter({ hasText: "/summary" });
  await template.dragTo(summary);
  await expect.poll(() => (settings.menu_order as string[])[1]).toBe("/template");
  await page.locator('.wk-rail-nav a[href="/"]').click();
  await expect(page.locator('.wk-tools a').nth(5)).toHaveAttribute("href", "/template");
  await expect(page.locator('.wk-tools a[href="/data"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.wk-tools a').nth(5)).toHaveAttribute("href", "/template");
});

test("시간·요일 인사말과 비활성 상태의 호환성", async ({ page }) => {
  const { settings } = await workspace(page);
  for (const mode of ["time", "day"] as const) {
    const keys = mode === "time" ? ["오전", "오후", "저녁", "심야"] : ["0", "1", "2", "3", "4", "5", "6"];
    settings.custom_greeting = { enabled: true, mode, values: Object.fromEntries(keys.map(key => [key, `${mode}-${key} 인사말`])) };
    await page.reload();
    await expect(page.locator("#worky-greeting")).toHaveText(mode === "time" ? "time-오전 인사말" : "day-0 인사말", { timeout: 15000 });
  }
  settings.custom_greeting = { enabled: false, mode: "basic", values: { default: "숨겨진 인사말" } };
  await page.reload();
  await expect(page.locator("#worky-tasks")).toBeVisible();
  await expect(page.locator("#worky-greeting")).not.toHaveText("숨겨진 인사말");
});

test("빈 업무는 간결하고 실행 가능한 상태를 보여준다", async ({ page }) => {
  await workspace(page, true);
  await expect(page.locator("#worky-focus")).toHaveText("오늘의 첫 업무를 정리해 보세요");
  await expect(page.getByText("아직 등록한 할 일이 없어요.", { exact: true })).toBeVisible();
  await expect(page.locator(".wk-recent")).toHaveCount(0);
  await page.getByRole("button", { name: "외부 바로가기", exact: true }).click();
  await expect(page.getByRole("link", { name: "ChatGPT", exact: true })).toHaveAttribute("href", "https://chatgpt.com");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", { name: "바로가기 이름" }).fill("업무 참고");
  await page.getByRole("textbox", { name: "바로가기 주소" }).fill("https://example.com");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "추가", exact: true })).toBeFocused();
});
