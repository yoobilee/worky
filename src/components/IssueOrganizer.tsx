"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  IconBug, IconLoader2, IconAlertTriangle, IconBrandGithub,
  IconExternalLink, IconCircleCheck, IconClipboardList, IconDeviceDesktop, IconRepeat,
} from "@tabler/icons-react";
import HelpButton from "./HelpButton";
import EditableResult from "./EditableResult";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { useToast } from "@/contexts/ToastContext";
import { createClient } from "@/lib/supabase/client";
import type { TranslationKey } from "@/lib/i18n/translations";

type Severity = "low" | "medium" | "high";

interface IssueResult {
  title: string;
  expectedBehavior: string;
  actualBehavior: string;
  environment: string;
  frequency: string;
  reproSteps: string[];
  severity: Severity;
}

interface MyIssue {
  id: string;
  title: string;
  status: string;
  github_issue_url: string | null;
}

const SYSTEM_PROMPT = `당신은 버그 리포트 정리 전문가입니다.
사용자가 자유롭게 서술한 버그 상황을 분석하여 아래 JSON 형식으로만 응답하세요.
마크다운 코드블록, 설명 텍스트 없이 순수 JSON만 반환하세요.

{
  "title": "버그를 한 줄로 요약한 제목",
  "expectedBehavior": "정상적으로 기대되는 동작",
  "actualBehavior": "실제로 발생한 동작",
  "environment": "브라우저, OS, 기기 등 환경 정보",
  "frequency": "발생 빈도 (예: 항상, 가끔, 특정 조건에서만)",
  "reproSteps": ["재현 단계를 순서대로 나열"],
  "severity": "low" | "medium" | "high"
}

작성 원칙:
- 사용자가 언급하지 않은 정보는 절대 추측하지 말고 빈 문자열 또는 빈 배열로 남길 것
- severity는 사용자가 명시하지 않았다면 내용을 바탕으로 합리적으로 추정하되 기본값은 medium
- 모든 값은 한국어로 작성`;

function parseResult(raw: string): IssueResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("응답을 파싱할 수 없습니다.");
  const parsed = JSON.parse(match[0]);
  const severity: Severity =
    parsed.severity === "low" || parsed.severity === "high" ? parsed.severity : "medium";
  return {
    title:            typeof parsed.title === "string" ? parsed.title : "",
    expectedBehavior: typeof parsed.expectedBehavior === "string" ? parsed.expectedBehavior : "",
    actualBehavior:   typeof parsed.actualBehavior === "string" ? parsed.actualBehavior : "",
    environment:      typeof parsed.environment === "string" ? parsed.environment : "",
    frequency:        typeof parsed.frequency === "string" ? parsed.frequency : "",
    reproSteps:       Array.isArray(parsed.reproSteps) ? parsed.reproSteps.filter((s: unknown) => typeof s === "string") : [],
    severity,
  };
}

const SEVERITY_ACTIVE_STYLES: Record<Severity, string> = {
  low:    "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-300 dark:border-zinc-600",
  medium: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700",
  high:   "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800",
};

