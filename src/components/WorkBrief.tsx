"use client";

import React, { useEffect, useId, useState } from "react";
import Link from "next/link";
import { IconChevronDown } from "@tabler/icons-react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";

interface WorkBriefProps {
  weekTotal: number;
  leaveRemaining: number | null;
  features: { href: string; label: string }[];
  tip: string;
  tipCategory?: string;
}

export default function WorkBrief({ weekTotal, leaveRemaining, features, tip, tipCategory }: WorkBriefProps) {
  const { t } = useLocale();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [present, setPresent] = useState(false);

  useEffect(() => {
    if (expanded) { setPresent(true); return; }
    // Keep the content through its exit, but remove it from keyboard navigation immediately.
    const timeout = window.setTimeout(() => setPresent(false), 160);
    return () => window.clearTimeout(timeout);
  }, [expanded]);

  const activity = Number.isFinite(weekTotal) && weekTotal > 0
    ? tFormat(t("wk_brief_activity"), { n: weekTotal }) : null;
  // Zero remaining days is useful information, not a missing value.
  const leave = leaveRemaining !== null && Number.isFinite(leaveRemaining)
    ? tFormat(t("wk_brief_leave"), { n: leaveRemaining }) : null;
  const hasTip = Boolean(tip.trim());
  const count = Number(Boolean(activity || leave)) + Number(features.length > 0) + Number(hasTip);
  if (!count) return null;
  const summary = [activity, leave].filter(Boolean).join(" · ")
    || (features.length ? `${t("wk_brief_frequent")} · ${features[0].label}` : tip);

  return <section className="wk-brief" data-state={expanded ? "open" : "closed"} aria-labelledby={`${id}-title`}>
    <button type="button" className="wk-brief-toggle" aria-expanded={expanded}
      aria-controls={`${id}-content`} onClick={() => setExpanded(value => !value)}>
      <span id={`${id}-title`} className="wk-brief-title">{t("wk_context")}</span>
      <span className="wk-brief-summary">{summary}</span>
      <IconChevronDown className="wk-brief-chevron" size={16} aria-hidden="true" />
    </button>
    <div id={`${id}-content`} className="wk-brief-content" data-columns={count}
      hidden={!expanded && !present} inert={!expanded}>
      {(activity || leave) && <dl className="wk-brief-metrics">
        {activity && <div><dt>{t("weekly_activity")}</dt><dd>{tFormat(t("home_total_n"), { n: weekTotal })}</dd></div>}
        {leave && <div><dt>{t("home_metric_leave_left")}</dt><dd><Link href="/settings">{tFormat(t("wk_brief_days"), { n: leaveRemaining! })}</Link></dd></div>}
      </dl>}
      {features.length > 0 && <div className="wk-brief-group">
        <h3>{t("wk_brief_frequent")}</h3>
        <ul className="wk-brief-links">{features.map(feature => <li key={feature.href}><Link href={feature.href}>{feature.label}</Link></li>)}</ul>
      </div>}
      {hasTip && <div className="wk-brief-group wk-brief-tip">
        <h3>{t("daily_tip")}{tipCategory && <span> · {tipCategory}</span>}</h3>
        <p>{tip}</p>
      </div>}
    </div>
  </section>;
}
