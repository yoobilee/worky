import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type DbClientRow    = Database["public"]["Tables"]["clients"]["Row"];
type DbClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
type DbClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export type DbClient = Pick<DbClientRow,
  "id" | "name" | "status" | "contact_person" | "phone" | "link" | "tags" |
  "contract_start" | "contract_days" | "report_tone" | "memo" | "history" |
  "progress" | "show_grass_grid" | "mask_phone" | "company_phone" |
  "mask_company_phone" | "custom_fields" | "created_at"
>;

const SELECT_COLS = "id, name, status, contact_person, phone, link, tags, contract_start, contract_days, report_tone, memo, history, progress, show_grass_grid, mask_phone, company_phone, mask_company_phone, custom_fields, created_at";

export async function getClients(userId: string): Promise<DbClient[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("created_at");
  return (data ?? []) as DbClient[];
}

export async function addClient(
  userId: string,
  client: Omit<DbClientInsert, "id" | "created_at" | "updated_at" | "user_id">
): Promise<DbClient | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .insert({ user_id: userId, ...client })
    .select(SELECT_COLS)
    .single();
  return (data ?? null) as DbClient | null;
}

export async function addClients(
  userId: string,
  clients: Array<Omit<DbClientInsert, "id" | "created_at" | "updated_at" | "user_id">>
): Promise<DbClient[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .insert(clients.map(c => ({ user_id: userId, ...c })))
    .select(SELECT_COLS);
  return (data ?? []) as DbClient[];
}

export async function updateClient(id: string, patch: DbClientUpdate): Promise<void> {
  const supabase = createClient();
  await supabase.from("clients").update(patch).eq("id", id);
}

export async function deleteClient(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("clients").delete().eq("id", id);
}
