import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/supabase";

export type FeatureKey =
  | "data" | "email" | "template" | "translate"
  | "summary" | "schedule" | "insight" | "qa" | "report" | "feedback";

function getWeekStart(): string {
  const now  = new Date();
  const day  = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

export async function getStats(
  userId: string,
  weekStart?: string
): Promise<Partial<Record<FeatureKey, number>>> {
  const supabase = createClient();
  const week = weekStart ?? getWeekStart();
  const { data } = await supabase
    .from("usage_stats")
    .select("stats")
    .eq("user_id", userId)
    .eq("week_start", week)
    .maybeSingle();
  return (data?.stats as Partial<Record<FeatureKey, number>>) ?? {};
}

export async function upsertStats(
  userId: string,
  stats: Partial<Record<FeatureKey, number>>,
  weekStart?: string
): Promise<void> {
  const supabase = createClient();
  const week = weekStart ?? getWeekStart();
  await supabase
    .from("usage_stats")
    .upsert(
      { user_id: userId, week_start: week, stats: stats as unknown as Json },
      { onConflict: "user_id,week_start" }
    );
}

export async function trackFeature(userId: string, feature: FeatureKey): Promise<void> {
  const current = await getStats(userId);
  const updated = { ...current, [feature]: (current[feature] ?? 0) + 1 };
  await upsertStats(userId, updated);
}

export async function getTopFeatures(
  userId: string,
  limit: number = 5
): Promise<Array<{ feature: FeatureKey; count: number }>> {
  const supabase = createClient();
  const { data } = await supabase
    .from("usage_stats")
    .select("stats")
    .eq("user_id", userId);

  const totals: Partial<Record<FeatureKey, number>> = {};
  for (const row of data ?? []) {
    const stats = (row.stats as Partial<Record<FeatureKey, number>>) ?? {};
    for (const [key, count] of Object.entries(stats)) {
      const feature = key as FeatureKey;
      totals[feature] = (totals[feature] ?? 0) + (count ?? 0);
    }
  }

  return Object.entries(totals)
    .map(([feature, count]) => ({ feature: feature as FeatureKey, count: count ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
