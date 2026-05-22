import { createClient } from "@/lib/supabase/client";

export interface MemoData {
  work_memo?:     string;
  meeting_memo?:  string;
  personal_memo?: string;
}

export async function getMemos(userId: string): Promise<MemoData> {
  const supabase = createClient();
  const { data } = await supabase
    .from("memos")
    .select("work_memo, meeting_memo, personal_memo")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as MemoData) ?? {};
}

export async function upsertMemos(userId: string, patch: MemoData): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("memos")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
}
