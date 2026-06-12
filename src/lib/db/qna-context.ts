import { createClient } from "@/lib/supabase/client";
import { getClients } from "./clients";
import { getEvents } from "./calendar";
import { getMemos } from "./memos";
import { getGlossary } from "./glossary";

export async function fetchWorkData(userId: string, tables: string[]): Promise<string> {
  const result: Record<string, unknown> = {};

  if (tables.includes("clients")) {
    result.clients = await getClients(userId);
  }

  if (tables.includes("calendar_events")) {
    result.calendar_events = await getEvents(userId);
  }

  if (tables.includes("todos")) {
    const supabase = createClient();
    const { data } = await supabase
      .from("todos")
      .select("date, todos")
      .eq("user_id", userId)
      .order("date");
    result.todos = data ?? [];
  }

  if (tables.includes("memos")) {
    result.memos = await getMemos(userId);
  }

  if (tables.includes("glossary")) {
    result.glossary = await getGlossary(userId);
  }

  return JSON.stringify(result);
}
