import { createClient } from "@/lib/supabase/client";
import type { Desk } from "@/types/seating";

export async function getDesks(userId: string): Promise<Desk[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("seating_desks")
    .select("id, member_id, x, y")
    .eq("user_id", userId);
  return (data ?? []).map(d => ({ id: d.id, memberId: d.member_id, x: Number(d.x), y: Number(d.y) }));
}

export async function addDesk(userId: string, x: number, y: number): Promise<Desk | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("seating_desks")
    .insert({ user_id: userId, x, y })
    .select("id, member_id, x, y")
    .single();
  return data ? { id: data.id, memberId: data.member_id, x: Number(data.x), y: Number(data.y) } : null;
}

export async function updateDeskPosition(id: string, x: number, y: number): Promise<void> {
  const supabase = createClient();
  await supabase.from("seating_desks").update({ x, y }).eq("id", id);
}

export async function assignDeskMember(id: string, memberId: string | null): Promise<void> {
  const supabase = createClient();
  await supabase.from("seating_desks").update({ member_id: memberId }).eq("id", id);
}

export async function deleteDesk(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("seating_desks").delete().eq("id", id);
}
