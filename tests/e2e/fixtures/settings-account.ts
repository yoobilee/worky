import { createBrowserClient } from "@supabase/ssr";
import { type BrowserContext } from "@playwright/test";
import { type SupabaseClient, type User } from "@supabase/supabase-js";
import WebSocket from "ws";

import type { Database } from "../../../src/types/supabase";

const APP_URL = "http://127.0.0.1:3000";
const GUEST_EMAIL = "guest@worky-demo.com";

// LocaleContext already reads/writes language; the checked-in generated snapshot omits it.
type SettingsDatabase = Database & { public: { Tables: { user_settings: {
  Row: { language: string | null }; Insert: { language?: string | null }; Update: { language?: string | null };
} } } };
type SettingsClient = SupabaseClient<SettingsDatabase>;
type AuthenticatedTestUser = {
  supabase: SettingsClient;
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

export async function authenticateTestUser(
  context: BrowserContext,
): Promise<AuthenticatedTestUser> {
  const environment = requiredEnvironment();
  const supabase = createBrowserClient<SettingsDatabase>(environment.url, environment.anonKey, {
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
