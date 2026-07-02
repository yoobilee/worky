"use client";

import HelpButton from "./HelpButton";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { IconLoader2, IconSparkles, IconHistory, IconTrash, IconX } from "@tabler/icons-react";
import { trackUsage } from "@/lib/usageStats";
import { createClient } from "@/lib/supabase/client";
import { getDataCleanerHistory, addDataCleanerHistory, deleteDataCleanerHistory, type DataCleanerHistoryEntry } from "@/lib/db/dataCleanerHistory";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";
import type { TranslationKey } from "@/lib/i18n/translations";

/* ── AI / 청크 처리 ── */
const SYSTEM_PROMPT = `당신은 데이터 정리 전문가입니다. 사용자가 붙여넣은 지저분한 텍스트나 데이터를 분석하여 깔끔한 HTML 표로 변환하세요.
반드시 <table> 태그로 시작하고 </table> 태그로 끝나는 HTML만 반환하세요.
마크다운 코드블록, 설명 텍스트는 절대 포함하지 마세요.
thead > tr > th 로 헤더를, tbody > tr > td 로 데이터를 구성하세요.`;

const CHUNK_SYSTEM_PROMPT = `당신은 데이터 정리 전문가입니다. 아래 CSV 데이터(헤더 포함)를 HTML 표로 변환하세요.
반드시 <table> 태그로 시작하고 </table> 태그로 끝나는 HTML만 반환하세요.
마크다운 코드블록, 설명 텍스트는 절대 포함하지 마세요.
thead > tr > th 로 헤더를, tbody > tr > td 로 데이터를 구성하세요.`;

const CHUNK_SIZE = 50;

function extractTableHtml(raw: string): string {
  const match = raw.match(/<table[\s\S]*<\/table>/i);
  return match ? match[0] : raw;
}

async function callGroqApi(text: string, systemPrompt: string): Promise<string> {
  const res = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: text }],
      systemPrompt,
      max_tokens: 8192,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
  return data.result as string;
}

async function cleanDataWithChunks(
  sourceText: string,
  onProgress: (done: number, total: number) => void
): Promise<string> {
  const lines = sourceText.trim().split("\n");

  if (lines.length <= CHUNK_SIZE + 1) {
    const raw = await callGroqApi(sourceText, SYSTEM_PROMPT);
    onProgress(1, 1);
    return extractTableHtml(raw);
  }

  const header   = lines[0];
  const dataRows = lines.slice(1);
  const chunks: string[][] = [];
  for (let i = 0; i < dataRows.length; i += CHUNK_SIZE)
    chunks.push(dataRows.slice(i, i + CHUNK_SIZE));

  let theadHtml = "";
  const tbodyRows: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = [header, ...chunks[i]].join("\n");
    const raw       = await callGroqApi(chunkText, CHUNK_SYSTEM_PROMPT);
    const tableHtml = extractTableHtml(raw);
    if (i === 0) {
      const m = tableHtml.match(/<thead[\s\S]*?<\/thead>/i);
      theadHtml = m ? m[0] : "";
    }
    const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
    if (tbodyMatch) {
      const trs = tbodyMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
      tbodyRows.push(...trs);
    }
    onProgress(i + 1, chunks.length);
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 500));
  }

  return `<table>${theadHtml}<tbody>${tbodyRows.join("")}</tbody></table>`;
}

