import { createClient } from "@/lib/supabase/client";

export interface UserNotification {
  id: string;
  title: string;
  content: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export async function getUserNotifications(userId: string): Promise<UserNotification[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_notifications")
    .select("id, title, content, type, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as UserNotification[];
}

export async function addUserNotification(
  userId: string, title: string, content: string, type: string = "schedule"
): Promise<void> {
  const supabase = createClient();
  try {
    await supabase.from("user_notifications").insert({ user_id: userId, title, content, type });
  } catch (e) { console.error("[알림] 저장 실패:", e); }
}

export async function markUserNotificationRead(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("user_notifications").update({ is_read: true }).eq("id", id);
}

export async function markAllUserNotificationsRead(userId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("user_notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
}
