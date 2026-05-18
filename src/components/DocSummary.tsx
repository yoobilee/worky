"use client";

import { useState, useRef } from "react";
import { trackUsage } from "@/lib/usageStats";
import {
  IconAlignLeft,
  IconFileUpload,
  IconListDetails,
  IconList,
  IconMinus,
  IconCopy,
  IconCheck,
  IconSparkles,
} from "@tabler/icons-react";

type InputMode = "text" | "file";
type SummaryStyle = "핵심 요약" | "요점 정리" | "한 줄 요약";

const SUMMARY_STYLES: {
  id: SummaryStyle;
  Icon: React.ComponentType<{ className?: string }>;
  desc: string;
}[] = [
  { id: "핵심 요약",    Icon: IconListDetails, desc: "주요 내용 정리" },
  { id: "요점 정리", Icon: IconList,        desc: "항목별 요약" },
  { id: "한 줄 요약",   Icon: IconMinus,       desc: "한 문장으로 압축" },
];

function buildSystemPrompt(style: SummaryStyle): string {
  if (style === "핵심 요약") {
    return `당신은 문서 요약 전문가입니다. 제공된 텍스트의 핵심 내용을 3~5개의 핵심 포인트로 정리하세요.
각 포인트는 명확하고 간결하게 작성하고, 전체 내용을 파악할 수 있도록 구성하세요. 한국어로 작성하세요.`;
  }
  if (style === "요점 정리") {
    return `당신은 문서 요약 전문가입니다. 제공된 텍스트를 요점 정리 형식으로 요약하세요.
각 항목은 "• " 기호로 시작하세요. 중요한 정보를 빠짐없이 포함하되 간결하게 작성하세요.
계층 구조가 필요하면 들여쓰기를 사용하세요. 한국어로 작성하세요.`;
  }
  return `당신은 문서 요약 전문가입니다. 제공된 텍스트의 핵심을 단 한 문장(50자 내외)으로 요약하세요.
가장 중요한 정보만 포함하고, 명확하고 완결된 문장으로 작성하세요. 한국어로 작성하세요.`;
}

/* ───────── 마크다운 간이 렌더러 ───────── */

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let k = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={k++} className="list-disc pl-5 space-y-0.5 my-1">
        {listItems.map((item, i) => (
          <li key={i} className="text-sm text-slate-800 dark:text-zinc-100 leading-relaxed">{item}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("## ")) {
      flushList();
      nodes.push(<p key={k++} className="text-[15px] font-bold text-slate-900 dark:text-zinc-50 mt-3 mb-1">{t.slice(3)}</p>);
    } else if (t.startsWith("### ")) {
      flushList();
      nodes.push(<p key={k++} className="text-sm font-bold text-slate-800 dark:text-zinc-100 mt-2 mb-0.5">{t.slice(4)}</p>);
    } else if (/^[-•*] /.test(t)) {
      listItems.push(t.slice(2));
    } else if (t === "") {
      flushList();
      nodes.push(<div key={k++} className="h-1.5" />);
    } else {
      flushList();
      nodes.push(<p key={k++} className="text-sm text-slate-800 dark:text-zinc-100 leading-relaxed">{t}</p>);
    }
  }
  flushList();
  return <div className="space-y-0.5">{nodes}</div>;
}

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n").replace(/\s{3,}/g, "  ").trim();
}

