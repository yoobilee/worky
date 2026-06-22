import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import type { Contact, ContactFormState } from "@/types/contact";

type DbContactRow    = Database["public"]["Tables"]["contacts"]["Row"];
type DbContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
type DbContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

const SELECT_COLS = "id, name, position, department, phone, email, kakao_id, birthday, memo, tags";

function rowToContact(row: DbContactRow): Contact {
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

function formToInsert(form: ContactFormState): Omit<DbContactInsert, "id" | "created_at" | "updated_at" | "user_id"> {
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

function formToUpdate(patch: Partial<ContactFormState>): DbContactUpdate {
  const update: DbContactUpdate = {};
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

export async function getContacts(userId: string): Promise<Contact[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contacts")
      .select(SELECT_COLS)
      .eq("user_id", userId)
      .order("name");
    if (error) throw error;
    return (data ?? []).map(row => rowToContact(row as DbContactRow));
  } catch (err) {
    console.error("[contacts] getContacts:", err);
    return [];
  }
}

export async function addContact(userId: string, form: ContactFormState): Promise<Contact | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contacts")
      .insert({ user_id: userId, ...formToInsert(form) })
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return data ? rowToContact(data as DbContactRow) : null;
  } catch (err) {
    console.error("[contacts] addContact:", err);
    return null;
  }
}

export async function updateContact(id: string, patch: Partial<ContactFormState>): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("contacts")
      .update(formToUpdate(patch))
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.error("[contacts] updateContact:", err);
  }
}

export async function deleteContact(id: string): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.error("[contacts] deleteContact:", err);
  }
}
