import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import type { Member, MemberFormState } from "@/types/member";

type DbMemberRow    = Database["public"]["Tables"]["members"]["Row"];
type DbMemberInsert = Database["public"]["Tables"]["members"]["Insert"];
type DbMemberUpdate = Database["public"]["Tables"]["members"]["Update"];

const SELECT_COLS = "id, name, position, department, phone, email, kakao_id, birthday, memo, tags";

function rowToMember(row: DbMemberRow): Member {
  return {
    id:         row.id,
    name:       row.name,
    position:   row.position,
    department: row.department,
    phone:      row.phone,
    email:      row.email,
    kakaoId:    row.kakao_id,
    birthday:   row.birthday,
    memo:       row.memo,
    tags:       Array.isArray(row.tags) ? (row.tags as string[]) : [],
  };
}

function formToInsert(form: MemberFormState): Omit<DbMemberInsert, "id" | "created_at" | "updated_at" | "user_id"> {
  return {
    name:       form.name.trim(),
    position:   form.position.trim() || null,
    department: form.department.trim() || null,
    phone:      form.phone.trim() || null,
    email:      form.email.trim() || null,
    kakao_id:   form.kakaoId.trim() || null,
    birthday:   form.birthday || null,
    memo:       form.memo.trim() || null,
    tags:       form.tags,
  };
}

function formToUpdate(patch: Partial<MemberFormState>): DbMemberUpdate {
  const update: DbMemberUpdate = {};
  if (patch.name       !== undefined) update.name       = patch.name.trim();
  if (patch.position   !== undefined) update.position   = patch.position.trim() || null;
  if (patch.department !== undefined) update.department = patch.department.trim() || null;
  if (patch.phone      !== undefined) update.phone      = patch.phone.trim() || null;
  if (patch.email      !== undefined) update.email      = patch.email.trim() || null;
  if (patch.kakaoId    !== undefined) update.kakao_id   = patch.kakaoId.trim() || null;
  if (patch.birthday   !== undefined) update.birthday   = patch.birthday || null;
  if (patch.memo       !== undefined) update.memo       = patch.memo.trim() || null;
  if (patch.tags       !== undefined) update.tags       = patch.tags;
  return update;
}

export async function getMembers(userId: string): Promise<Member[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("members")
      .select(SELECT_COLS)
      .eq("user_id", userId)
      .order("name");
    if (error) throw error;
    return (data ?? []).map(row => rowToMember(row as DbMemberRow));
  } catch (err) {
    console.error("[members] getMembers:", err);
    return [];
  }
}

export async function addMember(userId: string, form: MemberFormState): Promise<Member | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("members")
      .insert({ user_id: userId, ...formToInsert(form) })
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return data ? rowToMember(data as DbMemberRow) : null;
  } catch (err) {
    console.error("[members] addMember:", err);
    return null;
  }
}

export async function updateMember(id: string, patch: Partial<MemberFormState>): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("members")
      .update(formToUpdate(patch))
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.error("[members] updateMember:", err);
  }
}

export async function deleteMember(id: string): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.error("[members] deleteMember:", err);
  }
}
