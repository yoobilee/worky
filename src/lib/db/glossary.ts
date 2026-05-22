import { createClient } from "@/lib/supabase/client";

export interface DbTerm {
  id:         string;
  term:       string;
  definition: string;
  category:   string;
  created_at: string;
}

export async function getGlossary(userId: string): Promise<DbTerm[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("glossary")
    .select("id, term, definition, category, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as DbTerm[]) ?? [];
}

export async function addTerm(
  userId: string,
  term: Omit<DbTerm, "id" | "created_at">
): Promise<DbTerm | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("glossary")
    .insert({ user_id: userId, ...term })
    .select("id, term, definition, category, created_at")
    .single();
  return data as DbTerm | null;
}

export async function updateTerm(id: string, patch: Partial<Omit<DbTerm, "id" | "created_at">>): Promise<void> {
  const supabase = createClient();
  await supabase.from("glossary").update(patch).eq("id", id);
}

export async function deleteTerm(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("glossary").delete().eq("id", id);
}
