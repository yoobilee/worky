import { createClient } from "@/lib/supabase/client";

export type AnnouncementType = "patch" | "schedule" | "notice";

export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, type, title, content, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getAnnouncements] select error:", error);
    return [];
  }
  return (data ?? []) as Announcement[];
}

export async function getReadIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[getReadIds] select error:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.announcement_id as string));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient();

  const announcements = await getAnnouncements();
  if (announcements.length === 0) return 0;

  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[getUnreadCount] select error:", error);
    return 0;
  }

  const readIds = new Set((data ?? []).map((r) => r.announcement_id));
  return announcements.filter((a) => !readIds.has(a.id)).length;
}

export async function markAsRead(userId: string, announcementId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("announcement_reads")
    .upsert({ user_id: userId, announcement_id: announcementId });

  if (error) {
    console.error("[markAsRead] upsert error:", error);
  }
}

export async function markAllAsRead(userId: string, announcementIds: string[]): Promise<void> {
  if (announcementIds.length === 0) return;
  const supabase = createClient();
  const rows = announcementIds.map((id) => ({ user_id: userId, announcement_id: id }));
  const { error } = await supabase
    .from("announcement_reads")
    .upsert(rows);

  if (error) {
    console.error("[markAllAsRead] upsert error:", error);
  }
}
