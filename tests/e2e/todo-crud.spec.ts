import { createBrowserClient } from "@supabase/ssr";
import { expect, test as base, type APIResponse, type BrowserContext, type Page, type Response } from "@playwright/test";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import WebSocket from "ws";

import type { Database } from "../../src/types/supabase";

const APP_URL = "http://127.0.0.1:3000";
const GUEST_EMAIL = "guest@worky-demo.com";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type TodosClient = SupabaseClient<Database>;
type TodoRow = Database["public"]["Tables"]["todos"]["Row"];
type TodoItem = { id: string; text: string; completed: boolean; createdAt: number };
type AuthenticatedTestUser = {
  supabase: TodosClient;
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
    "SUPABASE_SERVICE_ROLE_KEY",
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
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

type TodoFixture = AuthenticatedTestUser & {
  date: string;
  rowId: string;
  text: string;
  // Cleanup deletes the test-owned row outright, which the `authenticated` role
  // is intentionally not granted (least-privilege migration) since the app never
  // deletes todos rows itself. Use the service role only for this teardown step.
  adminSupabase: TodosClient;
};

async function readRow({ supabase, user, rowId }: TodoFixture) {
  const { data, error } = await supabase.from("todos").select("*")
    .eq("user_id", user.id).eq("id", rowId).maybeSingle();
  if (error) throw error;
  return data;
}

async function cleanupTodo(fixture: TodoFixture) {
  const row = await readRow(fixture);
  if (!row) return;
  // The row's id is a fresh UUID minted only for this test run (never shared with
  // other tests), so teardown must delete it outright instead of leaving an empty
  // row behind — otherwise rows accumulate in the shared remote E2E account and
  // push future runs' "earliest unused date" further into the past each time.
  const { data, error } = await fixture.adminSupabase.from("todos").delete()
    .eq("user_id", fixture.user.id).eq("id", fixture.rowId).select("id");
  if (error) throw error;
  expect(data, "Todo cleanup must affect exactly the test-owned row").toHaveLength(1);
  const afterCleanup = await readRow(fixture);
  expect(afterCleanup).toBeNull();
}

const test = base.extend<{ todo: TodoFixture }>({
  todo: [async ({ context, page }, use) => {
    const authenticated = await authenticateTestUser(context);
    const { supabase, user } = authenticated;
    const { data: earliest, error } = await supabase.from("todos").select("date")
      .eq("user_id", user.id).order("date").limit(1).maybeSingle();
    if (error) throw error;
    // TodoMemo carries unfinished past items into "today" on mount. Set only the
    // browser's Date to an unused earlier day, so existing items are never carried.
    const date = new Date(earliest ? `${earliest.date}T12:00:00Z` : Date.now());
    date.setUTCDate(date.getUTCDate() - 1 - (parseInt(crypto.randomUUID().slice(0, 8), 16) % 3650));
    const dateKey = date.toISOString().slice(0, 10);
    const fixture: TodoFixture = {
      ...authenticated,
      // Teardown must work even if a failed test has already closed the browser.
      supabase: createClient<Database>(authenticated.supabaseUrl, authenticated.anonKey, {
        accessToken: async () => authenticated.accessToken,
        realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
      }),
      // Service role bypasses RLS/grants for the delete-based teardown below; it
      // is never used for the in-test writes, which stay on the authenticated user.
      adminSupabase: createClient<Database>(
        authenticated.supabaseUrl,
        requiredEnvironment().serviceRoleKey,
      ),
      date: dateKey,
      rowId: crypto.randomUUID(),
      text: `E2E todo ${crypto.randomUUID()}`,
    };
    const writes: Promise<APIResponse>[] = [];
    const errors: unknown[] = [];
    try {
      // INSERT (never upsert) reserves this run's date without replacing existing data.
      const { error: insertError } = await supabase.from("todos").insert({
        id: fixture.rowId, user_id: user.id, date: dateKey, todos: [],
      });
      if (insertError) throw insertError;
      await page.clock.setFixedTime(new Date(`${dateKey}T12:00:00`));
      await installExternalRequestMocks(page);
      const supabaseOrigin = new URL(authenticated.supabaseUrl).origin;
      await page.route("**/rest/v1/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const mutating = MUTATING_METHODS.has(request.method());
        if (url.pathname.startsWith("/rest/v1/rpc/") ||
          (mutating && (url.origin !== supabaseOrigin || url.pathname !== "/rest/v1/todos"))) {
          await route.abort("blockedbyclient");
          return;
        }
        if (url.origin !== supabaseOrigin) {
          await route.continue();
          return;
        }
        if (mutating) {
          const payload = request.postDataJSON() as Partial<TodoRow>;
          expect(request.method()).toBe("POST");
          expect(payload.user_id).toBe(user.id);
          expect(payload.date).toBe(dateKey);
          expect(Array.isArray(payload.todos)).toBeTruthy();
          expect((payload.todos as TodoItem[]).every((item) => item.text === fixture.text)).toBeTruthy();
        }
        // Same refreshed-token-aware REST authentication as calendar/clients CRUD.
        const requestHeaders = request.headers();
        const headers = {
          ...requestHeaders,
          apikey: authenticated.anonKey,
          authorization: requestHeaders.authorization &&
            requestHeaders.authorization !== `Bearer ${authenticated.anonKey}`
            ? requestHeaders.authorization : `Bearer ${authenticated.accessToken}`,
        };
        if (mutating) {
          // Track real upstream writes so teardown can drain even a timed-out action.
          const pending = route.fetch({ headers });
          writes.push(pending);
          const response = await pending;
          await route.fulfill({ response });
        } else {
          await route.continue({ headers });
        }
      });
      await use(fixture);
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        await page.close();
        const results = await Promise.allSettled(writes);
        for (const result of results) {
          if (result.status === "rejected") errors.push(result.reason);
          else if (!result.value.ok()) errors.push(new Error(`Todo write returned HTTP ${result.value.status()}`));
        }
      } catch (error) {
        errors.push(error);
      }
      try {
        await cleanupTodo(fixture);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) throw new AggregateError(errors, "Todo E2E setup/write/cleanup failed.");
  }, { timeout: 120_000 }],
});

