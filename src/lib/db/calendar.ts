import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type DbEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type DbEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type DbEventUpdate = Database["public"]["Tables"]["calendar_events"]["Update"];

export type DbEvent = Pick<DbEventRow,
  "id" | "date" | "title" | "time" | "location" | "location_url" | "description"
> & { recurrence_group_id?: string | null };

const SELECT_COLS = "id, date, title, time, location, location_url, description, recurrence_group_id";

export async function getEvents(userId: string): Promise<DbEvent[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("date")
    .limit(500);
  return (data ?? []) as DbEvent[];
}

export async function getEventsInRange(
  userId: string, startDate: string, endDate: string
): Promise<DbEvent[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");
  return (data ?? []) as DbEvent[];
}

export async function addEvent(
  userId: string,
  event: Omit<DbEventInsert, "id" | "created_at" | "updated_at" | "user_id"> & { recurrence_group_id?: string | null }
): Promise<DbEvent | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("calendar_events")
    .insert({ user_id: userId, ...event })
    .select(SELECT_COLS)
    .single();
  return (data ?? null) as DbEvent | null;
}

export async function addEvents(
  userId: string,
  events: Array<Omit<DbEventInsert, "id" | "created_at" | "updated_at" | "user_id"> & { recurrence_group_id?: string | null }>
): Promise<DbEvent[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("calendar_events")
    .insert(events.map(e => ({ user_id: userId, ...e })))
    .select(SELECT_COLS);
  return (data ?? []) as DbEvent[];
}

export async function updateEvent(id: string, patch: DbEventUpdate): Promise<void> {
  const supabase = createClient();
  await supabase.from("calendar_events").update(patch).eq("id", id);
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("calendar_events").delete().eq("id", id);
}
