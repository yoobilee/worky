import { createClient } from "@/lib/supabase/client";

export interface QaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface QaHistory {
  id: string;
  title: string;
  created_at: string;
  messages: QaMessage[];
}

export async function saveQaHistory(userId: string, title: string, messages: QaMessage[]): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("qa_histories")
    .insert({ user_id: userId, title, messages });
}

export async function getQaHistories(userId: string): Promise<QaHistory[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("qa_histories")
    .select("id, title, created_at, messages")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as QaHistory[];
}
