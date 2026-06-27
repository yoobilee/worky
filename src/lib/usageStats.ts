import { createClient } from "@/lib/supabase/client";
import { trackFeature } from "@/lib/db/usage_stats";

export type FeatureKey =
  | "data" | "email" | "template" | "translate"
  | "summary" | "schedule" | "insight" | "qa" | "report" | "feedback";

const STORAGE_KEY = "worky_usage_stats";

function getWeekKey(): string {
  const now  = new Date();
  const day  = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

export function trackUsage(feature: FeatureKey): void {
  // localStorage 기록 (즉각 반응)
  try {
    const raw   = localStorage.getItem(STORAGE_KEY);
    const stats: Record<string, Record<string, number>> = raw ? JSON.parse(raw) : {};
    const week  = getWeekKey();
    if (!stats[week]) stats[week] = {};
    stats[week][feature] = (stats[week][feature] ?? 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {}

  // Supabase 기록 (fire-and-forget)
  createClient().auth.getUser().then(({ data }) => {
    if (data.user) trackFeature(data.user.id, feature).catch(() => {});
  });
}

export function getThisWeekStats(): Partial<Record<FeatureKey, number>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const stats: Record<string, Record<string, number>> = JSON.parse(raw);
    return (stats[getWeekKey()] ?? {}) as Partial<Record<FeatureKey, number>>;
  } catch {
    return {};
  }
}
