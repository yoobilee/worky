"use client";


import HelpButton from "./HelpButton";
import { useState, useRef, useEffect } from "react";
import { trackUsage } from "@/lib/usageStats";
import EditableResult from "./EditableResult";
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
  IconAlignLeft,
  IconFileUpload,
  IconFileAnalytics,
} from "@tabler/icons-react";

type InputMode = "text" | "file";

async function parseFileToText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "csv" || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (res) => {
          const rows = res.data as string[][];
          resolve(rows.map((r) => r.join("\t")).join("\n"));
        },
        error: reject,
        skipEmptyLines: true,
      });
    });
  }
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: "array" });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(ws);
  }
  throw new Error("지원하지 않는 파일 형식입니다. CSV 또는 Excel 파일을 업로드하세요.");
}

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

const REPORT_SYSTEM_PROMPT = `당신은 데이터 분석 보고서 작성 전문가입니다.
제공된 데이터 분석 결과(핵심 수치, 트렌드, 이상치, 인사이트)를 바탕으로 실무에서 바로 사용할 수 있는 성과 보고서를 작성해주세요.

보고서 형식 (순서대로 작성):
1. 제목
2. 분석 기간 (데이터에 명확한 날짜·연도 정보가 있을 때만 표기. 없으면 반드시 "입력된 데이터 기준"으로만 표시하고 임의 연도 추정 절대 금지)
3. 핵심 성과 (주요 수치 3~5개, 각 항목 앞에 * 붙여 목록 형식으로)
4. 트렌드 분석 (2~3문장)
5. 개선 제안 (2~3가지 실천 가능한 제안, 각 항목 앞에 * 붙여 목록 형식으로)

규칙:
- 한국어로 작성
- 비즈니스 문서 톤 (격식체)
- 각 섹션 제목은 ## 섹션명 형식으로 표기
- 간결하고 실용적으로 작성
- 데이터에 없는 날짜·연도를 절대 추정하거나 임의로 작성하지 마세요`;

