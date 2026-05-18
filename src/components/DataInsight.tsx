"use client";

import { useState } from "react";
import {
  IconChartBar,
  IconArrowUpRight,
  IconArrowDownRight,
  IconSum,
  IconMath,
  IconTrendingUp,
  IconAlertCircle,
  IconBulb,
  IconLoader2,
  IconAlertTriangle,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";

const SYSTEM_PROMPT = `당신은 데이터 분석 전문가입니다. 사용자가 제공한 숫자 데이터를 분석하여 아래 JSON 형식으로만 응답하세요.
마크다운 코드블록, 설명 텍스트 없이 순수 JSON만 반환하세요.

{
  "keyStats": {
    "max": { "value": "최대값(단위 포함)", "context": "어떤 항목/시점인지 간단히" },
    "min": { "value": "최소값(단위 포함)", "context": "어떤 항목/시점인지 간단히" },
    "avg": { "value": "평균값(단위 포함)", "context": "평균에 대한 한 줄 설명" },
    "total": { "value": "합계(단위 포함)", "context": "합계에 대한 한 줄 설명" }
  },
  "trend": "증가/감소/패턴에 대한 2~3문장 분석",
  "outliers": "주목할 이상치나 특이값 설명 (없으면 '특이값 없음')",
  "insight": "전체 데이터에서 가장 중요한 한 줄 인사이트"
}`;

interface KeyStat {
  value: string;
  context: string;
}

interface InsightResult {
  keyStats: {
    max: KeyStat;
    min: KeyStat;
    avg: KeyStat;
    total: KeyStat;
  };
  trend: string;
  outliers: string;
  insight: string;
}

function parseResult(raw: string): InsightResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("응답을 파싱할 수 없습니다.");
  return JSON.parse(match[0]);
}

const statCards = (result: InsightResult) => [
  {
    icon: <IconArrowUpRight className="w-4 h-4" />,
    label: "최대값",
    stat: result.keyStats.max,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    icon: <IconArrowDownRight className="w-4 h-4" />,
    label: "최소값",
    stat: result.keyStats.min,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
  },
  {
    icon: <IconMath className="w-4 h-4" />,
    label: "평균",
    stat: result.keyStats.avg,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: <IconSum className="w-4 h-4" />,
    label: "합계",
    stat: result.keyStats.total,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
  },
];

export default function DataInsight() {
  const [input, setInput]   = useState("");
  const [result, setResult] = useState<InsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

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
      setResult(parseResult(data.result));
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const lines = [
      "[핵심 수치]",
      `최대: ${result.keyStats.max.value} — ${result.keyStats.max.context}`,
      `최소: ${result.keyStats.min.value} — ${result.keyStats.min.context}`,
      `평균: ${result.keyStats.avg.value} — ${result.keyStats.avg.context}`,
      `합계: ${result.keyStats.total.value} — ${result.keyStats.total.context}`,
      "",
      "[트렌드 분석]",
      result.trend,
      "",
      "[이상치]",
      result.outliers,
      "",
      "[핵심 인사이트]",
      result.insight,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full flex-1 min-h-0">

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col flex-1 min-h-0">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2 shrink-0">
          숫자 데이터 입력
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"월별 매출 (단위: 만원)\n1월: 1,200 / 2월: 1,450 / 3월: 980\n4월: 1,700 / 5월: 2,100 / 6월: 1,890\n\nCSV, 표, 자유형식 모두 가능합니다."}
          className="w-full flex-1 min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleAnalyze}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            {loading ? (
              <>
                <IconLoader2 className="w-4 h-4 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <IconChartBar className="w-4 h-4" />
                AI로 분석하기
              </>
            )}
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <IconAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="space-y-3">

          {/* 복사 버튼 */}
          <div className="flex justify-end">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              {copied
                ? <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                : <IconCopy className="w-3.5 h-3.5" />}
              {copied ? "복사됨!" : "전체 복사"}
            </button>
          </div>

          {/* 핵심 수치 4-grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statCards(result).map(({ icon, label, stat, color, bg }) => (
              <div
                key={label}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm"
              >
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-xl mb-2.5 ${bg} ${color}`}>
                  {icon}
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">{label}</p>
                <p className="text-lg font-bold text-slate-800 dark:text-zinc-100 mt-0.5 leading-tight">{stat.value}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 leading-snug">{stat.context}</p>
              </div>
            ))}
          </div>

          {/* 트렌드 + 이상치 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                  <IconTrendingUp className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">트렌드 분석</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{result.trend}</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                  <IconAlertCircle className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">이상치</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{result.outliers}</p>
            </div>
          </div>

          {/* 핵심 인사이트 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF]">
                <IconBulb className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">핵심 인사이트</p>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 leading-relaxed">
              {result.insight}
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
