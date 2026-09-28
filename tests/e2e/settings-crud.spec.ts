import { expect, test } from "@playwright/test";
import { authenticateTestUser } from "./fixtures/settings-account";

test.use({ serviceWorkers: "block" });

test("전용 계정의 설정을 실제 저장·재방문하고 원래 값으로 복원한다", async ({ page, context }) => {
  const { supabase, user } = await authenticateTestUser(context);
  const columns = "sender_info,employment_type,granted_leaves,used_leaves,join_date,leave_standard,custom_greeting,job_preset,menu_settings,menu_order,help_button,language";
  const read = async () => {
    const { data, error } = await supabase.from("user_settings").select(columns).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    return data;
  };
  // Snapshot only non-secret fields. Authenticated clients cannot DELETE this table.
  // Require a provisioned settings row so cleanup can restore it without new rows.
  const original = await read();
  if (!original) throw new Error("Provision a user_settings row for the dedicated E2E account before running this test.");
  const forbidden: string[] = [];
  await page.route("**/rest/v1/**", async route => {
    const request = route.request();
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method())) {
      const table = new URL(request.url()).pathname.split("/").pop();
      const payload = request.postDataJSON();
      if (table !== "user_settings" || !payload || Array.isArray(payload) || payload.user_id !== user.id) {
        forbidden.push(table ?? "unknown"); return route.abort("blockedbyclient");
      }
    }
    return route.continue();
  });
  await page.route("**/api/groq", route => route.fulfill({ json: { content: "ok" } }));
  await page.route("**/api/settings/github", route => route.fulfill({ json: { connected: false, repo: null } }));
  const saved = async () => expect(page.locator(".st-save-state")).toHaveText("저장됐습니다");
  const name = `Worky 설정 검증 ${Date.now()}`;
  try {
    const seed = { language: "ko", granted_leaves: 15, used_leaves: 0 };
    const { error } = await supabase.from("user_settings").update(seed).eq("user_id", user.id);
    if (error) throw error;
    await page.goto("/settings");
    await page.getByLabel("이름", { exact: true }).fill(name);
    await page.getByRole("button", { name: "저장", exact: true }).click(); await saved();
    await page.reload(); await expect(page.getByLabel("이름", { exact: true })).toHaveValue(name);
    await page.goto("/settings?section=leave");
    await page.getByRole("button", { name: "경력", exact: true }).click();
    await page.getByRole("button", { name: "사용한 연차 (일) 늘리기" }).click();
    await page.getByRole("button", { name: "저장", exact: true }).click(); await saved();
    await page.reload(); await expect(page.locator("output").last()).toHaveText("0.5일");
    await page.goto("/settings?section=greeting");
    const greetingSwitch = page.getByRole("switch", { name: "커스텀 인사말 사용" });
    if (await greetingSwitch.getAttribute("aria-checked") === "false") await greetingSwitch.click();
    await page.getByRole("button", { name: "기본", exact: true }).click();
    await page.getByLabel("인사말", { exact: true }).fill(name);
    await page.getByRole("button", { name: "저장", exact: true }).click(); await saved();
    await page.reload(); await expect(page.getByLabel("인사말", { exact: true })).toHaveValue(name);
    await page.goto("/settings?section=job");
    await page.getByRole("button", { name: /기타/ }).click();
    await page.getByRole("button", { name: "확인", exact: true }).click(); await saved();
    await page.reload(); await expect(page.getByRole("button", { name: /기타/ })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/settings?section=menu");
    await page.getByRole("switch", { name: "데이터 정리", exact: true }).click(); await saved();
    await page.locator(".st-menu-row").nth(1).getByRole("button", { name: /위로 이동/ }).click(); await saved();
    const newOrder = await page.locator(".st-menu-row").evaluateAll(rows => rows.map(row => row.getAttribute("data-route")));
    await page.reload(); await expect(page.getByRole("switch", { name: "데이터 정리", exact: true })).toHaveAttribute("aria-checked", "false");
    await page.goto("/settings?section=help");
    const helpSwitch = page.getByRole("switch");
    const helpBefore = await helpSwitch.getAttribute("aria-checked");
    await helpSwitch.click(); await saved();
    await page.reload(); await expect(helpSwitch).toHaveAttribute("aria-checked", helpBefore === "true" ? "false" : "true");
    await page.goto("/settings?section=language");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page.locator(".st-save-state")).toHaveText("Saved");
    await page.reload(); await expect(page.getByRole("button", { name: "English", exact: true })).toHaveAttribute("aria-pressed", "true");
    const persisted = await read();
    if (!persisted) throw new Error("Settings row missing after save");
    expect((persisted.sender_info as { name: string }).name).toBe(name);
    expect(persisted.used_leaves).toBe(.5);
    expect((persisted.custom_greeting as { values: { default: string } }).values.default).toBe(name);
    expect(persisted.job_preset).toBe("other");
    expect(persisted.menu_order).toEqual(newOrder);
    expect(persisted.language).toBe("en");
    expect(forbidden).toEqual([]);
  } finally {
    const { error } = await supabase.from("user_settings").update(original).eq("user_id", user.id);
    if (error) throw error;
    expect(await read()).toEqual(original);
  }
});
