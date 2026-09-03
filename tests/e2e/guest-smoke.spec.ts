import { expect, test } from "@playwright/test";

test("게스트가 대시보드에서 일정 관리 페이지로 이동할 수 있다", async ({ page }) => {
  await page.route("**/rest/v1/**", async (route) => {
    const method = route.request().method();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await page.goto("/");

  await page.getByRole("button", { name: "게스트로 체험하기" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "일정 관리" })
    .click();
  await expect(page.getByRole("heading", { name: "일정 관리" })).toBeVisible();
});
