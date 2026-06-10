import { createClient } from "@/lib/supabase/client";

export interface CustomGreeting {
  enabled: boolean;
  mode:    "basic" | "time" | "day";
  values:  Record<string, string>;
}

export interface UserSettings {
  sender_info?:      Record<string, string>;
  menu_settings?:    Record<string, boolean>;
  menu_order?:       string[];
  help_button?:      boolean;
  job_preset?:       string | null;
  theme?:            string;
  sidebar_collapsed?: boolean;
  custom_greeting?:  CustomGreeting | null;
}

export async function getSettings(userId: string): Promise<UserSettings | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("sender_info, menu_settings, menu_order, help_button, job_preset, theme, sidebar_collapsed, custom_greeting")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserSettings;
}

export async function upsertSettings(userId: string, patch: Partial<UserSettings>): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("user_settings")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
}
