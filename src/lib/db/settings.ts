import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type DbSettingsUpdate = Database["public"]["Tables"]["user_settings"]["Update"];

export interface CustomGreeting {
  enabled: boolean;
  mode:    "basic" | "time" | "day";
  values:  Record<string, string>;
}

export interface UserSettings {
  sender_info?:       Record<string, string>;
  menu_settings?:     Record<string, boolean>;
  menu_order?:        string[];
  help_button?:       boolean;
  job_preset?:        string | null;
  theme?:             string;
  sidebar_collapsed?: boolean;
  custom_greeting?:   CustomGreeting | null;
  custom_field_keys?: string[];
  join_date?:         string | null;
  leave_standard?:    string;
  used_leaves?:       number;
  employment_type?:   string;
  granted_leaves?:    number;
}

const SELECT_COLS = "sender_info, menu_settings, menu_order, help_button, job_preset, theme, sidebar_collapsed, custom_greeting, custom_field_keys, join_date, leave_standard, used_leaves, employment_type, granted_leaves";

export async function getSettings(userId: string): Promise<UserSettings | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as UserSettings;
}

export async function upsertSettings(userId: string, patch: Partial<UserSettings>): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, ...patch } as unknown as DbSettingsUpdate,
      { onConflict: "user_id" }
    );
}
