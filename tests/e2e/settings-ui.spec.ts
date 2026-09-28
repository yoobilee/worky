import { expect, test } from "@playwright/test";
import { workspace } from "./fixtures/workspace";
import AxeBuilder from "@axe-core/playwright";

test.use({ serviceWorkers: "block", timezoneId: "Asia/Seoul" });

const sections = ["info", "leave", "greeting", "job", "menu", "help", "language", "github", "notif"];

test("저장 대기·실패는 완료로 표시하지 않고 입력과 재시도를 보존한다", async ({ page }) => {
  const { settings } = await workspace(page);
  await page.goto("/settings?section=info");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  await page.route("**/rest/v1/user_settings?**", async route => {
    if (route.request().method() === "GET") return route.fallback();
    writes++;
    if (writes === 1) { await gate; return route.fulfill({ status: 500, json: { message: "Simulated settings failure" } }); }
    return route.fallback();
  });
  await page.getByLabel("이름", { exact: true }).fill("다시 저장할 이름");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장 중");
  await expect(page.getByLabel("이름", { exact: true })).toBeDisabled();
  // React sets the pending UI state before the Supabase request reaches the route.
  await expect.poll(() => writes).toBe(1);
  release();
  await expect(page.locator(".st-save-state")).toHaveAttribute("role", "alert");
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue("다시 저장할 이름");
  expect((settings.sender_info as { name: string }).name).toBe("Worky");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  await page.reload(); await expect(page.getByLabel("이름", { exact: true })).toHaveValue("다시 저장할 이름");
});

test("GitHub 연결은 비밀 값 재표시 없이 저장·실패·경고를 구분한다", async ({ page }) => {
  const { errors, networkErrors } = await workspace(page);
  let connected = false;
  let fail = true;
  let warned = false;
  let savedRepo: string | null = null;
  await page.route("**/api/settings/github", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { connected, repo: savedRepo } });
    const payload = route.request().postDataJSON();
    expect(Object.keys(payload).sort()).toEqual(["pat", "repo"]);
    expect(payload.pat).toBe("fake-test-token");
    if (fail) return route.fulfill({ status: 400, json: { error: "simulated failure" } });
    connected = true; savedRepo = payload.repo;
    return route.fulfill({ json: { warnings: warned ? ["webhook_registration_failed"] : [] } });
  });
  await page.goto("/settings?section=github");
  const token = page.getByLabel("GitHub Personal Access Token");
  await token.fill("fake-test-token"); await page.getByLabel("저장소 (owner/repo)").fill("worky-test/ui");
  await expect(token).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveAttribute("role", "alert");
  await expect(token).toHaveValue("fake-test-token");
  fail = false;
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  await expect(token).toHaveValue("");
  await page.reload();
  await expect(page.locator(".st-connection")).toHaveText("worky-test/ui에 연결됨");
  await expect(token).toHaveValue("");
  warned = true;
  await token.fill("fake-test-token"); await page.getByLabel("저장소 (owner/repo)").fill("worky-test/next");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".st-warning")).toContainText("웹훅 등록에 실패했습니다");
  await expect(token).toHaveValue("");
  expect(errors.filter(error => !error.includes("400"))).toEqual([]);
  expect(networkErrors).toEqual(["400 /api/settings/github"]);
});

