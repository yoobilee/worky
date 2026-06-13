import { createClient } from "@/lib/supabase/client";

export interface DbEvent {
  id:          string;
  date:        string;
  title:       string;
  time?:       string;
  location?:   string;
  location_url?: string;
  description?: string;
}

export async function getEvents(userId: string): Promise<DbEvent[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("id, date, title, time, location, location_url, description")
    .eq("user_id", userId)
    .order("date");
  return (data as DbEvent[]) ?? [];
}

export async function addEvent(
  userId: string,
  event: Omit<DbEvent, "id">
): Promise<DbEvent | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("calendar_events")
    .insert({ user_id: userId, ...event })
    .select("id, date, title, time, location, location_url, description")
    .single();
  return data as DbEvent | null;
}

export async function updateEvent(id: string, patch: Partial<Omit<DbEvent, "id">>): Promise<void> {
  const supabase = createClient();
  await supabase.from("calendar_events").update(patch).eq("id", id);
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("calendar_events").delete().eq("id", id);
}
