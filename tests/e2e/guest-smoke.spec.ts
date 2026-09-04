import { expect, test } from "@playwright/test";

test("게스트가 대시보드에서 일정 관리 페이지로 이동할 수 있다", async ({ page }) => {
  let mockedGroqRequests = 0;

  await page.route("**/api/groq", async (route) => {
    mockedGroqRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ content: "ok" }),
    });
  });

  await page.route("**/api/weather?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        current_weather: { temperature: 20, weathercode: 0 },
      }),
    });
  });

  await page.route("https://nominatim.openstreetmap.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ address: { city: "Test City" } }),
    });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const method = route.request().method();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await page.goto("/");

  const authRequestPromise = page.waitForRequest((request) =>
    request.method() === "POST" &&
    new URL(request.url()).pathname === "/auth/v1/token"
  );
  const authResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === "/auth/v1/token"
  );
  const dataReadResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "GET" &&
    response.url().includes("/rest/v1/") &&
    response.ok()
  );

  await page.getByRole("button", { name: "게스트로 체험하기" }).click();
  const [authRequest, authResponse] = await Promise.all([
    authRequestPromise,
    authResponsePromise,
  ]);
  const authPayload = authRequest.postDataJSON() as { email?: string };
  expect(authPayload.email).toBe("guest@worky-demo.com");
  expect(authResponse.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await dataReadResponsePromise;
  expect(mockedGroqRequests).toBeGreaterThan(0);

  // 게스트 계정의 language 설정이 en/ko 중 무엇으로 렌더링되든 안정적으로
  // 동작하도록 하드코딩 텍스트 대신 href 기반 selector 사용
  const calendarDataResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "GET" &&
    response.url().includes("/rest/v1/calendar_events")
  );
  await page
    .getByRole("navigation")
    .locator('a[href="/calendar"]')
    .click();
  await expect(page).toHaveURL(/\/calendar$/);
  const calendarDataResponse = await calendarDataResponsePromise;
  expect(calendarDataResponse.ok()).toBeTruthy();
  await expect(
    page.getByRole("button", { name: /^(이전 달|Previous month)$/ })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(다음 달|Next month)$/ })
  ).toBeVisible();
});
