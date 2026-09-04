import { createBrowserClient } from "@supabase/ssr";
import { expect, test, type BrowserContext, type Page, type Response } from "@playwright/test";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "../../src/types/supabase";

const APP_URL = "http://127.0.0.1:3000";
const GUEST_EMAIL = "guest@worky-demo.com";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type CalendarClient = SupabaseClient<Database>;
type CalendarRow = Database["public"]["Tables"]["calendar_events"]["Row"];

function requiredEnvironment() {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "E2E_TEST_EMAIL",
    "E2E_TEST_PASSWORD",
  ] as const;
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const email = process.env.E2E_TEST_EMAIL!;
  if (email.toLowerCase() === GUEST_EMAIL) {
    throw new Error("E2E_TEST_EMAIL must not use the public guest account.");
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    email,
    password: process.env.E2E_TEST_PASSWORD!,
  };
}

async function authenticateTestUser(
  context: BrowserContext,
): Promise<{ supabase: CalendarClient; user: User }> {
  const environment = requiredEnvironment();
  const supabase = createBrowserClient<Database>(environment.url, environment.anonKey, {
    isSingleton: false,
    cookies: {
      getAll: async () => (await context.cookies(APP_URL)).map(({ name, value }) => ({ name, value })),
      setAll: async (cookiesToSet) => {
        const cookies: Parameters<BrowserContext["addCookies"]>[0] = cookiesToSet.map(
          ({ name, value, options }) => {
            const cookie: Parameters<BrowserContext["addCookies"]>[0][number] = {
              name,
              value,
              url: APP_URL,
            };
            if (typeof options?.httpOnly === "boolean") cookie.httpOnly = options.httpOnly;
            if (typeof options?.secure === "boolean") cookie.secure = options.secure;
            if (typeof options?.maxAge === "number") {
              cookie.expires = options.maxAge <= 0
                ? 0
                : Math.floor(Date.now() / 1000) + options.maxAge;
            }
            if (options?.sameSite) {
              cookie.sameSite = options.sameSite === "strict"
                ? "Strict"
                : options.sameSite === "none"
                  ? "None"
                  : "Lax";
            }
            return cookie;
          },
        );
        await context.addCookies(cookies);
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: environment.email,
    password: environment.password,
  });
  if (error || !data.user) throw error ?? new Error("Supabase signInWithPassword returned no user.");
  if (data.user.email?.toLowerCase() !== environment.email.toLowerCase()) {
    throw new Error("Authenticated user does not match E2E_TEST_EMAIL.");
  }
  if (data.user.email?.toLowerCase() === GUEST_EMAIL) {
    throw new Error("Authenticated user must not be the public guest account.");
  }

  return { supabase, user: data.user };
}

async function installExternalRequestMocks(page: Page) {
  await page.route("**/api/groq", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ content: "ok" }),
  }));
  await page.route("**/api/weather?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ current_weather: { temperature: 20, weathercode: 0 } }),
  }));
  await page.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ address: { city: "Test City" } }),
  }));
}

async function installWriteGuard(page: Page) {
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/rest/v1/rpc/")) {
      await route.abort("blockedbyclient");
      return;
    }
    if (MUTATING_METHODS.has(request.method()) && !pathname.endsWith("/rest/v1/calendar_events")) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

function isCalendarResponse(response: Response, method: string) {
  return response.request().method() === method &&
    new URL(response.url()).pathname.endsWith("/rest/v1/calendar_events");
}

async function responseRow(response: Response): Promise<CalendarRow> {
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as CalendarRow | CalendarRow[];
  const row = Array.isArray(body) ? body[0] : body;
  expect(row).toBeTruthy();
  return row;
}

function visibleText(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true });
}

async function selectCalendarDate(page: Page, date: string) {
  await page.locator(`button[data-calendar-date="${date}"]`).click();
}

async function openEventActions(page: Page, title: string) {
  await visibleText(page, title).locator(
    "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' group ')][1]",
  ).hover();
}