export default function IssueOrganizer() {
  const { t } = useLocale();
  const toast = useToast();
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const [hasResult,       setHasResult]       = useState(false);
  const [editTitle,       setEditTitle]       = useState("");
  const [editExpected,    setEditExpected]    = useState("");
  const [editActual,      setEditActual]      = useState("");
  const [editEnvironment, setEditEnvironment] = useState("");
  const [editFrequency,   setEditFrequency]   = useState("");
  const [editReproSteps,  setEditReproSteps]  = useState("");
  const [severity,        setSeverity]        = useState<Severity>("medium");

  const [githubConnected,     setGithubConnected]     = useState(false);
  const [githubStatusLoading, setGithubStatusLoading] = useState(true);
  const [submitting,          setSubmitting]          = useState(false);

  const [myIssues,        setMyIssues]        = useState<MyIssue[]>([]);
  const [myIssuesLoading,  setMyIssuesLoading] = useState(true);

  useEffect(() => {
    if (hasResult) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasResult]);

  useEffect(() => {
    fetch("/api/settings/github")
      .then((res) => res.json())
      .then((data: { connected?: boolean }) => setGithubConnected(Boolean(data.connected)))
      .catch(() => {})
      .finally(() => setGithubStatusLoading(false));
  }, []);

  const loadMyIssues = async () => {
    setMyIssuesLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("issues")
        .select("id, title, status, github_issue_url")
        .order("created_at", { ascending: false });
      setMyIssues(data ?? []);
    } finally {
      setMyIssuesLoading(false);
    }
  };

  useEffect(() => {
    loadMyIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true); setError(""); setHasResult(false);
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: input.trim() }],
          systemPrompt: SYSTEM_PROMPT,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("unknown_error"));
      const parsed = parseResult(data.result);
      setEditTitle(parsed.title);
      setEditExpected(parsed.expectedBehavior);
      setEditActual(parsed.actualBehavior);
      setEditEnvironment(parsed.environment);
      setEditFrequency(parsed.frequency);
      setEditReproSteps(parsed.reproSteps.join("\n"));
      setSeverity(parsed.severity);
      setHasResult(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("io_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToGithub = async () => {
    if (!editTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/issues/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          expectedBehavior: editExpected,
          actualBehavior: editActual,
          environment: editEnvironment,
          frequency: editFrequency,
          reproSteps: editReproSteps.split("\n").map((s) => s.trim()).filter(Boolean),
          severity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("io_submit_error"));
      toast.success(t("io_github_submit_success"));
      setInput("");
      setHasResult(false);
      loadMyIssues();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("io_submit_error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto w-full self-start">

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          {t("io_input_label")}
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder={t("io_ph_input")}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleAnalyze}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            {loading ? (
              <><IconLoader2 className="w-4 h-4 animate-spin text-white" />{t("io_loading")}</>
            ) : (
              <><IconBug className="w-4 h-4" />{t("io_analyze_btn")}</>
            )}
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div role="alert" className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <IconAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* 결과 */}
      {hasResult ? (
        <div ref={resultRef} className="space-y-3">

          {/* 제목 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{t("io_title_label")}</p>
            <EditableResult value={editTitle} onChange={setEditTitle} rows={2}>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{editTitle || "—"}</p>
            </EditableResult>
          </div>

          {/* 심각도 선택 */}
          <div className="flex items-center gap-2 px-1 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t("io_severity_title")}</span>
            {(["low", "medium", "high"] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setSeverity(lv)}
                className={[
                  "px-3 py-1 rounded-full text-xs font-semibold border transition",
                  severity === lv
                    ? SEVERITY_ACTIVE_STYLES[lv]
                    : "bg-transparent text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600",
                ].join(" ")}
              >
                {t(`io_severity_${lv}` as TranslationKey)}
              </button>
            ))}
          </div>

          {/* 예상 동작 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                <IconCircleCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{t("io_expected_title")}</p>
            </div>
            <EditableResult value={editExpected} onChange={setEditExpected} rows={3}>
              <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{editExpected || "—"}</p>
            </EditableResult>
          </div>

          {/* 실제 동작 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/40 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <IconAlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{t("io_actual_title")}</p>
            </div>
            <EditableResult value={editActual} onChange={setEditActual} rows={3}>
              <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{editActual || "—"}</p>
            </EditableResult>
          </div>

          {/* 재현 방법 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-[#6C63FF]/30 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center shrink-0">
                <IconRepeat className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF]" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{t("io_repro_title")}</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">{t("io_repro_desc")}</p>
            <EditableResult value={editReproSteps} onChange={setEditReproSteps} rows={4}>
              {editReproSteps.trim() ? (
                <ol className="space-y-1.5 list-decimal list-inside">
                  {editReproSteps.split("\n").filter((s) => s.trim()).map((step, i) => (
                    <li key={i} className="text-sm text-slate-700 dark:text-zinc-300">{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-400 dark:text-zinc-500">—</p>
              )}
            </EditableResult>
          </div>

          {/* 환경 / 발생 빈도 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <IconDeviceDesktop className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{t("io_environment_title")}</p>
              </div>
              <EditableResult value={editEnvironment} onChange={setEditEnvironment} rows={2}>
                <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{editEnvironment || "—"}</p>
              </EditableResult>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <IconClipboardList className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{t("io_frequency_title")}</p>
              </div>
              <EditableResult value={editFrequency} onChange={setEditFrequency} rows={2}>
                <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{editFrequency || "—"}</p>
              </EditableResult>
            </div>
          </div>

          {/* GitHub 등록 */}
          {!githubStatusLoading && (
            githubConnected ? (
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitToGithub}
                  disabled={submitting || !editTitle.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
                >
                  {submitting ? (
                    <><IconLoader2 className="w-4 h-4 animate-spin" />{t("io_github_submitting")}</>
                  ) : (
                    <><IconBrandGithub className="w-4 h-4" />{t("io_github_submit_btn")}</>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t("io_github_not_connected_title")}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">{t("io_github_not_connected_desc")}</p>
                </div>
                <Link
                  href="/settings"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
                >
                  {t("io_github_go_settings")}
                </Link>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
          <IconBug className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">{t("io_empty")}</p>
        </div>
      )}

      {/* 내가 등록한 이슈 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3">{t("io_my_issues_title")}</p>
        {myIssuesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-slate-100 dark:bg-zinc-800 rounded-xl h-12" />
            ))}
          </div>
        ) : myIssues.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-zinc-500">{t("io_my_issues_empty")}</p>
        ) : (
          <div className="rounded-xl border border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
            {myIssues.map((issue) => (
              <div key={issue.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={[
                    "shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    issue.status === "open"
                      ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400",
                  ].join(" ")}>
                    {issue.status === "open" ? t("io_status_open") : t("io_status_closed")}
                  </span>
                  <p className="text-sm text-slate-700 dark:text-zinc-200 truncate">{issue.title}</p>
                </div>
                {issue.github_issue_url && (
                  <a
                    href={issue.github_issue_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 flex items-center gap-1 text-xs text-[#4D44CC] dark:text-[#8B85FF] hover:underline"
                  >
                    <IconExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <HelpButton
        title={t("help_io_title")}
        steps={[
          { step: t("help_io_1_step"), desc: t("help_io_1_desc") },
          { step: t("help_io_2_step"), desc: t("help_io_2_desc") },
          { step: t("help_io_3_step"), desc: t("help_io_3_desc") },
          { step: t("help_io_4_step"), desc: t("help_io_4_desc") },
        ]}
      />
    </div>
  );
}
