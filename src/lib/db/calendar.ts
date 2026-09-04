import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type DbEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type DbEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type DbEventUpdate = Database["public"]["Tables"]["calendar_events"]["Update"];

export type DbEvent = Pick<DbEventRow,
  "id" | "user_id" | "date" | "title" | "time" | "location" | "location_url" | "description"
> & { recurrence_group_id?: string | null };

const SELECT_COLS = "id, user_id, date, title, time, location, location_url, description, recurrence_group_id";

function requireMutationRow<T>(
  data: T | null,
  error: { message?: string } | null,
  operation: "create" | "update" | "delete",
): T {
  if (error) throw error;
  if (!data) {
    throw new Error(`Calendar event ${operation} affected no rows.`);
  }
  return data;
}

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
): Promise<DbEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({ user_id: userId, ...event })
    .select(SELECT_COLS)
    .single();
  return requireMutationRow(data as DbEvent | null, error, "create");
}

export async function addEvents(
  userId: string,
  events: Array<Omit<DbEventInsert, "id" | "created_at" | "updated_at" | "user_id"> & { recurrence_group_id?: string | null }>
): Promise<DbEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert(events.map(e => ({ user_id: userId, ...e })))
    .select(SELECT_COLS);
  if (error) throw error;
  const rows = (data ?? []) as DbEvent[];
  if (events.length > 0 && rows.length !== events.length) {
    throw new Error("Calendar event create affected an unexpected number of rows.");
  }
  return rows;
}

export async function updateEvent(userId: string, id: string, patch: DbEventUpdate): Promise<DbEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select(SELECT_COLS)
    .maybeSingle();
  return requireMutationRow(data as DbEvent | null, error, "update");
}

export async function deleteEvent(userId: string, id: string): Promise<Pick<DbEvent, "id" | "user_id">> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, user_id")
    .maybeSingle();
  return requireMutationRow(
    data as Pick<DbEvent, "id" | "user_id"> | null,
    error,
    "delete",
  );
}
