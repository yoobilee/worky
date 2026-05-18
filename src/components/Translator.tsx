"use client";

import { useState } from "react";
import {
  IconWorld,
  IconPencil,
  IconArrowsRightLeft,
  IconCopy,
  IconCheck,
  IconSparkles,
} from "@tabler/icons-react";

/* ───────── 타입 ───────── */

type Mode     = "translate" | "refine";
type LangCode = "ko" | "en" | "ja" | "zh";
type Tone     = "공식적으로" | "부드럽게" | "간결하게" | "정중하게";

/* ───────── 상수 ───────── */

const LANG_OPTIONS: { code: LangCode; label: string; native: string }[] = [
  { code: "ko", label: "한국어", native: "Korean" },
  { code: "en", label: "영어",   native: "English" },
  { code: "ja", label: "일본어", native: "Japanese" },
  { code: "zh", label: "중국어", native: "Chinese (Simplified)" },
];

const TONES: { id: Tone; desc: string }[] = [
  { id: "공식적으로", desc: "격식 있는 비즈니스 문체" },
  { id: "부드럽게",   desc: "친근하고 따뜻한 어조"   },
  { id: "간결하게",   desc: "핵심만 압축한 짧은 문체" },
  { id: "정중하게",   desc: "예의 바른 공손한 어조"   },
];

/* ───────── 시스템 프롬프트 ───────── */

function buildTranslatePrompt(targetLang: LangCode): string {
  const native = LANG_OPTIONS.find((l) => l.code === targetLang)?.native ?? "Korean";
  return `You are a professional translator. Detect the language of the input text and translate it into ${native}.
Return only the translated text with no explanations, labels, or additional content.
Preserve the original tone, formatting, and paragraph structure as much as possible.`;
}

function buildRefinePrompt(tone: Tone): string {
  const instructions: Record<Tone, string> = {
    공식적으로: "Rewrite the following Korean text in a formal, professional business style. Keep the meaning intact.",
    부드럽게:   "Rewrite the following Korean text in a warm, friendly, and approachable tone while keeping it professional.",
    간결하게:   "Rewrite the following Korean text in a concise and direct style. Remove unnecessary words and get to the point.",
    정중하게:   "Rewrite the following Korean text in a polite and respectful tone suitable for business communication.",
  };
  return `You are a Korean business writing expert. ${instructions[tone]}
Return only the rewritten text with no explanations or labels.`;
}

/* ───────── 컴포넌트 ───────── */

export default function Translator() {
  const [mode, setMode]           = useState<Mode>("translate");
  const [input, setInput]         = useState("");
  const [targetLang, setTargetLang] = useState<LangCode>("en");
  const [tone, setTone]           = useState<Tone>("공식적으로");
  const [result, setResult]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [copied, setCopied]       = useState(false);

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setResult("");
    setError("");
  };

  const handleRun = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResult("");

    try {
      const systemPrompt =
        mode === "translate"
          ? buildTranslatePrompt(targetLang)
          : buildRefinePrompt(tone);

      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: input }],
          systemPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── 모드 탭 설정 ── */
  const MODES: { id: Mode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "translate", label: "번역",         Icon: IconWorld  },
    { id: "refine",    label: "톤 다듬기",    Icon: IconPencil },
  ];

  return (
    <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full flex-1 min-h-0">

      {/* 모드 전환 탭 */}
      <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-1.5 shadow-sm grid grid-cols-2 gap-1">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => handleModeChange(id)}
            className={[
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors",
              mode === id
                ? "bg-[#6C63FF] text-white shadow-sm"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── 번역 모드 ── */}
      {mode === "translate" && (
        <>
          {/* 대상 언어 선택 */}
          <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">번역 대상 언어</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LANG_OPTIONS.map(({ code, label }) => {
                const isActive = targetLang === code;
                return (
                  <button
                    key={code}
                    onClick={() => setTargetLang(code)}
                    className={[
                      "py-2.5 px-3 rounded-xl border text-sm font-medium transition-all",
                      isActive
                        ? "text-white border-transparent shadow-sm"
                        : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-[#6C63FF]/40 hover:bg-slate-50 dark:hover:bg-zinc-800",
                    ].join(" ")}
                    style={isActive ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 입력 */}
          <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col flex-1 min-h-0">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2 shrink-0">
              번역할 텍스트
              <span className="ml-2 text-xs font-normal text-slate-400 dark:text-zinc-500">언어 자동 감지</span>
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="번역할 내용을 입력하세요..."
              className="w-full flex-1 min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
                <IconArrowsRightLeft className="w-3.5 h-3.5" />
                <span>→ {LANG_OPTIONS.find((l) => l.code === targetLang)?.label}</span>
              </div>
              <button
                onClick={handleRun}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />번역 중...</>
                ) : (
                  <><IconWorld className="w-4 h-4" />번역하기</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 톤 다듬기 모드 ── */}
      {mode === "refine" && (
        <>
          {/* 톤 선택 */}
          <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">다듬을 톤 선택</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONES.map(({ id, desc }) => {
                const isActive = tone === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTone(id)}
                    className={[
                      "flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-sm font-medium transition-all",
                      isActive
                        ? "text-white border-transparent shadow-sm"
                        : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-[#6C63FF]/40 hover:bg-slate-50 dark:hover:bg-zinc-800",
                    ].join(" ")}
                    style={isActive ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
                  >
                    <span>{id}</span>
                    <span className={`text-[11px] ${isActive ? "text-white/70" : "text-slate-400 dark:text-zinc-500"}`}>
                      {desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 입력 */}
          <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col flex-1 min-h-0">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2 shrink-0">
              다듬을 텍스트
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="비즈니스 톤으로 다듬을 텍스트를 입력하세요..."
              className="w-full flex-1 min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleRun}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />다듬는 중...</>
                ) : (
                  <><IconSparkles className="w-4 h-4" />AI로 다듬기</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

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
        <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
              {mode === "translate"
                ? `번역 결과 — ${LANG_OPTIONS.find((l) => l.code === targetLang)?.label}`
                : `다듬기 결과 — ${tone}`}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              {copied ? (
                <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</>
              ) : (
                <><IconCopy className="w-3.5 h-3.5" />복사</>
              )}
            </button>
          </div>
          <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed min-h-[120px]">
            {result}
          </div>
        </div>
      )}
    </div>
  );
}
