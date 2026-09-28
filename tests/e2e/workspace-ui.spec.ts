import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ serviceWorkers: "block", timezoneId: "Asia/Seoul" });

const greeting = "오늘은 중요한 업무부터 차분하게 정리하고, 함께 이어갈 다음 단계를 준비해 보세요.";
const optional = ["/content", "/clients", "/members", "/template", "/document", "/translate", "/summary", "/data", "/insight", "/glossary", "/feedback", "/issues"];

// Real guest authentication; all workspace data and writes are isolated in this browser.
// No shared guest records are changed by this suite.
async function workspace(page: Page, empty = false, account?: "full" | "partial" | "none" | "zero") {
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

test("홈 균형 화면 기록", async ({ page }) => {
  const { errors, networkErrors } = await workspace(page, false, "none");
  await expect(page.locator(".wk-account-status, .wk-brief")).toHaveCount(0);
  await expect(page.locator(".wk-topbar h1")).toHaveText("홈");
  const phase = process.env.WORKY_HOME_CAPTURE_PHASE;
  const folder = phase ? `docs/images/home-balance/${phase}` : "test-results/home-balance";
  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (theme === "dark") await page.getByRole("button", { name: "다크 모드", exact: true }).click();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.locator("main").evaluate(el => el.scrollTo(0, 0));
      await page.screenshot({ path: `${folder}/${width}-${theme}.png`, animations: "disabled" });
      await page.locator(".wk-external").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${folder}/${width}-${theme}-footer.png`, animations: "disabled" });
    }
  }
  expect(errors).toEqual([]);
  expect(networkErrors).toEqual([]);
});

for (const account of ["full", "partial", "none", "zero"] as const) {
  test(`홈 계정 상태: ${account}, 크기·테마·키보드`, async ({ page }) => {
    const { errors, networkErrors } = await workspace(page, false, account);
    const status = page.getByRole("group", { name: "업무 현황", exact: true });
    await expect(page.locator(".wk-brief, .wk-brief-toggle")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("오늘의 팁");
    await expect(page.locator("main")).not.toContainText("이메일은 보내기 전");
    if (account === "none") await expect(status).toHaveCount(0);
    else {
      await expect(status).toBeVisible();
      await expect(status.getByRole("button")).toHaveCount(0);
      if (account === "full") await expect(status).toHaveText("이번 주 활동 12회·남은 연차 4일");
      if (account === "partial") {
        await expect(status).toHaveText("이번 주 활동 12회");
        await expect(status.getByRole("link")).toHaveCount(0);
      }
      if (account === "zero") await expect(status).toHaveText("남은 연차 0일");
    }
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      if (theme === "dark") await page.getByRole("button", { name: "다크 모드", exact: true }).click();
      for (const width of [320, 390, 1100, 1440]) {
        await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
        await page.locator(".wk-external").scrollIntoViewIfNeeded();
        expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        if (account !== "none") expect((await status.boundingBox())!.height).toBeLessThanOrEqual(36);
        const a11y = await new AxeBuilder({ page }).include(".wk-home").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(a11y.violations).toEqual([]);
        if (account === "full" && width !== 1100) {
          const folder = process.env.WORKY_HOME_CAPTURE_PHASE === "after" ? "docs/images/home-balance/after" : "test-results/home-balance";
          await page.screenshot({ path: `${folder}/${width}-${theme}-status.png`, animations: "disabled" });
        }
      }
    }
    if (account === "full" || account === "zero") {
      const leave = status.getByRole("link");
      await expect(leave).toHaveAttribute("href", "/settings");
      await leave.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(leave).toBeFocused();
      await expect(leave).toHaveCSS("outline-style", "solid");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/settings$/);
    }
    expect(errors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });
}

test("메뉴 전환: 중단·반복·Escape·동작 감소", async ({ page }) => {
  const { errors, networkErrors } = await workspace(page, false, "full");
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "메뉴 열기" });
  const dialog = page.locator("#worky-navigation");
  const rail = dialog.locator(".wk-rail");
  const close = dialog.getByRole("button", { name: "메뉴 닫기" });
  await trigger.click();
  await expect(dialog).toHaveAttribute("data-state", "open");
  await expect(rail).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  expect(await rail.evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0.2s, 0.14s");
  expect(await rail.evaluate(el => getComputedStyle(el).transitionTimingFunction)).toContain("cubic-bezier(0.32, 0.72, 0, 1)");
  expect(await dialog.locator(".wk-drawer-scrim").evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0.14s");
  // Capture the first closing frame, then reopen before the pending exit can finish.
  const closing = await close.evaluate(async el => {
    (el as HTMLButtonElement).click();
    await new Promise(requestAnimationFrame);
    const drawer = el.closest("dialog")!;
    return { open: drawer.open, hasContent: Boolean(drawer.querySelector("nav")), duration: getComputedStyle(drawer.querySelector("aside")!).transitionDuration };
  });
  expect(closing).toEqual({ open: true, hasContent: true, duration: "0.14s, 0.14s" });
  await trigger.evaluate(el => (el as HTMLButtonElement).click());
  await expect(dialog).toHaveAttribute("data-state", "open");
  for (let i = 0; i < 6; i++) {
    await close.evaluate(el => (el as HTMLButtonElement).click());
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.evaluate(el => (el as HTMLButtonElement).click());
    await expect(dialog).toHaveAttribute("data-state", "open");
  }
  await expect(rail).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator(".wk-drawer-scrim").click({ position: { x: 370, y: 400 } });
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await expect(dialog).toHaveAttribute("data-state", "open");
  await expect(rail).toHaveCSS("transform", "none");
  expect(await rail.evaluate(el => getComputedStyle(el).transitionProperty)).toBe("opacity");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 320, height: 740 });
  await trigger.click();
  await expect(dialog).toHaveAttribute("data-state", "open");
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")))).toBeTruthy();
  await page.setViewportSize({ width: 1100, height: 768 });
  await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
  expect(networkErrors).toEqual([]);
});

test("주요 버튼의 누름 반응과 현재 메뉴 흐름선", async ({ page }) => {
  await workspace(page, false, "full");
  const action = page.locator(".wk-focus .wk-action");
  await action.hover();
  await page.mouse.down();
  await expect(action).toHaveCSS("transform", "matrix(0.98, 0, 0, 0.98, 0, 0)");
  expect(await action.evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0.12s, 0.12s");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await action.hover();
  await page.mouse.down();
  await expect(action).toHaveCSS("transform", "none");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  const active = page.locator('.wk-rail-nav a[aria-current="page"]');
  await expect(active.locator(".wk-flow")).toHaveCSS("opacity", "1");
  await expect(page.locator('.wk-rail-nav a[href="/calendar"] .wk-flow')).toHaveCSS("opacity", "0");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await active.evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0.14s, 0.14s");
  expect(await active.locator(".wk-flow").evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0.14s");
});

test("홈 글자 링크는 밑줄 없이 반응하며 키보드와 동작 감소를 지원한다", async ({ page }) => {
  const { errors, networkErrors } = await workspace(page, false, "full");
  const schedule = page.locator('.wk-work-panel a.wk-text-link[href="/calendar"]');
  const tasks = page.locator('.wk-work-panel a.wk-text-link[href="/todo"]');
  const tools = page.locator(".wk-tools-toggle");
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await page.getByRole("button", { name: "다크 모드", exact: true }).click();
    for (const link of [schedule, tasks, tools]) {
      await link.hover();
      await expect(link).toHaveCSS("text-decoration-line", "none");
      await expect(link).toHaveCSS("color", await page.locator(".wk-home").evaluate(el => getComputedStyle(el).color));
      await expect(link.locator(".wk-link-arrow")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 2, 0)");
      await expect(link).toHaveCSS("transition-property", "color");
      await link.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(link).toBeFocused();
      await expect(link).toHaveCSS("outline-style", "solid");
    }
    await page.keyboard.press("Enter");
    await expect(tools).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator('.wk-customize')).toHaveAttribute("href", "/settings?section=menu");
    await page.locator(".wk-customize").hover();
    await expect(page.locator(".wk-customize")).toHaveCSS("text-decoration-line", "none");
    await tools.click();
  }
  await expect(schedule).toHaveAttribute("href", "/calendar");
  await expect(tasks).toHaveAttribute("href", "/todo");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const link of [schedule, tasks, tools]) {
    await link.hover();
    await expect(link.locator(".wk-link-arrow")).toHaveCSS("transform", "none");
    await expect(link).toHaveCSS("transition-duration", "0.08s");
  }
  expect(errors).toEqual([]);
  expect(networkErrors).toEqual([]);
});

test("긴 인사말과 명시적 줄바꿈은 작은 화면과 영문 모드에서도 보존된다", async ({ page }) => {
  const { settings, errors, networkErrors } = await workspace(page, false, "none");
  const longGreeting = `${greeting}\n${"사용자가입력한긴업무인사말".repeat(8)}`;
  settings.custom_greeting = { enabled: true, mode: "basic", values: { default: longGreeting } };
  for (const locale of ["ko", "en"]) {
    settings.language = locale;
    await page.reload();
    await expect(page.locator(".wk-topbar h1")).toHaveText(locale === "ko" ? "홈" : "Home");
    const heading = page.locator("#worky-greeting");
    await expect(heading).toHaveText(longGreeting);
    expect(await heading.textContent()).toBe(longGreeting);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const metrics = await heading.evaluate(el => {
        const css = getComputedStyle(el);
        return { font: parseFloat(css.fontSize), overflow: el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth, whiteSpace: css.whiteSpace, clamp: css.webkitLineClamp, height: css.maxHeight };
      });
      expect(metrics.font).toBeLessThanOrEqual(width < 640 ? 22 : 28);
      expect(metrics.overflow).toBeFalsy();
      expect(metrics.whiteSpace).toBe("pre-line");
      expect(metrics.clamp).toBe("none");
      expect(metrics.height).toBe("none");
      expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    }
  }
  expect(errors).toEqual([]);
  expect(networkErrors).toEqual([]);
});

test.describe("터치 입력", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("탭 이후 주요 버튼 hover 효과가 남지 않는다", async ({ page }) => {
    const { errors, networkErrors } = await workspace(page, false, "full");
    expect(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBeFalsy();
    const action = page.locator(".wk-focus .wk-action");
    // Isolate the press styling: navigation itself remains covered by the existing suite.
    await action.evaluate(el => el.addEventListener("click", event => event.preventDefault(), { once: true }));
    await action.tap();
    await expect(action).toHaveCSS("filter", "none");
    await expect(action).toHaveCSS("transform", "none");
    const tools = page.locator(".wk-tools-toggle");
    const color = await tools.evaluate(el => getComputedStyle(el).color);
    await tools.tap();
    await expect(tools).toHaveCSS("text-decoration-line", "none");
    await expect(tools).toHaveCSS("color", color);
    await expect(tools.locator(".wk-link-arrow")).toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)");
    await tools.tap();
    await page.getByRole("button", { name: "메뉴 열기" }).tap();
    await expect(page.locator(".wk-drawer")).toHaveAttribute("data-state", "open");
    await page.getByRole("button", { name: "메뉴 닫기" }).tap();
    await expect(page.locator(".wk-drawer")).not.toBeVisible();
    expect(errors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });
});

test("홈과 작업 레일의 개인화, 테마, 반응형, 키보드와 대비", async ({ page }) => {
  const { errors, networkErrors } = await workspace(page);
  await expect(page.locator('.wk-rail-nav a[href="/clients"]')).toHaveCount(0);
  const custom = page.locator(".wk-nav-group").nth(1).locator("a");
  await expect(custom.nth(0)).toHaveAttribute("href", "/data");
  await expect(custom.nth(1)).toHaveAttribute("href", "/summary");
  await page.locator(".wk-tools-toggle").click();
  await expect(page.locator('.wk-tools a').nth(5)).toHaveAttribute("href", "/data");
  await expect(page.locator(".wk-tools-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".wk-tool-drawer")).toHaveAttribute("aria-hidden", "false");
  await page.locator(".wk-tools-toggle").click();
  await expect(page.locator(".wk-tool-drawer")).toHaveAttribute("inert", "");
  await expect(page.locator(".wk-tool-drawer")).toHaveCSS("opacity", "0");
  await page.locator(".wk-tools-toggle").click();
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
        await page.locator(".wk-quick").scrollIntoViewIfNeeded();
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

for (const width of [1440, 390]) {
  test(`홈 메뉴 설정 링크는 ${width}px에서 주소·선택·뒤로 가기를 동기화한다`, async ({ page }) => {
    const { errors, networkErrors } = await workspace(page);
    await page.setViewportSize({ width, height: 844 });
    await page.locator(".wk-tools-toggle").click();
    const customize = page.locator(".wk-customize");
    await expect(customize).toHaveText("메뉴 설정");
    await expect(customize).toHaveAttribute("href", "/settings?section=menu");
    await customize.click();
    await expect(page).toHaveURL(/\/settings\?section=menu$/);
    await expect(page.getByText("사이드바에 표시할 메뉴를 선택하세요")).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/settings\?section=menu$/);
    await expect(page.getByText("사이드바에 표시할 메뉴를 선택하세요")).toBeVisible();
    if (width === 390) await page.getByRole("button", { name: "설정 목록" }).click();
    await page.getByRole("button", { name: "직업군 설정", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\?section=job$/);
    await expect(page.getByText("직업군을 선택하면 추천 메뉴가 자동으로 적용됩니다.")).toBeVisible();
    await page.goBack();
    if (width === 390) {
      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByRole("button", { name: "메뉴 설정", exact: true })).toBeVisible();
      await page.goBack();
    }
    await expect(page).toHaveURL(/\/settings\?section=menu$/);
    await expect(page.getByText("사이드바에 표시할 메뉴를 선택하세요")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);
    if (width === 390) {
      await expect(page.getByRole("button", { name: "내 정보", exact: true })).toBeVisible();
      await expect(page.getByText("이메일·템플릿 작성 시 발신자 서명에 자동으로 사용됩니다.")).toBeHidden();
    } else {
      await expect(page.getByText("이메일·템플릿 작성 시 발신자 서명에 자동으로 사용됩니다.")).toBeVisible();
    }

    await page.goto("/settings?section=unknown");
    await expect(page).toHaveURL(/\/settings$/);
    if (width === 390) await expect(page.getByRole("button", { name: "내 정보", exact: true })).toBeVisible();
    else await expect(page.getByText("이메일·템플릿 작성 시 발신자 서명에 자동으로 사용됩니다.")).toBeVisible();
    expect(errors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });
}

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
  await page.locator(".wk-tools-toggle").click();
  await expect(page.locator('.wk-tools a').nth(5)).toHaveAttribute("href", "/template");
  await expect(page.locator('.wk-tools a[href="/data"]')).toHaveCount(0);
  await page.reload();
  await page.locator(".wk-tools-toggle").click();
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

test("바로가기 추가 대화상자 안의 클릭은 패널을 닫지 않고 포커스를 되돌린다", async ({ page }) => {
  // The URL preview loads Google's favicon for example.com, which 404s on CI runners; pin only that response.
  const favicon = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  let faviconRequests = 0;
  await page.route(url => url.href === "https://www.google.com/s2/favicons?domain=example.com&sz=64", route => {
    faviconRequests++;
    return route.fulfill({ contentType: "image/png", body: favicon });
  });
  const { settings, errors, networkErrors } = await workspace(page, true);
  const toggle = page.getByRole("button", { name: "외부 바로가기", exact: true });
  const panel = page.locator("#worky-external-links");
  const add = panel.getByRole("button", { name: "추가", exact: true });
  const dialog = page.getByRole("dialog", { name: "바로가기 추가" });
  const url = dialog.getByRole("textbox", { name: "바로가기 주소" });
  const name = dialog.getByRole("textbox", { name: "바로가기 이름" });
  await toggle.click();
  // Real pointer clicks dispatch mousedown on document, unlike fill()/Escape.
  for (let i = 0; i < 4; i++) {
    await add.click();
    await expect(dialog).toBeVisible();
    await url.click();
    await name.click();
    await dialog.locator("h3").click();
    await expect(panel).toBeVisible();
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(panel).toBeVisible();
    await expect(add).toBeFocused();
  }
  await add.click();
  await url.click();
  await url.fill("https://example.com");
  await name.click();
  await name.fill("업무 참고");
  await expect.poll(() => faviconRequests).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "추가", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(add).toBeFocused();
  await expect(panel.getByRole("link", { name: "업무 참고", exact: true })).toHaveAttribute("href", "https://example.com");
  await expect.poll(() => JSON.stringify(settings.speed_dial_custom)).toContain("업무 참고");
  await add.click();
  await url.click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(add).toBeFocused();
  // Genuine outside clicks still close the panel.
  await page.locator("#worky-greeting").click();
  await expect(panel).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(errors).toEqual([]);
  expect(networkErrors).toEqual([]);
});