test("테스트 계정이 고유 일정을 생성·수정·삭제한다", async ({ context, page }) => {
  const runId = crypto.randomUUID();
  const titlePrefix = `E2E calendar ${runId}`;
  const createdTitle = `${titlePrefix} created`;
  const updatedTitle = `${titlePrefix} updated`;
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const createdDate = `${monthPrefix}-10`;
  const updatedDate = `${monthPrefix}-11`;
  let supabase: CalendarClient | null = null;
  let ownerId: string | null = null;
  let eventId: string | null = null;
  let primaryError: unknown;

  try {
    const authenticated = await authenticateTestUser(context);
    supabase = authenticated.supabase;
    ownerId = authenticated.user.id;
    await installExternalRequestMocks(page);
    await installWriteGuard(page);

    const initialRead = page.waitForResponse((response) => isCalendarResponse(response, "GET"));
    await page.goto("/calendar");
    expect((await initialRead).ok()).toBeTruthy();

    await selectCalendarDate(page, createdDate);
    await page.getByRole("button", { name: /^(일정 추가|Add Event)$/ }).click();
    await page
      .getByPlaceholder(/^(일정 제목을 입력하세요|Enter event title)$/)
      .filter({ visible: true })
      .fill(createdTitle);
    const createResponsePromise = page.waitForResponse((response) => isCalendarResponse(response, "POST"));
    await page.getByRole("button", { name: /^(추가|Add)$/ }).click();
    const createdRow = await responseRow(await createResponsePromise);
    eventId = createdRow.id;
    expect(createdRow.user_id).toBe(ownerId);
    expect(createdRow.title).toBe(createdTitle);
    expect(createdRow.date).toBe(createdDate);

    const { data: storedAfterCreate, error: createReadError } = await supabase
      .from("calendar_events")
      .select("id, user_id, title, date")
      .eq("id", eventId)
      .eq("user_id", ownerId)
      .maybeSingle();
    expect(createReadError).toBeNull();
    expect(storedAfterCreate?.title).toBe(createdTitle);

    await page.reload();
    await selectCalendarDate(page, createdDate);
    await expect(visibleText(page, createdTitle)).toBeVisible();

    await openEventActions(page, createdTitle);
    await page.getByRole("button", { name: new RegExp(`^(수정|Edit): ${createdTitle}$`) }).click();
    await page.locator("input:visible").first().fill(updatedTitle);
    await page.getByRole("button", { name: /^(날짜 선택|Select date)$/ }).click();
    await page.locator(`button[data-picker-date="${updatedDate}"]`).click();
    const updateResponsePromise = page.waitForResponse((response) => isCalendarResponse(response, "PATCH"));
    await page.getByRole("button", { name: /^(저장|Save)$/ }).click();
    const updatedRow = await responseRow(await updateResponsePromise);
    expect(updatedRow.id).toBe(eventId);
    expect(updatedRow.user_id).toBe(ownerId);
    expect(updatedRow.title).toBe(updatedTitle);
    expect(updatedRow.date).toBe(updatedDate);

    await page.reload();
    await selectCalendarDate(page, updatedDate);
    await expect(visibleText(page, updatedTitle)).toBeVisible();

    await openEventActions(page, updatedTitle);
    await page.getByRole("button", { name: new RegExp(`^(삭제|Delete): ${updatedTitle}$`) }).click();
    const deleteResponsePromise = page.waitForResponse((response) => isCalendarResponse(response, "DELETE"));
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    const deletedRow = await responseRow(await deleteResponsePromise);
    expect(deletedRow.id).toBe(eventId);
    expect(deletedRow.user_id).toBe(ownerId);

    await page.reload();
    await selectCalendarDate(page, updatedDate);
    await expect(visibleText(page, updatedTitle)).toHaveCount(0);
    const { data: storedAfterDelete, error: deleteReadError } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("id", eventId)
      .eq("user_id", ownerId)
      .maybeSingle();
    expect(deleteReadError).toBeNull();
    expect(storedAfterDelete).toBeNull();
  } catch (error) {
    primaryError = error;
  }

  let cleanupError: unknown;
  if (supabase && ownerId) {
    try {
      let cleanup = supabase
        .from("calendar_events")
        .delete()
        .eq("user_id", ownerId);
      cleanup = eventId
        ? cleanup.eq("id", eventId)
        : cleanup.like("title", `${titlePrefix}%`);
      const { error } = await cleanup.select("id");
      if (error) throw error;

      const { data: remaining, error: verifyError } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("user_id", ownerId)
        .like("title", `${titlePrefix}%`);
      if (verifyError) throw verifyError;
      if ((remaining ?? []).length > 0) throw new Error("Calendar E2E cleanup left test rows behind.");
    } catch (error) {
      cleanupError = error;
    }
  }

  if (primaryError && cleanupError) {
    throw new AggregateError([primaryError, cleanupError], "Calendar CRUD failed and cleanup also failed.");
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw new Error("Calendar CRUD cleanup failed.", { cause: cleanupError });
});

test("수정 실패와 삭제 0건 응답을 성공처럼 반영하지 않는다", async ({ context, page }) => {
  const { user } = await authenticateTestUser(context);
  await installExternalRequestMocks(page);
  await installWriteGuard(page);

  const runId = crypto.randomUUID();
  const originalTitle = `E2E mocked ${runId}`;
  const attemptedTitle = `${originalTitle} changed`;
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-12`;
  const syntheticRow: CalendarRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    title: originalTitle,
    date,
    time: null,
    location: null,
    location_url: null,
    description: null,
    recurrence_group_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await page.route("**/rest/v1/calendar_events?**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([syntheticRow]) });
      return;
    }
    if (method === "PATCH") {
      await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "forced update failure" }) });
      return;
    }
    if (method === "DELETE") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    await route.continue();
  });

  await page.goto("/calendar");
  await selectCalendarDate(page, date);
  await expect(visibleText(page, originalTitle)).toBeVisible();

  await openEventActions(page, originalTitle);
  await page.getByRole("button", { name: new RegExp(`^(수정|Edit): ${originalTitle}$`) }).click();
  await page.locator("input:visible").first().fill(attemptedTitle);
  await page.getByRole("button", { name: /^(저장|Save)$/ }).click();
  await expect(page.getByText(/^(일정 수정에 실패했습니다\.|Failed to update the event\.)$/)).toBeVisible();
  await expect(page.locator("input:visible").first()).toHaveValue(attemptedTitle);

  await page.getByRole("button", { name: /^(취소|Cancel)$/ }).click();
  await expect(visibleText(page, originalTitle)).toBeVisible();
  await openEventActions(page, originalTitle);
  await page.getByRole("button", { name: new RegExp(`^(삭제|Delete): ${originalTitle}$`) }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText(/^(일정 삭제에 실패했습니다\.|Failed to delete the event\.)$/)).toBeVisible();
  await expect(visibleText(page, originalTitle)).toBeVisible();
});