test("자동 저장 실패는 메뉴·언어 선택을 복원하고 재시도로 저장한다", async ({ page }) => {
  await workspace(page);
  let fail = true;
  await page.route("**/rest/v1/user_settings?**", route => {
    if (route.request().method() !== "GET" && fail) return route.fulfill({ status: 500, json: { message: "Simulated settings failure" } });
    return route.fallback();
  });
  await page.goto("/settings?section=menu");
  const menu = page.getByRole("switch", { name: "데이터 정리", exact: true });
  await expect(menu).toHaveAttribute("aria-checked", "true");
  await menu.click();
  await expect(page.locator(".st-save-state")).toHaveAttribute("role", "alert");
  await expect(menu).toHaveAttribute("aria-checked", "true");
  fail = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  await page.reload(); await expect(menu).toHaveAttribute("aria-checked", "false");
  await page.goto("/settings?section=language");
  fail = true;
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveAttribute("role", "alert");
  await expect(page.getByRole("button", { name: "한국어", exact: true })).toHaveAttribute("aria-pressed", "true");
  fail = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByRole("button", { name: "English", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("브라우저 알림 권한 상태와 로컬 선택은 재방문 후 유지된다", async ({ page }) => {
  // The Windows headless browser reports denied even with grantPermissions.
  // Model the permission API explicitly; this does not claim OS delivery coverage.
  await page.addInitScript(() => {
    class TestNotification {
      static get permission() { return sessionStorage.getItem("test-notification-permission") ?? "default"; }
      static async requestPermission() { sessionStorage.setItem("test-notification-permission", "granted"); return "granted"; }
    }
    Object.defineProperty(window, "Notification", { configurable: true, value: TestNotification });
  });
  const { errors, networkErrors } = await workspace(page);
  await page.goto("/settings?section=notif");
  await expect(page.getByRole("switch", { name: "일정 알림", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "알림 허용" }).click();
  await expect(page.locator(".st-connection")).toHaveText("알림이 허용됐습니다");
  await page.getByRole("switch", { name: "일정 알림", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("이 브라우저에 저장됐습니다");
  await page.reload();
  await expect(page.getByRole("switch", { name: "일정 알림", exact: true })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: "거래처 D-day 알림" })).toHaveAttribute("aria-checked", "true");
  await page.evaluate(() => sessionStorage.setItem("test-notification-permission", "default"));
  await page.reload();
  await expect(page.getByRole("button", { name: "알림 허용" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "일정 알림", exact: true })).toBeDisabled();
  // Denial is a deterministic browser API substitute, not an OS permission test.
  await page.evaluate(() => sessionStorage.setItem("test-notification-permission", "denied"));
  await page.reload();
  await expect(page.locator(".st-connection")).toHaveText("브라우저 설정에서 직접 허용해 주세요");
  await expect(page.getByRole("button", { name: "알림 허용" })).toHaveCount(0);
  expect(errors).toEqual([]); expect(networkErrors).toEqual([]);
});

test("모바일 목록 복귀와 키보드 초점·움직임 감소", async ({ page }) => {
  await workspace(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/settings");
  const menu = page.getByRole("button", { name: "메뉴 설정", exact: true });
  await menu.focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#st-section-title")).toBeFocused();
  await expect(page.locator("#st-section-title")).toHaveCSS("outline-style", "solid");
  await page.getByRole("button", { name: "설정 목록" }).click();
  await expect(menu).toBeFocused();
  await page.goBack(); await expect(page.locator("#st-section-title")).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('.st-switch[aria-checked="true"]').first().locator("span")).toHaveCSS("transform", "none");
  expect(await page.locator(".st-settings").evaluate(root => [...root.querySelectorAll("*")].every(el => getComputedStyle(el).animationName === "none"))).toBe(true);
});

test.describe("설정 전후 화면 기록", () => {
  const phase = process.env.WORKY_SETTINGS_CAPTURE_PHASE;
  const folder = phase ? `docs/images/settings-phase2/${phase}` : "test-results/settings-phase2";

  for (const theme of ["light", "dark"] as const) {
    for (const { name, widths } of [{ name: "desktop", widths: [1440, 1100] }, { name: "mobile", widths: [390, 320] }]) {
      test(`${theme} ${name} 내 정보·메뉴·모바일 목록`, async ({ page }) => {
        await workspace(page);
        await page.setViewportSize({ width: 1440, height: 1000 });
        if (theme === "dark") await page.getByRole("button", { name: "다크 모드", exact: true }).click();
        for (const width of widths) {
          await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
          for (const section of ["info", "menu"]) {
            await page.goto(`/settings?section=${section}`);
            await expect(page.getByText(section === "info" ? "이메일·템플릿 작성 시 발신자 서명에 자동으로 사용됩니다." : "사이드바에 표시할 메뉴를 선택하세요")).toBeVisible({ timeout: 15_000 });
            await page.screenshot({ path: `${folder}/${width}-${theme}-${section}.png`, animations: "disabled" });
          }
          if (width < 640) {
            await page.goto("/settings");
            await expect(page.getByRole("button", { name: "내 정보", exact: true })).toBeVisible({ timeout: 15_000 });
            await page.screenshot({ path: `${folder}/${width}-${theme}-list.png`, animations: "disabled" });
          }
        }
      });
    }
  }

  for (const [name, batch] of [["personal and workspace", sections.slice(0, 5)], ["connections", sections.slice(5)] ] as const) {
    test(`데스크톱 ${name} 상세`, async ({ page }) => {
      await workspace(page);
      await page.setViewportSize({ width: 1440, height: 1000 });
      for (const section of batch) {
        await page.goto(`/settings?section=${section}`);
        await expect(page.getByRole("button", { name: "내 정보", exact: true })).toBeVisible({ timeout: 15_000 });
        await page.screenshot({ path: `${folder}/section-${section}.png`, animations: "disabled" });
      }
    });
  }
});

for (const width of [1440, 1100, 390, 320]) {
  for (const theme of ["light", "dark"]) {
    test(`설정 9개 항목: ${width}px ${theme}, 대비·넘침·주소`, async ({ page }) => {
      const { errors, networkErrors } = await workspace(page);
      if (theme === "dark") await page.getByRole("button", { name: "다크 모드", exact: true }).click();
      await page.setViewportSize({ width, height: 1000 });
      for (const section of sections) {
        await page.goto(`/settings?section=${section}`);
        await expect(page.locator(".st-section-heading h2")).toBeVisible();
        await expect(page.locator(`.st-nav [data-section="${section}"]`)).toHaveAttribute("aria-current", "page");
        expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const result = await new AxeBuilder({ page }).include(".st-settings").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(result.violations).toEqual([]);
      }
      expect(errors).toEqual([]);
      expect(networkErrors).toEqual([]);
    });
  }
}

test("내 정보·연차·인사말 모드는 수정, 저장, 재방문 후 유지된다", async ({ page }) => {
  const { settings, errors, networkErrors } = await workspace(page);
  await page.goto("/settings");
  await page.getByLabel("소속", { exact: true }).fill("워크플로우 팀");
  await page.getByLabel("이름", { exact: true }).fill("김워크");
  await page.getByLabel("직급", { exact: true }).fill("매니저");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  await page.reload();
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue("김워크");
  await expect(page.locator(".st-preview")).toContainText("워크플로우 팀 김워크 매니저");

  await page.goto("/settings?section=leave");
  await page.getByRole("button", { name: "경력", exact: true }).click();
  await page.getByRole("button", { name: "부여 연차 (일) 늘리기" }).click();
  await page.getByRole("button", { name: "사용한 연차 (일) 늘리기" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  expect(settings.granted_leaves).toBe(15.5);
  expect(settings.used_leaves).toBe(.5);
  await page.reload();
  await expect(page.getByRole("button", { name: "경력", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("output").first()).toHaveText("15.5일");
  await page.getByRole("button", { name: "신입", exact: true }).click();
  await page.getByLabel("입사일", { exact: true }).fill("2026-09-15");
  await page.getByRole("button", { name: "입사일 기준", exact: true }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  await page.reload();
  await expect(page.getByLabel("입사일", { exact: true })).toHaveValue("2026-09-15");
  await expect(page.getByRole("button", { name: "입사일 기준", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/settings?section=greeting");
  for (const [mode, label, value] of [["기본", "인사말", "차분하게 시작해요"], ["시간대별", "오전", "좋은 아침입니다"], ["요일별", "일요일", "다음 주를 준비해요"]]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
    await page.reload();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  await page.getByRole("switch", { name: "커스텀 인사말 사용" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  await page.reload();
  await expect(page.getByRole("switch", { name: "커스텀 인사말 사용" })).toHaveAttribute("aria-checked", "false");
  expect(errors).toEqual([]); expect(networkErrors).toEqual([]);
});

test("프리셋 확인·취소, 메뉴 키보드 정렬, 도움말과 언어 재방문", async ({ page }) => {
  const { settings, errors, networkErrors } = await workspace(page);
  await page.goto("/settings?section=job");
  const designer = page.getByRole("button", { name: /디자이너/ });
  await designer.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(designer).toBeFocused();
  expect(settings.job_preset).toBe("it");
  await designer.click(); await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  await page.reload(); await expect(designer).toHaveAttribute("aria-pressed", "true");
  await page.goto("/settings?section=menu");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("switch", { name: "데이터 정리", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  const move = page.getByRole("button", { name: "문서 요약 위로 이동", exact: true });
  await move.focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  await page.reload();
  await expect(page.locator(".st-menu-row").first()).toContainText("문서 요약");
  await expect(page.getByRole("switch", { name: "데이터 정리", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.goto("/settings?section=help");
  await page.getByRole("switch").click(); await expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  await page.reload(); await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await page.goto("/settings?section=language");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator(".st-save-state")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByRole("button", { name: "English", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const section of sections) {
    await page.goto(`/settings?section=${section}`);
    await expect(page.locator(".st-section-heading h2")).toBeVisible();
    expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  expect(settings.language).toBe("en"); expect(errors).toEqual([]); expect(networkErrors).toEqual([]);
});
