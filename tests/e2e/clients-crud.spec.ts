import { createBrowserClient } from "@supabase/ssr";
import { expect, test, type BrowserContext, type Locator, type Page, type Response } from "@playwright/test";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import WebSocket from "ws";

import type { Database } from "../../src/types/supabase";

const APP_URL = "http://127.0.0.1:3000";
const GUEST_EMAIL = "guest@worky-demo.com";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type ClientsClient = SupabaseClient<Database>;
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type AuthenticatedTestUser = {
  supabase: ClientsClient;
  user: User;
  accessToken: string;
  anonKey: string;
  supabaseUrl: string;
};

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
): Promise<AuthenticatedTestUser> {
  const environment = requiredEnvironment();
  const supabase = createBrowserClient<Database>(environment.url, environment.anonKey, {
    isSingleton: false,
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
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
  if (error || !data.user || !data.session?.access_token) {
    throw error ?? new Error("Supabase signInWithPassword returned no user session.");
  }
  if (data.user.email?.toLowerCase() !== environment.email.toLowerCase()) {
    throw new Error("Authenticated user does not match E2E_TEST_EMAIL.");
  }
  if (data.user.email?.toLowerCase() === GUEST_EMAIL) {
    throw new Error("Authenticated user must not be the public guest account.");
  }

  return {
    supabase,
    user: data.user,
    accessToken: data.session.access_token,
    anonKey: environment.anonKey,
    supabaseUrl: environment.url,
  };
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

async function installWriteGuard(
  page: Page,
  { accessToken, anonKey, supabaseUrl }: AuthenticatedTestUser,
) {
  const supabaseOrigin = new URL(supabaseUrl).origin;

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const pathname = requestUrl.pathname;
    if (pathname.startsWith("/rest/v1/rpc/")) {
      await route.abort("blockedbyclient");
      return;
    }
    if (MUTATING_METHODS.has(request.method()) && (
      requestUrl.origin !== supabaseOrigin ||
      !pathname.endsWith("/rest/v1/clients")
    )) {
      await route.abort("blockedbyclient");
      return;
    }
    if (requestUrl.origin !== supabaseOrigin) {
      await route.continue();
      return;
    }
    const requestHeaders = request.headers();
    const anonAuthorization = `Bearer ${anonKey}`;
    const authorization = requestHeaders.authorization &&
      requestHeaders.authorization !== anonAuthorization
      ? requestHeaders.authorization
      : `Bearer ${accessToken}`;
    await route.continue({
      headers: {
        ...requestHeaders,
        apikey: anonKey,
        authorization,
      },
    });
  });
}

function isClientsResponse(response: Response, method: string) {
  return response.request().method() === method &&
    new URL(response.url()).pathname.endsWith("/rest/v1/clients");
}

function expectSuccessfulResponse(response: Response, stage: string) {
  const method = response.request().method();
  const path = new URL(response.url()).pathname;
  expect(
    response.ok(),
    `${stage} failed: ${method} ${path} returned HTTP ${response.status()}`,
  ).toBeTruthy();
}

async function createdResponseRow(response: Response): Promise<Partial<ClientRow>> {
  expectSuccessfulResponse(response, "Client creation");
  const body = await response.json() as Partial<ClientRow> | Array<Partial<ClientRow>>;
  const row = Array.isArray(body) ? body[0] : body;
  expect(row).toBeTruthy();
  return row;
}

function visibleText(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true });
}

function clientCard(page: Page, name: string): Locator {
  return visibleText(page, name).locator(
    "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' group ')][1]",
  );
}

async function reloadClients(page: Page) {
  const readResponsePromise = page.waitForResponse((response) => isClientsResponse(response, "GET"));
  await page.reload();
  expectSuccessfulResponse(await readResponsePromise, "Clients reload");
}

