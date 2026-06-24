import { createClient } from "@/lib/supabase/client";

export interface DataCleanerHistoryEntry {
  id: string;
  inputText: string;
  resultHtml: string;
  createdAt: string;
}

export async function getDataCleanerHistory(userId: string): Promise<DataCleanerHistoryEntry[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("data_cleaner_history")
    .select("id, input_text, result_html, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(d => ({ id: d.id, inputText: d.input_text, resultHtml: d.result_html, createdAt: d.created_at }));
}

export async function addDataCleanerHistory(userId: string, inputText: string, resultHtml: string): Promise<void> {
  const supabase = createClient();
  try {
    await supabase.from("data_cleaner_history").insert({ user_id: userId, input_text: inputText, result_html: resultHtml });
  } catch (e) { console.error("[데이터 정리 히스토리] 저장 실패:", e); }
}

export async function deleteDataCleanerHistory(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("data_cleaner_history").delete().eq("id", id);
}
