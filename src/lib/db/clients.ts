import { createClient } from "@/lib/supabase/client";

export interface DbClient {
  id:               string;
  name:             string;
  status:           string;
  contact_person:   string;
  phone:            string;
  link:             string;
  tags:             string[];
  contract_start:   string | null;
  contract_days:    number | null;
  report_tone:      string;
  memo:             string;
  history:          unknown[];
  progress:         Record<string, string>;
  show_grass_grid:  boolean;
  mask_phone:       boolean;
  company_phone:    string;
  mask_company_phone: boolean;
  custom_fields:    { key: string; value: string; masked: boolean }[] | null;
  created_at:       string;
}

export async function getClients(userId: string): Promise<DbClient[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, status, contact_person, phone, link, tags, contract_start, contract_days, report_tone, memo, history, progress, show_grass_grid, mask_phone, company_phone, mask_company_phone, custom_fields, created_at")
    .eq("user_id", userId)
    .order("created_at");
  return (data as DbClient[]) ?? [];
}

export async function addClient(userId: string, client: Omit<DbClient, "id" | "created_at">): Promise<DbClient | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .insert({ user_id: userId, ...client })
    .select("id, name, status, contact_person, phone, link, tags, contract_start, contract_days, report_tone, memo, history, progress, show_grass_grid, mask_phone, company_phone, mask_company_phone, custom_fields, created_at")
    .single();
  return data as DbClient | null;
}

export async function updateClient(id: string, patch: Partial<Omit<DbClient, "id" | "created_at">>): Promise<void> {
  const supabase = createClient();
  await supabase.from("clients").update(patch).eq("id", id);
}

export async function deleteClient(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("clients").delete().eq("id", id);
}