test("테스트 계정이 거래처를 등록·검색·수정·삭제하고 저장 결과를 확인한다", async ({ context, page }) => {
  const runId = crypto.randomUUID();
  const namePrefix = `E2E-client-${runId}`;
  const createdName = `${namePrefix}-created`;
  const updatedName = `${namePrefix}-updated`;
  let supabase: ClientsClient | null = null;
  let ownerId: string | null = null;
  let clientId: string | null = null;
  let primaryError: unknown;

  try {
    const authenticated = await authenticateTestUser(context);
    supabase = authenticated.supabase;
    ownerId = authenticated.user.id;
    await installExternalRequestMocks(page);
    await installWriteGuard(page, authenticated);
    await page.addInitScript(() => {
      const today = new Date();
      const dateKey = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
      localStorage.setItem("worky_clients_reset_date", dateKey);
      localStorage.setItem("worky_clients_view", "grid");
    });

    const initialReadPromise = page.waitForResponse((response) => isClientsResponse(response, "GET"));
    await page.goto("/clients");
    expectSuccessfulResponse(await initialReadPromise, "Initial clients read");

    await page.getByRole("button", { name: /^(거래처 추가|Add Client)$/ }).click();
    const nameInput = page.getByPlaceholder(/^(\(주\)워키코퍼레이션|Worky Corp\.)$/);
    const addButton = page.getByRole("button", { name: /^(추가|Add)$/ });
    await expect(nameInput).toHaveValue("");
    await expect(addButton).toBeDisabled();

    await nameInput.fill(createdName);
    const createResponsePromise = page.waitForResponse((response) => isClientsResponse(response, "POST"));
    await addButton.click();
    const createResponse = await createResponsePromise;
    const createPayload = createResponse.request().postDataJSON() as Partial<ClientRow>;
    expect(createPayload.user_id).toBe(ownerId);
    expect(createPayload.name).toBe(createdName);
    const createdRow = await createdResponseRow(createResponse);
    clientId = createdRow.id ?? null;
    expect(clientId).toBeTruthy();
    expect(createdRow.name).toBe(createdName);
    await expect(page.getByText(/^(거래처가 추가됐습니다\.|Client added\.)$/)).toBeVisible();

    const { data: storedAfterCreate, error: createReadError } = await supabase
      .from("clients")
      .select("id, user_id, name")
      .eq("id", clientId!)
      .eq("user_id", ownerId)
      .maybeSingle();
    expect(createReadError).toBeNull();
    expect(storedAfterCreate?.user_id).toBe(ownerId);
    expect(storedAfterCreate?.name).toBe(createdName);

    await reloadClients(page);
    await expect(visibleText(page, createdName)).toBeVisible();

    const searchInput = page.getByPlaceholder(/^(전체 검색\.\.\.|Search all\.\.\.)$/);
    await searchInput.fill(createdName);
    await expect(visibleText(page, createdName)).toBeVisible();

    const createdCard = clientCard(page, createdName);
    await createdCard.hover();
    await createdCard.getByRole("button", { name: /^(수정|Edit)$/ }).click();
    await nameInput.fill(updatedName);
    const updateResponsePromise = page.waitForResponse((response) => isClientsResponse(response, "PATCH"));
    await page.getByRole("button", { name: /^(수정 완료|Done)$/ }).click();
    expectSuccessfulResponse(await updateResponsePromise, "Client update");
    await expect(page.getByText(/^(거래처가 수정됐습니다\.|Client updated\.)$/)).toBeVisible();

    const { data: storedAfterUpdate, error: updateReadError } = await supabase
      .from("clients")
      .select("id, user_id, name")
      .eq("id", clientId!)
      .eq("user_id", ownerId)
      .maybeSingle();
    expect(updateReadError).toBeNull();
    expect(storedAfterUpdate?.user_id).toBe(ownerId);
    expect(storedAfterUpdate?.name).toBe(updatedName);

    await reloadClients(page);
    await searchInput.fill(createdName);
    await expect(visibleText(page, createdName)).toHaveCount(0);
    await searchInput.fill(updatedName);
    await expect(visibleText(page, updatedName)).toBeVisible();

    const updatedCard = clientCard(page, updatedName);
    await updatedCard.hover();
    await updatedCard.getByRole("button", { name: /^(삭제|Delete)$/ }).click();
    const deleteResponsePromise = page.waitForResponse((response) => isClientsResponse(response, "DELETE"));
    await page.locator("div.fixed.inset-0").filter({ hasText: updatedName })
      .getByRole("button", { name: /^(삭제|Delete)$/ }).click();
    expectSuccessfulResponse(await deleteResponsePromise, "Client deletion");
    await expect(page.getByText(/^(거래처가 삭제됐습니다\.|Client deleted\.)$/)).toBeVisible();

    await reloadClients(page);
    await searchInput.fill(updatedName);
    await expect(visibleText(page, updatedName)).toHaveCount(0);
    const { data: storedAfterDelete, error: deleteReadError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId!)
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
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("user_id", ownerId)
        .like("name", `${namePrefix}%`)
        .select("id");
      if (error) throw error;

      const { data: remaining, error: verifyError } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", ownerId)
        .like("name", `${namePrefix}%`);
      if (verifyError) throw verifyError;
      if ((remaining ?? []).length > 0) {
        throw new Error("Clients E2E cleanup left test rows behind.");
      }
    } catch (error) {
      cleanupError = error;
    }
  }

  if (primaryError && cleanupError) {
    throw new AggregateError([primaryError, cleanupError], "Clients CRUD failed and cleanup also failed.");
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw new Error("Clients CRUD cleanup failed.", { cause: cleanupError });
});
