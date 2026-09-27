"use client";

import React from "react";
import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";

interface HomeAccountStatusProps {
  weekTotal: number;
  leaveRemaining: number | null;
}

export default function HomeAccountStatus({ weekTotal, leaveRemaining }: HomeAccountStatusProps) {
  const { t } = useLocale();

  const activity = Number.isFinite(weekTotal) && weekTotal > 0
    ? tFormat(t("wk_brief_activity"), { n: weekTotal }) : null;
  // Zero remaining days is useful information, not a missing value.
  const leave = leaveRemaining !== null && Number.isFinite(leaveRemaining) && leaveRemaining >= 0
    ? tFormat(t("wk_brief_leave"), { n: leaveRemaining }) : null;
  if (!activity && !leave) return null;

  return <div className="wk-account-status" role="group" aria-label={t("wk_account_status")}>
    {activity && <span>{activity}</span>}
    {activity && leave && <span aria-hidden="true">·</span>}
    {leave && <Link className="wk-text-link" href="/settings">{leave}<IconArrowRight className="wk-link-arrow" size={14} aria-hidden="true" /></Link>}
  </div>;
}