function isTodoResponse(response: Response, fixture: TodoFixture, method: string, completed?: boolean) {
  const request = response.request();
  const url = new URL(response.url());
  if (url.origin !== new URL(fixture.supabaseUrl).origin ||
    url.pathname !== "/rest/v1/todos" || request.method() !== method) return false;
  if (method === "GET") {
    return url.searchParams.get("user_id") === `eq.${fixture.user.id}` &&
      url.searchParams.get("date") === `eq.${fixture.date}`;
  }
  const payload = request.postDataJSON() as TodoRow;
  return payload.user_id === fixture.user.id && payload.date === fixture.date &&
    (completed === undefined
      ? (payload.todos as TodoItem[]).length === 0
      : (payload.todos as TodoItem[]).some((item) => item.text === fixture.text && item.completed === completed));
}

async function expectSuccessfulResponse(pending: Promise<Response>, stage: string) {
  const response = await pending;
  expect(response.ok(), `${stage}: HTTP ${response.status()}`).toBeTruthy();
  expect(await response.finished(), `${stage}: response must finish`).toBeNull();
  return response;
}

test("테스트 계정이 할 일을 등록·완료하고 새로고침 후에도 완료 상태가 유지된다", async ({ page, todo }) => {
  const initialRead = page.waitForResponse((response) => isTodoResponse(response, todo, "GET"));
  const initialSave = page.waitForResponse((response) => isTodoResponse(response, todo, "POST"));
  await Promise.all([
    page.goto("/todo"),
    expectSuccessfulResponse(initialRead, "Initial todo read"),
    expectSuccessfulResponse(initialSave, "Initial todo hydration save"),
  ]);

  await page.getByPlaceholder(/^(새 할 일 추가\.\.\.|Add a new todo\.\.\.)$/).fill(todo.text);
  const createResponse = page.waitForResponse((response) => isTodoResponse(response, todo, "POST", false));
  await Promise.all([
    page.getByRole("button", { name: /^(추가|Add)$/ }).click(),
    expectSuccessfulResponse(createResponse, "Todo creation"),
  ]);
  const text = page.getByText(todo.text, { exact: true });
  await expect(text).toBeVisible();
  await expect(text).not.toHaveClass(/line-through/);
  const createdRow = await readRow(todo);
  expect(createdRow?.date).toBe(todo.date);
  const created = (createdRow?.todos as TodoItem[]).filter((item) => item.text === todo.text);
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ text: todo.text, completed: false });
  expect(created[0].id).toEqual(expect.any(String));

  // TodoMemo has no checkbox role/aria-label: the first direct button in the
  // exact-text item's .group container toggles completion; the second deletes.
  const item = text.locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' group ')][1]");
  const toggle = item.locator(":scope > button").first();
  await expect(toggle.locator("svg")).toHaveCount(0);
  const completeResponse = page.waitForResponse((response) => isTodoResponse(response, todo, "POST", true));
  await Promise.all([
    toggle.click(),
    expectSuccessfulResponse(completeResponse, "Todo completion"),
  ]);
  await expect(text).toHaveClass(/line-through/);
  await expect(toggle.locator("svg")).toBeVisible();
  const stored = await readRow(todo);
  expect((stored?.todos as TodoItem[]).filter((entry) => entry.id === created[0].id))
    .toEqual([{ ...created[0], completed: true }]);

  const reloadRead = page.waitForResponse((response) => isTodoResponse(response, todo, "GET"));
  const reloadSave = page.waitForResponse((response) => isTodoResponse(response, todo, "POST", true));
  const [, reloaded] = await Promise.all([
    page.reload(),
    expectSuccessfulResponse(reloadRead, "Reloaded todo read"),
    expectSuccessfulResponse(reloadSave, "Reload hydration save"),
  ]);
  // maybeSingle() converts the REST array to an object inside supabase-js.
  const body = await reloaded.json() as Array<Pick<TodoRow, "todos">>;
  expect(body).toHaveLength(1);
  expect((body[0].todos as TodoItem[]).filter((entry) => entry.id === created[0].id))
    .toEqual([{ ...created[0], completed: true }]);
  await expect(text).toBeVisible();
  await expect(text).toHaveClass(/line-through/);
  await expect(toggle.locator("svg")).toBeVisible();
});