export default function DataInsight() {
  const [inputMode, setInputMode]   = useState<InputMode>("text");
  const [input, setInput]           = useState("");
  const [file, setFile]             = useState<File | null>(null);
  const [fileText, setFileText]     = useState("");
  const [extracting, setExtracting] = useState(false);
  const [result, setResult]         = useState<InsightResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [copied, setCopied]         = useState(false);
  const [report, setReport]         = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError]     = useState("");
  const [reportCopied, setReportCopied]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const sourceText = inputMode === "text" ? input : fileText;

  const handleModeChange = (mode: InputMode) => {
    setInputMode(mode);
    setError("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFileText("");
    setError("");
    setExtracting(true);
    try {
      const text = await parseFileToText(f);
      if (!text.trim()) throw new Error("파일에서 데이터를 추출할 수 없습니다.");
      setFileText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일 처리 중 오류가 발생했습니다.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setExtracting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!sourceText.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setReport("");
    setReportError("");

    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: sourceText }],
          systemPrompt: SYSTEM_PROMPT,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setResult(parseResult(data.result));
      trackUsage("insight");
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!result) return;
    setReportLoading(true);
    setReportError("");
    setReport("");
    const summary = [
      `[핵심 수치]`,
      `최대: ${result.keyStats.max.value} — ${result.keyStats.max.context}`,
      `최소: ${result.keyStats.min.value} — ${result.keyStats.min.context}`,
      `평균: ${result.keyStats.avg.value} — ${result.keyStats.avg.context}`,
      `합계: ${result.keyStats.total.value} — ${result.keyStats.total.context}`,
      ``,
      `[트렌드] ${result.trend}`,
      ``,
      `[이상치] ${result.outliers}`,
      ``,
      `[핵심 인사이트] ${result.insight}`,
    ].join("\n");
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: summary }],
          systemPrompt: REPORT_SYSTEM_PROMPT,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setReport(data.result);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "보고서 생성 중 오류가 발생했습니다.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleReportCopy = async () => {
    await navigator.clipboard.writeText(report);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
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
    <div className="flex flex-col gap-3 max-w-5xl mx-auto w-full flex-1 min-h-0">

      {/* 입력 탭 */}
      <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-1.5 shadow-sm grid grid-cols-2 gap-1 shrink-0">
        {([
          { id: "text" as InputMode, label: "텍스트 입력", Icon: IconAlignLeft },
          { id: "file" as InputMode, label: "파일 업로드", Icon: IconFileUpload },
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => handleModeChange(id)}
            className={[
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors",
              inputMode === id
                ? "bg-[#6C63FF] text-white shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm shrink-0">
        {inputMode === "text" ? (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              숫자 데이터 입력
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"월별 매출 (단위: 만원)\n1월: 1,200 / 2월: 1,450 / 3월: 980\n4월: 1,700 / 5월: 2,100 / 6월: 1,890\n\nCSV, 표, 자유형식 모두 가능합니다."}
              className="w-full h-40 min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleAnalyze}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {loading ? (
                  <><IconLoader2 className="w-4 h-4 animate-spin text-white" />분석 중...</>
                ) : (
                  <><IconChartBar className="w-4 h-4" />AI로 분석하기</>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              CSV 또는 Excel 파일 업로드
            </label>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
              className={[
                "w-full flex flex-col items-center justify-center gap-3 min-h-[160px] rounded-xl border-2 border-dashed transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                file
                  ? "border-[#6C63FF]/50 bg-[#6C63FF]/5 hover:border-[#6C63FF]/70"
                  : "border-slate-300 dark:border-zinc-600 hover:border-[#6C63FF]/60 hover:bg-[#6C63FF]/5",
              ].join(" ")}
            >
              <IconFileUpload className={`w-8 h-8 ${file ? "text-[#6C63FF]" : "text-slate-400 dark:text-zinc-500"}`} />
              <div className="text-center px-4">
                <p className={`text-sm font-medium ${file ? "text-[#6C63FF]" : "text-slate-600 dark:text-zinc-400"}`}>
                  {file ? file.name : "클릭해서 파일 선택"}
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                  {file ? "클릭해서 파일 교체" : "CSV, Excel(.xlsx, .xls) 지원"}
                </p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
            />
            {extracting && (
              <div className="flex items-center gap-2 mt-3 text-sm text-slate-500 dark:text-zinc-400">
                <IconLoader2 className="w-4 h-4 animate-spin text-[#6C63FF] shrink-0" />
                데이터 추출 중...
              </div>
            )}
            {fileText && !extracting && (
              <div className="mt-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5">추출된 데이터 미리보기</p>
                <div className="max-h-[80px] overflow-hidden">
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">{fileText}</p>
                </div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">
                  총 {fileText.split("\n").length.toLocaleString()}행 추출됨
                </p>
              </div>
            )}
            <div className="flex justify-end mt-3">
              <button
                onClick={handleAnalyze}
                disabled={loading || !fileText.trim() || extracting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {loading ? (
                  <><IconLoader2 className="w-4 h-4 animate-spin text-white" />분석 중...</>
                ) : (
                  <><IconChartBar className="w-4 h-4" />AI로 분석하기</>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <IconAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* 결과 */}
      {result ? (
        <div ref={resultRef} className="space-y-3">

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

          {/* 보고서로 생성 버튼 */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
            >
              {reportLoading ? (
                <><IconLoader2 className="w-4 h-4 animate-spin text-white" />생성 중...</>
              ) : (
                <><IconFileAnalytics className="w-4 h-4" />보고서로 생성</>
              )}
            </button>
          </div>

          {/* 보고서 에러 */}
          {reportError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <IconAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {reportError}
            </div>
          )}

          {/* 생성된 보고서 */}
          {report && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-[#6C63FF]/30 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF]">
                    <IconFileAnalytics className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">생성된 성과 보고서</p>
                </div>
                <button
                  onClick={handleReportCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                >
                  {reportCopied
                    ? <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</>
                    : <><IconCopy className="w-3.5 h-3.5" />복사</>}
                </button>
              </div>
              <EditableResult value={report} onChange={setReport} rows={16}>
                <div className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed space-y-1.5">
                {report.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return (
                    <p key={i} className="font-bold text-slate-800 dark:text-zinc-100 mt-3 first:mt-0">{line.slice(3)}</p>
                  );
                  if (line.startsWith("* ") || line.startsWith("- ")) return (
                    <p key={i} className="flex gap-1.5"><span className="text-[#6C63FF] shrink-0">•</span><span>{line.slice(2)}</span></p>
                  );
                  if (!line.trim()) return <div key={i} className="h-1" />;
                  return <p key={i}>{line}</p>;
                })}
                </div>
              </EditableResult>
            </div>
          )}

        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
          <IconChartBar className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm text-slate-400 dark:text-zinc-500">데이터를 입력하고 분석하면 인사이트가 여기에 표시됩니다.</p>
        </div>
      )}
      <HelpButton
        title="데이터 분석 사용법"
        steps={[
          { step: "데이터 입력", desc: "숫자 데이터를 텍스트로 입력하거나 파일을 업로드하세요." },
          { step: "AI 분석", desc: "핵심 수치·트렌드·이상치를 자동으로 분석합니다." },
          { step: "보고서 생성", desc: "'보고서로 생성' 버튼으로 실무용 보고서를 작성합니다." },
          { step: "편집", desc: "결과 텍스트를 클릭하면 직접 수정할 수 있습니다." },
        ]}
      />
    </div>
  );
}
