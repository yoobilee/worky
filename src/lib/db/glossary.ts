import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type DbTermRow    = Database["public"]["Tables"]["glossary"]["Row"];
type DbTermInsert = Database["public"]["Tables"]["glossary"]["Insert"];
type DbTermUpdate = Database["public"]["Tables"]["glossary"]["Update"];

export type DbTerm = Pick<DbTermRow, "id" | "term" | "definition" | "category" | "created_at">;

const SELECT_COLS = "id, term, definition, category, created_at";

export async function getGlossary(userId: string): Promise<DbTerm[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("glossary")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as DbTerm[];
}

export async function addTerm(
  userId: string,
  term: Omit<DbTermInsert, "id" | "created_at" | "updated_at" | "user_id">
): Promise<DbTerm | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("glossary")
    .insert({ user_id: userId, ...term })
    .select(SELECT_COLS)
    .single();
  return (data ?? null) as DbTerm | null;
}

export async function updateTerm(id: string, patch: DbTermUpdate): Promise<void> {
  const supabase = createClient();
  await supabase.from("glossary").update(patch).eq("id", id);
}

export async function deleteTerm(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("glossary").delete().eq("id", id);
}
