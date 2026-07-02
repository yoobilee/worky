import { addUserNotification } from "@/lib/db/user_notifications";

export interface NotificationSettings {
  eventNotif: boolean;
  ddayNotif:  boolean;
}

const SETTINGS_KEY  = "worky_notification_settings";
const SENT_DATE_KEY = "worky_notif_sent_date";

/* ── 설정 로드/저장 ── */

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as NotificationSettings;
  } catch {}
  return { eventNotif: true, ddayNotif: true };
}

export function saveNotificationSettings(s: NotificationSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/* ── 권한 ── */

export function getPermissionStatus(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/* ── 발송 ── */

export function sendNotification(title: string, body: string): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    });
  } catch {}
}

/* ── D-day 계산 헬퍼 ── */

export function addBusinessDays(start: string, days: number): string {
  const d = new Date(start + "T00:00:00");
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function calcDday(endDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(endDate + "T00:00:00");
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

/* ── 오늘 날짜 키 ── */

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── 일정 알림 ── */

export async function checkTodayEvents(
  events: Array<{ date: string; title: string }>,
  userId?: string | null
): Promise<void> {
  const today  = todayStr();
  const todays = events.filter((e) => e.date === today);
  if (todays.length === 0) return;
  const titles = todays.map((e) => e.title).join(", ");
  const body   = todays.length === 1
    ? `오늘 일정: ${titles}`
    : `오늘 ${todays.length}개 일정 — ${titles}`;
  sendNotification("📅 오늘의 일정", body);
  if (userId) await addUserNotification(userId, "📅 오늘의 일정", body, "schedule");
}

/* ── 거래처 D-day 알림 ── */

export async function checkDdayClients(
  clients: Array<{ name: string; contract_start?: string | null; contract_days?: number | null }>,
  userId?: string | null
): Promise<void> {
  for (const c of clients) {
    if (!c.contract_start || !c.contract_days) continue;
    const end  = addBusinessDays(c.contract_start, c.contract_days);
    const dday = calcDday(end);
    if (dday < 0 || dday > 7) continue;

    let body: string;
    if (dday === 0) body = `${c.name} 계약 만료 D-Day!`;
    else if (dday <= 3) body = `${c.name} 계약 만료 D-${dday} (긴급)`;
    else body = `${c.name} 계약 만료 D-${dday}`;

    sendNotification("⚠️ 계약 만료 임박", body);
    if (userId) await addUserNotification(userId, "⚠️ 계약 만료 임박", body, "notice");
  }
}

/* ── 하루 한 번 전체 체크 ── */

export async function runDailyNotificationChecks(
  events:  Array<{ date: string; title: string }>,
  clients: Array<{ name: string; contract_start?: string | null; contract_days?: number | null }>,
  userId?: string | null
): Promise<void> {
  const today = todayStr();
  if (localStorage.getItem(SENT_DATE_KEY) === today) return;
  localStorage.setItem(SENT_DATE_KEY, today);

  const settings = loadNotificationSettings();
  if (settings.eventNotif) await checkTodayEvents(events, userId);
  if (settings.ddayNotif)  await checkDdayClients(clients, userId);
}
