import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// 영업일(주말 제외) 기준으로 days만큼 더한 날짜를 반환
function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return result;
}

function diffInDays(target: Date, today: Date): number {
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

Deno.serve(async () => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().split("T")[0];
  const todayDate = new Date(`${today}T00:00:00Z`);

  // 1. 거래처 계약 만료 알림
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name, contract_start, contract_days, status")
    .not("contract_start", "is", null)
    .not("contract_days", "is", null);

  if (clientsError) {
    console.error("[daily-notifications] clients select error:", clientsError);
  }

  for (const client of clients ?? []) {
    const start = new Date(`${client.contract_start}T00:00:00Z`);
    const expiryDate = addBusinessDays(start, client.contract_days as number);
    const dday = diffInDays(expiryDate, todayDate);

    if (![7, 3, 1, 0].includes(dday)) continue;

    const { data: existing, error: existingError } = await supabase
      .from("announcements")
      .select("id")
      .eq("metadata->>type", "expiry")
      .eq("metadata->>client_id", client.id)
      .eq("metadata->>date", today)
      .maybeSingle();

    if (existingError) {
      console.error("[daily-notifications] expiry check error:", existingError);
      continue;
    }
    if (existing) continue;

    const title =
      dday === 0 ? `계약 만료 D-Day - ${client.name}` : `계약 만료 임박 - ${client.name}`;
    const content =
      dday === 0
        ? `${client.name} 계약이 오늘 만료됩니다.`
        : `${client.name} 계약이 ${dday}일 후 만료됩니다.`;

    const { error: insertError } = await supabase.from("announcements").insert({
      title,
      content,
      type: "schedule",
      metadata: { client_id: client.id, date: today, type: "expiry" },
    });

    if (insertError) {
      console.error("[daily-notifications] expiry insert error:", insertError);
    }
  }

  // 2. 진행 중 거래처 보고 알림
  const { data: inProgressClients, error: inProgressError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("status", "inprogress");

  if (inProgressError) {
    console.error("[daily-notifications] inprogress clients select error:", inProgressError);
  }

  if (inProgressClients && inProgressClients.length > 0) {
    const { data: existingReport, error: existingReportError } = await supabase
      .from("announcements")
      .select("id")
      .eq("metadata->>type", "daily_report")
      .eq("metadata->>date", today)
      .maybeSingle();

    if (existingReportError) {
      console.error("[daily-notifications] daily_report check error:", existingReportError);
    }

    if (!existingReport) {
      const names = inProgressClients.map((c) => c.name).join(", ");
      const { error: insertError } = await supabase.from("announcements").insert({
        title: "오늘 보고 대상 거래처",
        content: `진행 중인 거래처 ${inProgressClients.length}개: ${names} 보고가 필요합니다.`,
        type: "notice",
        metadata: { date: today, type: "daily_report" },
      });

      if (insertError) {
        console.error("[daily-notifications] daily_report insert error:", insertError);
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
