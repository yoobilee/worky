import { expect, test } from "@playwright/test";
import { workspace } from "./fixtures/workspace";

// Headless Chromium normally hides native scrollbars; expose the real hit target.
test.use({ serviceWorkers: "block", launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

for (const theme of ["light", "dark"]) {
  test(`버튼 가장자리 클릭은 다른 스크롤바를 강조하지 않는다: ${theme}`, async ({ page }) => {
    await workspace(page);
    if (theme === "dark") await page.getByRole("button", { name: "다크 모드", exact: true }).click();
    await page.goto("/settings?section=leave");
    const choice = page.getByRole("button", { name: "경력", exact: true });
    await expect(choice).toBeVisible();
    const colors = () => page.locator(".wk-main, .wk-rail-scroll").evaluateAll(elements => elements.map(el => getComputedStyle(el, "::-webkit-scrollbar-thumb").backgroundColor));
    const idle = await colors();
    const box = (await choice.boundingBox())!;
    for (const point of [{ x: box.x + box.width - 2, y: box.y + box.height / 2 }, { x: box.x + box.width / 2, y: box.y + box.height - 2 }]) {
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      expect(await colors()).toEqual(idle);
      await page.mouse.up();
      expect(await colors()).toEqual(idle);
    }
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(-20, -20);
    await page.mouse.up();
    await page.mouse.move(500, 80);
    expect(await colors()).toEqual(idle);
    await expect(page.locator("[data-scrolling]")).toHaveCount(0);
  });
}

test("실제 스크롤바 드래그·해제·창 밖 이동은 해당 영역만 조작한다", async ({ page }) => {
  await workspace(page);
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto("/settings?section=menu");
  await expect(page.getByRole("switch", { name: "데이터 정리", exact: true })).toBeVisible();
  const main = page.locator(".wk-main");
  const rail = page.locator(".wk-rail-scroll");
  const railState = () => rail.evaluate(el => ({ top: el.scrollTop, thumb: getComputedStyle(el, "::-webkit-scrollbar-thumb").backgroundColor }));
  const idleRail = await railState();
  const geometry = await main.evaluate(el => {
    const box = el.getBoundingClientRect();
    const gutter = (el as HTMLElement).offsetWidth - el.clientWidth;
    return { x: box.right - gutter / 2, y: box.top + 20, gutter, overflow: el.scrollHeight > el.clientHeight };
  });
  expect(geometry.overflow).toBe(true);
  expect(geometry.gutter).toBeGreaterThan(0);
  await page.mouse.move(geometry.x, geometry.y);
  await page.mouse.down();
  await page.mouse.move(geometry.x, geometry.y + 100, { steps: 5 });
  await expect.poll(() => main.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await railState()).toEqual(idleRail);
  if (process.env.WORKY_SETTINGS_REFINEMENT_CAPTURE_PHASE === "after") {
    await page.screenshot({ path: "docs/images/settings-refinement/after/scrollbar-drag.png", animations: "disabled" });
  }
  await page.mouse.up();
  expect(await railState()).toEqual(idleRail);
  await main.evaluate(el => { el.scrollTop = 0; });
  await page.mouse.move(geometry.x, geometry.y);
  await page.mouse.down();
  await page.mouse.move(-20, -20);
  await page.mouse.up();
  await page.mouse.move(500, 80);
  expect(await railState()).toEqual(idleRail);
  await expect(page.locator("[data-scrolling]")).toHaveCount(0);
});

test("마지막 설정 행과 저장 영역 사이에는 구분선이 하나만 있다", async ({ page }) => {
  await workspace(page);
  for (const [section, lastRow] of [["leave", ".st-stepper-row"], ["help", ".st-switch-row"], ["notif", ".st-switch-row"], ["job", ".st-preset"], ["menu", ".st-menu-row"]]) {
    await page.goto(`/settings?section=${section}`);
    await expect(page.locator(lastRow).last()).toHaveCSS("border-bottom-width", "0px");
    await expect(page.locator(".st-savebar")).toHaveCSS("border-top-width", "1px");
    expect(await page.locator(".st-fields input, .st-fields button").evaluateAll(controls => controls
      .filter(control => control.getClientRects().length > 0)
      .every(control => control.getBoundingClientRect().height >= 44))).toBe(true);
  }
  await page.goto("/settings?section=greeting");
  await page.getByRole("switch").click();
  await expect(page.locator(".st-switch-row")).toHaveCSS("border-bottom-width", "0px");
});