export default function DocSummary() {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [textInput, setTextInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>("핵심 요약");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModeChange = (mode: InputMode) => {
    setInputMode(mode);
    setError("");
    setResult("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setExtractedText("");
    setError("");
    setResult("");

    setExtracting(true);
    try {
      let text: string;
      if (f.type === "application/pdf") {
        text = await extractTextFromPDF(f);
      } else {
        text = await f.text();
      }
      if (!text.trim()) throw new Error("텍스트를 추출할 수 없습니다. 스캔 PDF는 지원되지 않습니다.");
      setExtractedText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일 처리 중 오류가 발생했습니다.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setExtracting(false);
    }
  };

  const sourceText = inputMode === "text" ? textInput : extractedText;

  const handleSummarize = async () => {
    if (!sourceText.trim()) return;
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: sourceText.slice(0, 12000) }],
          systemPrompt: buildSystemPrompt(summaryStyle),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setResult(data.result);
      trackUsage("summary");
    } catch (e) {
      setError(e instanceof Error ? e.message : "요약 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputModes: { id: InputMode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "text", label: "텍스트 붙여넣기", Icon: IconAlignLeft },
    { id: "file", label: "파일 업로드",     Icon: IconFileUpload },
  ];

  return (
    <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full flex-1 min-h-0">
      {/* 모드 탭 — Translator와 동일 스타일 */}
      <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-1.5 shadow-sm grid grid-cols-2 gap-1 shrink-0">
        {inputModes.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => handleModeChange(id)}
            className={[
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors",
              inputMode === id
                ? "bg-[#6C63FF] text-white shadow-sm"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col shrink-0">
        {inputMode === "text" ? (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2 shrink-0">
              요약할 텍스트 입력
            </label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="요약할 내용을 붙여넣으세요..."
              className="w-full h-48 min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
            {textInput && (
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5 text-right">
                {textInput.length.toLocaleString()}자
              </p>
            )}
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2 shrink-0">
              PDF 또는 텍스트 파일 업로드
            </label>

            {/* 드래그 영역 — 파일 유무와 관계없이 항상 표시 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
              className={[
                "w-full flex flex-col items-center justify-center gap-3 min-h-[180px] rounded-xl border-2 border-dashed transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                file
                  ? "border-[#6C63FF]/50 bg-[#6C63FF]/5 hover:border-[#6C63FF]/70 hover:bg-[#6C63FF]/8"
                  : "border-slate-300 dark:border-zinc-600 hover:border-[#6C63FF]/60 hover:bg-[#6C63FF]/5",
              ].join(" ")}
            >
              <IconFileUpload className={`w-8 h-8 ${file ? "text-[#6C63FF]" : "text-slate-400 dark:text-zinc-500"}`} />
              <div className="text-center px-4">
                <p className={`text-sm font-medium ${file ? "text-[#6C63FF]" : "text-slate-600 dark:text-zinc-400"}`}>
                  {file ? file.name : "클릭해서 파일 선택"}
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                  {file ? "클릭해서 파일 교체" : "PDF, TXT 지원"}
                </p>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* 추출 중 */}
            {extracting && (
              <div className="flex items-center gap-2 mt-3 text-sm text-slate-500 dark:text-zinc-400">
                <span className="w-4 h-4 border-2 border-slate-300 border-t-[#6C63FF] rounded-full animate-spin shrink-0" />
                텍스트 추출 중...
              </div>
            )}

            {/* 추출된 텍스트 미리보기 */}
            {extractedText && !extracting && (
              <div className="mt-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5">추출된 텍스트 미리보기</p>
                <div className="max-h-[80px] overflow-hidden">
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {extractedText}
                  </p>
                </div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">
                  총 {extractedText.length.toLocaleString()}자 추출됨
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 요약 방식 선택 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">요약 방식</p>
        <div className="grid grid-cols-3 gap-2">
          {SUMMARY_STYLES.map(({ id, Icon, desc }) => {
            const isActive = summaryStyle === id;
            return (
              <button
                key={id}
                onClick={() => setSummaryStyle(id)}
                className={[
                  "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-all",
                  isActive
                    ? "text-white border-transparent shadow-md"
                    : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-[#6C63FF]/40 hover:bg-slate-50 dark:hover:bg-zinc-800",
                ].join(" ")}
                style={isActive ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
              >
                <Icon className="w-5 h-5" />
                <span>{id}</span>
                <span className={`text-xs ${isActive ? "text-white/70" : "text-slate-400 dark:text-zinc-500"}`}>
                  {desc}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSummarize}
            disabled={loading || !sourceText.trim() || extracting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                요약 중...
              </>
            ) : (
              <>
                <IconSparkles className="w-4 h-4" />
                AI로 요약하기
              </>
            )}
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
              요약 결과 — {summaryStyle}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              {copied ? (
                <>
                  <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                  복사됨!
                </>
              ) : (
                <>
                  <IconCopy className="w-3.5 h-3.5" />
                  복사
                </>
              )}
            </button>
          </div>
          <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
            {renderMarkdown(result)}
          </div>
        </div>
      )}
    </div>
  );
}
