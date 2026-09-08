import { createBrowserClient } from "@supabase/ssr";
import { expect, test as base, type APIResponse, type BrowserContext, type Page, type Response } from "@playwright/test";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import WebSocket from "ws";

import type { Database } from "../../src/types/supabase";

const APP_URL = "http://127.0.0.1:3000";
const GUEST_EMAIL = "guest@worky-demo.com";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type MemoClient = SupabaseClient<Database>;
type MemoRow = Database["public"]["Tables"]["memos"]["Row"];
type AuthenticatedTestUser = {
  supabase: MemoClient;
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

type MemoFixture = AuthenticatedTestUser & {
  originalExists: boolean;
  originalWorkMemo: string | null;
  originalMeetingMemo: string | null;
  originalPersonalMemo: string | null;
  createdText: string;
  updatedText: string;
};

async function readMemo(fixture: MemoFixture) {
  const { data, error } = await fixture.supabase.from("memos")
    .select("user_id, work_memo, meeting_memo, personal_memo")
    .eq("user_id", fixture.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function restoreOriginalMemo(fixture: MemoFixture) {
  const restoredWorkMemo = fixture.originalExists ? fixture.originalWorkMemo : "";
  const { data, error } = await fixture.supabase.from("memos")
    .upsert(
      { user_id: fixture.user.id, work_memo: restoredWorkMemo },
      { onConflict: "user_id" },
    )
    .select("user_id, work_memo, meeting_memo, personal_memo")
    .single();
  if (error) throw error;

  expect(data.user_id).toBe(fixture.user.id);
  expect(data.work_memo).toBe(restoredWorkMemo);
  expect(data.meeting_memo).toBe(fixture.originalExists ? fixture.originalMeetingMemo : "");
  expect(data.personal_memo).toBe(fixture.originalExists ? fixture.originalPersonalMemo : "");
}

const test = base.extend<{ memo: MemoFixture }>({
  memo: [async ({ context, page }, use) => {
    const authenticated = await authenticateTestUser(context);
    const originalClient = authenticated.supabase;
    const { data: original, error } = await originalClient.from("memos")
      .select("work_memo, meeting_memo, personal_memo")
      .eq("user_id", authenticated.user.id)
      .maybeSingle();
    if (error) throw error;

    const fixture: MemoFixture = {
      ...authenticated,
      // Cleanup must remain authenticated after a failed test closes the browser.
      supabase: createClient<Database>(authenticated.supabaseUrl, authenticated.anonKey, {
        accessToken: async () => authenticated.accessToken,
        realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
      }),
      originalExists: original !== null,
      originalWorkMemo: original?.work_memo ?? null,
      originalMeetingMemo: original?.meeting_memo ?? null,
      originalPersonalMemo: original?.personal_memo ?? null,
      createdText: `E2E work memo created ${crypto.randomUUID()}`,
      updatedText: `E2E work memo updated ${crypto.randomUUID()}`,
    };
    const writes: Promise<APIResponse>[] = [];
    const errors: unknown[] = [];

    try {
      await installExternalRequestMocks(page);
      const supabaseOrigin = new URL(authenticated.supabaseUrl).origin;
      await page.route("**/rest/v1/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const mutating = MUTATING_METHODS.has(request.method());

        if (url.pathname.startsWith("/rest/v1/rpc/") ||
          (mutating && (url.origin !== supabaseOrigin || url.pathname !== "/rest/v1/memos"))) {
          await route.abort("blockedbyclient");
          return;
        }
        if (url.origin !== supabaseOrigin) {
          await route.continue();
          return;
        }

        if (mutating) {
          const payload = request.postDataJSON() as Partial<MemoRow>;
          expect(request.method()).toBe("POST");
          expect(Object.keys(payload).sort()).toEqual(["user_id", "work_memo"]);
          expect(payload.user_id).toBe(authenticated.user.id);
          expect([
            fixture.createdText,
            fixture.updatedText,
            "",
          ]).toContain(payload.work_memo);
        }

        // Reuse the refreshed-token-aware auth header pattern from CRUD E2E.
        const requestHeaders = request.headers();
        const headers = {
          ...requestHeaders,
          apikey: authenticated.anonKey,
          authorization: requestHeaders.authorization &&
            requestHeaders.authorization !== `Bearer ${authenticated.anonKey}`
            ? requestHeaders.authorization
            : `Bearer ${authenticated.accessToken}`,
        };
        if (mutating) {
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
          else if (!result.value.ok()) {
            errors.push(new Error(`Memo write returned HTTP ${result.value.status()}`));
          }
        }
      } catch (error) {
        errors.push(error);
      }
      try {
        await restoreOriginalMemo(fixture);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Memo E2E or original-value restoration failed.");
    }
  }, { timeout: 120_000 }],
});

function isMemoResponse(response: Response, fixture: MemoFixture, method: string, value?: string) {
  const request = response.request();
  const url = new URL(response.url());
  if (url.origin !== new URL(fixture.supabaseUrl).origin ||
    url.pathname !== "/rest/v1/memos" ||
    request.method() !== method) {
    return false;
  }
  if (method === "GET") {
    return url.searchParams.get("user_id") === `eq.${fixture.user.id}`;
  }

  const payload = request.postDataJSON() as Partial<MemoRow>;
  return payload.user_id === fixture.user.id && payload.work_memo === value;
}

async function expectSuccessfulResponse(pending: Promise<Response>, stage: string) {
  const response = await pending;
  expect(response.ok(), `${stage}: HTTP ${response.status()}`).toBeTruthy();
  expect(await response.finished(), `${stage}: response must finish`).toBeNull();
  return response;
}

async function expectStoredWorkMemo(fixture: MemoFixture, expected: string) {
  const row = await readMemo(fixture);
  expect(row?.work_memo).toBe(expected);
  expect(row?.meeting_memo).toBe(fixture.originalExists ? fixture.originalMeetingMemo : "");
  expect(row?.personal_memo).toBe(fixture.originalExists ? fixture.originalPersonalMemo : "");
}

test("테스트 계정이 업무 메모를 저장·수정·초기화하고 새로고침 결과를 확인한다", async ({ page, memo }) => {
  const initialRead = page.waitForResponse((response) => isMemoResponse(response, memo, "GET"));
  await Promise.all([
    page.goto("/todo"),
    expectSuccessfulResponse(initialRead, "Initial memo read"),
  ]);

  const workTab = page.getByRole("button", { name: /^(업무 메모|Work Memo)$/ });
  await expect(workTab).toBeVisible();
  await workTab.click();
  const textarea = page.getByPlaceholder(/^(자유롭게 메모를 입력하세요\.\.\.|Write freely\.\.\.)$/);
  await expect(textarea).toHaveValue(memo.originalWorkMemo ?? "");

  const createResponse = page.waitForResponse(
    (response) => isMemoResponse(response, memo, "POST", memo.createdText),
  );
  await textarea.fill(memo.createdText);
  await expect(page.getByText(/^(저장 중\.\.\.|Saving\.\.\.)$/)).toBeVisible();
  await expectSuccessfulResponse(createResponse, "Initial work memo save");
  await expect(page.getByText(/^(방금 저장됨 ✓|Saved ✓)$/)).toBeVisible();
  await expect(textarea).toHaveValue(memo.createdText);
  await expectStoredWorkMemo(memo, memo.createdText);

  const updateResponse = page.waitForResponse(
    (response) => isMemoResponse(response, memo, "POST", memo.updatedText),
  );
  await textarea.fill(memo.updatedText);
  await expectSuccessfulResponse(updateResponse, "Updated work memo save");
  await expect(page.getByText(/^(방금 저장됨 ✓|Saved ✓)$/)).toBeVisible();
  await expect(textarea).toHaveValue(memo.updatedText);
  await expectStoredWorkMemo(memo, memo.updatedText);

  const reloadRead = page.waitForResponse((response) => isMemoResponse(response, memo, "GET"));
  await Promise.all([
    page.reload(),
    expectSuccessfulResponse(reloadRead, "Reloaded updated memo read"),
  ]);
  await expect(textarea).toHaveValue(memo.updatedText);

  await page.getByRole("button", { name: /^(메모 전체 삭제|Clear all memos)$/ }).click();
  const confirmModal = page.locator("div.fixed.inset-0")
    .filter({ hasText: /^(?=.*(?:메모를 모두 삭제하시겠습니까\?|Delete all memos\?))/ });
  await expect(confirmModal).toBeVisible();
  const clearResponse = page.waitForResponse(
    (response) => isMemoResponse(response, memo, "POST", ""),
  );
  await confirmModal.getByRole("button", { name: "삭제", exact: true }).click();
  await expectSuccessfulResponse(clearResponse, "Work memo clear");
  await expect(confirmModal).toHaveCount(0);
  await expect(textarea).toHaveValue("");
  await expectStoredWorkMemo(memo, "");

  const clearedReloadRead = page.waitForResponse(
    (response) => isMemoResponse(response, memo, "GET"),
  );
  await Promise.all([
    page.reload(),
    expectSuccessfulResponse(clearedReloadRead, "Reloaded cleared memo read"),
  ]);
  await expect(textarea).toHaveValue("");
  await expectStoredWorkMemo(memo, "");
});