function tableHtmlToCSV(html: string): string {
  const doc  = new DOMParser().parseFromString(html, "text/html");
  const rows = doc.querySelectorAll("tr");
  return Array.from(rows)
    .map((row) =>
      Array.from(row.querySelectorAll("th, td"))
        .map((cell) => {
          const text = (cell.textContent ?? "")
            .replace(/\r\n|\r|\n/g, " ")
            .replace(/"/g, '""');
          return `"${text}"`;
        })
        .join(",")
    )
    .join("\n");
}

const CLEAN_COUNT_KEY = "worky_clean_count";
const LAST_CLEAN_KEY  = "worky_last_clean";

function formatLastClean(iso: string | null, t: (key: TranslationKey) => string): string {
  if (!iso) return t("dc_no_record");
  const then = new Date(iso);
  const now  = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thenStart  = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const diffDays   = Math.round((todayStart.getTime() - thenStart.getTime()) / 86400000);
  if (diffDays === 0) {
    const hh = String(then.getHours()).padStart(2, "0");
    const mm = String(then.getMinutes()).padStart(2, "0");
    return tFormat(t("dc_today"), { hh, mm });
  }
  if (diffDays === 1) return t("dc_yesterday");
  return tFormat(t("dc_days_ago"), { n: String(diffDays) });
}

/* ── 메인 컴포넌트 ── */
export default function DataCleaner() {
  const { t, locale } = useLocale();
  const [input,         setInput]         = useState("");
  const [tableHtml,     setTableHtml]     = useState("");
  const [loading,       setLoading]       = useState(false);
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null);
  const [error,         setError]         = useState("");
  const [copied,        setCopied]        = useState(false);
  const [cleanCount,    setCleanCount]    = useState(0);
  const [lastClean,     setLastClean]     = useState<string | null>(null);
  const [userId,        setUserId]        = useState<string | null>(null);
  const [showHistory,   setShowHistory]   = useState(false);
  const [history,       setHistory]       = useState<DataCleanerHistoryEntry[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    const count = localStorage.getItem(CLEAN_COUNT_KEY);
    if (count) setCleanCount(parseInt(count, 10) || 0);
    setLastClean(localStorage.getItem(LAST_CLEAN_KEY));
  }, []);

  useEffect(() => {
    if (tableHtml) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [tableHtml]);

  const handleClean = async () => {
    if (!input.trim()) return;
    setError("");
    setTableHtml("");
    setLoading(true);
    setChunkProgress(null);
    try {
      const result = await cleanDataWithChunks(input, (done, total) => {
        setChunkProgress({ done, total });
      });
      setTableHtml(result);
      if (userId) addDataCleanerHistory(userId, input, result);
      trackUsage("data");
      const now = new Date().toISOString();
      localStorage.setItem(LAST_CLEAN_KEY, now);
      setLastClean(now);
      setCleanCount((prev) => {
        const next = prev + 1;
        localStorage.setItem(CLEAN_COUNT_KEY, String(next));
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dc_error"));
    } finally {
      setLoading(false);
      setChunkProgress(null);
    }
  };

  const handleCopy = async () => {
    if (!tableHtml) return;
    await navigator.clipboard.writeText(tableHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    if (!tableHtml) return;
    const csv  = tableHtmlToCSV(tableHtml);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "worky_정리데이터.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const openHistory = async () => {
    if (!userId) return;
    setHistory(await getDataCleanerHistory(userId));
    setShowHistory(true);
  };

  const loadHistoryEntry = (entry: DataCleanerHistoryEntry) => {
    setInput(entry.inputText);
    setTableHtml(entry.resultHtml);
    setShowHistory(false);
  };

  const removeHistoryEntry = async (id: string) => {
    await deleteDataCleanerHistory(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="space-y-3 max-w-5xl mx-auto w-full">
      {/* Bento 통계 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t("dc_stat_count")}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{tFormat(t("dc_count_n"), { n: String(cleanCount) })}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t("dc_stat_last")}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{formatLastClean(lastClean, t)}</p>
        </div>
      </div>

      {/* 히스토리 패널 */}
      {typeof document !== "undefined" && createPortal(
      <div className={`fixed inset-0 z-50 ${showHistory ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-in-out ${showHistory ? "opacity-100" : "opacity-0"}`}
          onClick={() => setShowHistory(false)}
        />
        <div
          className={`absolute right-0 top-0 h-full bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-lg flex flex-col transition-all duration-300 ease-in-out ${
            showHistory ? "w-80 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-full overflow-hidden"
          }`}
        >
          <div className="border-b border-slate-200 dark:border-zinc-800 shrink-0">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("dc_history_title")}</h3>
              <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 px-4 pb-3">{t("dc_history_hint")}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {history.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400 text-center py-8">{t("dc_history_empty")}</p>
            ) : (
              history.map(h => (
                <div key={h.id} className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 transition group">
                  <button onClick={() => loadHistoryEntry(h)} className="flex-1 min-w-0 text-left">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-1">
                      {new Date(h.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-zinc-200 truncate">{h.inputText.slice(0, 60)}</p>
                  </button>
                  <button onClick={() => removeHistoryEntry(h.id)}
                    className="opacity-0 group-hover:opacity-100 transition shrink-0 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400">
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>,
      document.body
      )}

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
            {t("dc_input_label")}
          </label>
          <button onClick={openHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
            <IconHistory className="w-3.5 h-3.5" />{t("dc_history_btn")}
          </button>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={locale === "en"
            ? "Name Age Department\nJohn 28 Development\nJane 32 Marketing\nAlex 25 Design\n\nPaste CSV content or table-format text here."
            : "이름 나이 부서\n홍길동 28 개발팀\n김철수 32 마케팅\n이영희 25 디자인\n\nCSV 내용이나 표 형식 텍스트를 붙여넣으세요."}
          rows={6}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />

        <div className="flex justify-end mt-3">
          <button
            onClick={handleClean}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            {loading ? (
              <>
                <IconLoader2 className="w-4 h-4 animate-spin text-white" />
                {chunkProgress && chunkProgress.total > 1
                  ? tFormat(t("dc_loading_progress"), { done: String(chunkProgress.done), total: String(chunkProgress.total) })
                  : t("dc_loading")}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                </svg>
                {t("dc_run_btn")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div role="alert" className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* 결과 */}
      {tableHtml ? (
        <div ref={resultRef} className="animate-result-in bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{t("dc_result_title")}</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? t("copied") : t("dc_html_copy")}
              </button>
              <button onClick={handleDownloadCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition"
                style={{ background: "var(--primary)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t("dc_csv_download")}
              </button>
            </div>
          </div>
          <div
            className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 [&_table]:w-full [&_table]:text-sm [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-white [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-slate-700 dark:[&_td]:text-zinc-300 [&_tr:nth-child(even)_td]:bg-slate-50 dark:[&_tr:nth-child(even)_td]:bg-zinc-800/50"
          >
            <style>{`
              table { border-collapse: collapse; }
              th { background: #6C63FF; }
              td { border-bottom: 1px solid #e2e8f0; }
              @media (prefers-color-scheme: dark) {
                td { border-bottom: 1px solid #3f3f46; }
              }
            `}</style>
            <div dangerouslySetInnerHTML={{ __html: tableHtml }} />
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
          <IconSparkles className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">{t("dc_empty")}</p>
        </div>
      )}
      <HelpButton
        title={t("help_dc_title")}
        steps={[
          { step: t("help_dc_1_step"), desc: t("help_dc_1_desc") },
          { step: t("help_dc_2_step"), desc: t("help_dc_2_desc") },
          { step: t("help_dc_3_step"), desc: t("help_dc_3_desc") },
        ]}
      />
    </div>
  );
}
