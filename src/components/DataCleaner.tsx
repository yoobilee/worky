"use client";

import { useState, useRef } from "react";

const SYSTEM_PROMPT = `당신은 데이터 정리 전문가입니다. 사용자가 붙여넣은 지저분한 텍스트나 데이터를 분석하여 깔끔한 HTML 표로 변환하세요.
반드시 <table> 태그로 시작하고 </table> 태그로 끝나는 HTML만 반환하세요.
마크다운 코드블록, 설명 텍스트는 절대 포함하지 마세요.
thead > tr > th 로 헤더를, tbody > tr > td 로 데이터를 구성하세요.`;

function extractTableHtml(raw: string): string {
  const match = raw.match(/<table[\s\S]*<\/table>/i);
  return match ? match[0] : raw;
}

function tableHtmlToCSV(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const rows = doc.querySelectorAll("tr");
  return Array.from(rows)
    .map((row) =>
      Array.from(row.querySelectorAll("th, td"))
        .map((cell) => `"${(cell.textContent ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

export default function DataCleaner() {
  const [input, setInput] = useState("");
  const [tableHtml, setTableHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleClean = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setTableHtml("");

    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: input }],
          systemPrompt: SYSTEM_PROMPT,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setTableHtml(extractTableHtml(data.result));
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 정리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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
    const csv = tableHtmlToCSV(tableHtml);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "worky_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 max-w-4xl mx-auto w-full">
      {/* Bento 통계 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">이번 달 처리</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">24건</p>
          <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-700">
            <div className="h-1.5 rounded-full" style={{ width: "80%", background: "#6C63FF" }} />
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">목표 30건의 80%</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">절약 시간</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">3.2h</p>
          <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-700">
            <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: "64%" }} />
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">이번 달 누적</p>
        </div>
      </div>

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          원본 데이터 입력
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"이름 나이 부서\n홍길동 28 개발팀\n김철수 32 마케팅\n이영희 25 디자인"}
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
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                정리 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                </svg>
                AI로 정리하기
              </>
            )}
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* 결과 */}
      {tableHtml && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">정리된 표</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? "복사됨!" : "HTML 복사"}
              </button>
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition"
                style={{ background: "var(--primary)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV 다운로드
              </button>
            </div>
          </div>

          {/* 테이블 렌더링 */}
          <div
            ref={resultRef}
            className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 [&_table]:w-full [&_table]:text-sm [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-white [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-slate-700 dark:[&_td]:text-zinc-300 [&_tr:nth-child(even)_td]:bg-slate-50 dark:[&_tr:nth-child(even)_td]:bg-zinc-800/50"
            style={{
              // th 배경
            }}
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
      )}
    </div>
  );
}
