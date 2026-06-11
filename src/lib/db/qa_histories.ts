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

export async function saveQaHistory(userId: string, title: string, messages: QaMessage[]): Promise<{ id: string | null; error: unknown }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("qa_histories")
    .insert({ user_id: userId, title, messages })
    .select("id")
    .single();

  if (error) {
    console.error("[saveQaHistory] insert error:", error);
    return { id: null, error };
  }
  return { id: data?.id ?? null, error: null };
}

export async function updateQaHistory(historyId: string, title: string, messages: QaMessage[]): Promise<{ error: unknown }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("qa_histories")
    .update({ title, messages })
    .eq("id", historyId);

  if (error) {
    console.error("[updateQaHistory] update error:", error);
  }
  return { error };
}

export async function getQaHistories(userId: string): Promise<QaHistory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("qa_histories")
    .select("id, title, created_at, messages")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[getQaHistories] select error:", error);
    return [];
  }
  return (data ?? []) as QaHistory[];
}
