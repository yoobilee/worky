export type FeatureKey =
  | "data" | "email" | "template" | "translate"
  | "summary" | "schedule" | "insight" | "qa";

const STORAGE_KEY = "worky_usage_stats";

// 이번 주 월요일 날짜를 키로 사용
function getWeekKey(): string {
  const now = new Date();
  const day  = now.getDay(); // 0=일, 1=월 ...
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

export function trackUsage(feature: FeatureKey): void {
  try {
    const raw   = localStorage.getItem(STORAGE_KEY);
    const stats: Record<string, Record<string, number>> = raw ? JSON.parse(raw) : {};
    const week  = getWeekKey();
    if (!stats[week]) stats[week] = {};
    stats[week][feature] = (stats[week][feature] ?? 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {}
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
