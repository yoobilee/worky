"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import EditableResult from "./EditableResult";
import { trackUsage } from "@/lib/usageStats";
import {
  IconWorld,
  IconPencil,
  IconArrowRight,
  IconChevronDown,
  IconCopy,
  IconCheck,
  IconSparkles,
  IconLoader2,
} from "@tabler/icons-react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";
import type { TranslationKey } from "@/lib/i18n/translations";

/* ───────── 타입 ───────── */

type Mode       = "translate" | "refine";
type LangCode   = "ko" | "en" | "ja" | "zh";
type SourceLang = "auto" | LangCode;
type Tone       = "공식적으로" | "부드럽게" | "간결하게" | "정중하게";

/* ───────── 상수 ───────── */

const LANG_OPTIONS: { code: LangCode; labelKey: TranslationKey; native: string }[] = [
  { code: "ko", labelKey: "tr_ko", native: "Korean" },
  { code: "en", labelKey: "tr_en", native: "English" },
  { code: "ja", labelKey: "tr_ja", native: "Japanese" },
  { code: "zh", labelKey: "tr_zh", native: "Chinese (Simplified)" },
];

const SOURCE_OPTIONS: { code: SourceLang; labelKey: TranslationKey }[] = [
  { code: "auto", labelKey: "tr_auto" },
  { code: "ko",   labelKey: "tr_ko"   },
  { code: "en",   labelKey: "tr_en"   },
  { code: "ja",   labelKey: "tr_ja"   },
  { code: "zh",   labelKey: "tr_zh"   },
];

const TARGET_MAP: Record<SourceLang, { options: LangCode[]; default: LangCode }> = {
  auto: { options: ["ko", "en", "ja", "zh"], default: "ko" },
  ko:   { options: ["en", "ja", "zh"],       default: "en" },
  en:   { options: ["ko", "ja", "zh"],       default: "ko" },
  ja:   { options: ["ko", "en", "zh"],       default: "ko" },
  zh:   { options: ["ko", "en", "ja"],       default: "ko" },
};

const TONES: { id: Tone; labelKey: TranslationKey; descKey: TranslationKey }[] = [
  { id: "공식적으로", labelKey: "tr_tone_formal",  descKey: "tr_tone_formal_desc"  },
  { id: "부드럽게",   labelKey: "tr_tone_soft",    descKey: "tr_tone_soft_desc"    },
  { id: "간결하게",   labelKey: "tr_tone_concise", descKey: "tr_tone_concise_desc" },
  { id: "정중하게",   labelKey: "tr_tone_polite",  descKey: "tr_tone_polite_desc"  },
];

/* ───────── 시스템 프롬프트 ───────── */

const KO_RULE = `
You must respond ONLY in Korean (한국어). Do not use any Chinese characters (한자), Japanese, Russian, Greek, or any other language mixed in. Use pure, natural modern Korean only.
한국어 번역 규칙 (반드시 준수):
- 반드시 순수 한국어로만 번역
- 한자, 영어, 일본어, 러시아어 등 모든 외국어 혼용 절대 금지
- 고유명사나 브랜드명은 한국어 표기 사용
- 자연스러운 현대 한국어 비즈니스 문체 사용`;

function buildTranslatePrompt(sourceLang: SourceLang, targetLang: LangCode): string {
  const targetNative = LANG_OPTIONS.find((l) => l.code === targetLang)?.native ?? "Korean";
  const koRule = targetLang === "ko" ? KO_RULE : "";
  if (sourceLang === "auto") {
    return `You are a professional translator. Detect the language of the input text and translate it into ${targetNative}.
Return only the translated text with no explanations, labels, or additional content.
Preserve the original tone, formatting, and paragraph structure as much as possible.${koRule}`;
  }
  const sourceNative = LANG_OPTIONS.find((l) => l.code === sourceLang)?.native ?? "Korean";
  return `You are a professional translator. Translate the following ${sourceNative} text into ${targetNative}.
Return only the translated text with no explanations, labels, or additional content.
Preserve the original tone, formatting, and paragraph structure as much as possible.${koRule}`;
}

function buildRefinePrompt(tone: Tone): string {
  const instructions: Record<Tone, string> = {
    공식적으로: "Rewrite the following Korean text in a formal, professional business style. Keep the meaning intact.",
    부드럽게:   "Rewrite the following Korean text in a warm, friendly, and approachable tone while keeping it professional.",
    간결하게:   "Rewrite the following Korean text in a concise and direct style. Remove unnecessary words and get to the point.",
    정중하게:   "Rewrite the following Korean text in a polite and respectful tone suitable for business communication.",
  };
  return `You are a Korean business writing expert. ${instructions[tone]}
Return only the rewritten Korean text with no explanations or labels.
You must respond ONLY in Korean (한국어). Do not use any Chinese characters (한자), Japanese, Russian, or any other language. Use pure, natural modern Korean only.
반드시 순수 한국어로만 작성하고, 한자·영어·일본어·러시아어 등 모든 외국어 혼용 절대 금지. 자연스러운 현대 한국어 비즈니스 문체 사용.`;
}

/* ───────── 컴포넌트 ───────── */

export default function Translator() {
  const { t } = useLocale();
  const [mode, setMode]           = useState<Mode>("translate");
  const [input, setInput]         = useState("");
  const [sourceLang, setSourceLang] = useState<SourceLang>("auto");
  const [targetLang, setTargetLang] = useState<LangCode>("ko");
  const [tone, setTone]           = useState<Tone>("공식적으로");
  const [result, setResult]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [copied, setCopied]       = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setResult("");
    setError("");
  };

  const handleSourceChange = (src: SourceLang) => {
    setSourceLang(src);
    setTargetLang(TARGET_MAP[src].default);
    setResult("");
  };

  const handleRun = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResult("");

    try {
      const systemPrompt =
        mode === "translate"
          ? buildTranslatePrompt(sourceLang, targetLang)
          : buildRefinePrompt(tone);

      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: input }],
          systemPrompt,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? t("unknown_error"));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setResult("");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }
      trackUsage("translate");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("tr_error"));
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
  const MODES: { id: Mode; labelKey: TranslationKey; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "translate", labelKey: "tr_tab_translate", Icon: IconWorld  },
    { id: "refine",    labelKey: "tr_tab_polish",    Icon: IconPencil },
  ];

  return (
    <div className="flex flex-col gap-3 max-w-5xl mx-auto w-full flex-1 min-h-0 min-w-0">

      {/* 모드 전환 탭 */}
      <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-1.5 shadow-sm grid grid-cols-2 gap-1">
        {MODES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            onClick={() => handleModeChange(id)}
            data-active={mode === id}
            className={[
              "tab-underline w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2",
              mode === id
                ? "text-[#4D44CC] dark:text-[#8B85FF] border-[#6C63FF]"
                : "text-slate-500 dark:text-zinc-400 border-transparent hover:text-slate-700 dark:hover:text-zinc-200",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* ── 번역 모드 ── */}
      {mode === "translate" && (
        <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col shrink-0">

          {/* 언어 선택 줄 */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {SOURCE_OPTIONS.map(({ code, labelKey }) => {
              const isActive = sourceLang === code;
              return (
                <button
                  key={code}
                  onClick={() => handleSourceChange(code)}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    isActive
                      ? "bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF]"
                      : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  {t(labelKey)}
                </button>
              );
            })}

            <IconArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 shrink-0 mx-0.5" />

            {/* 도착 언어 드롭다운 (pill) */}
            <div className="relative">
              {/* 드롭다운 오버레이 (외부 클릭 닫기) */}
              {dropdownOpen && (
                <div className="fixed inset-0 z-[5]" onClick={() => setDropdownOpen(false)} />
              )}
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="relative z-10 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF] hover:bg-[#6C63FF]/15 transition-all"
              >
                {t(LANG_OPTIONS.find((l) => l.code === targetLang)!.labelKey)}
                <IconChevronDown
                  className={`w-3 h-3 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full mt-1 left-0 z-20 min-w-[140px] bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg overflow-hidden">
                  {TARGET_MAP[sourceLang].options.map((code) => {
                    const langOpt = LANG_OPTIONS.find((l) => l.code === code)!;
                    const isActive = targetLang === code;
                    return (
                      <button
                        key={code}
                        onClick={() => { setTargetLang(code); setDropdownOpen(false); }}
                        className={[
                          "w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors",
                          isActive
                            ? "font-semibold bg-[#6C63FF]/8 dark:bg-[#6C63FF]/10"
                            : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800",
                        ].join(" ")}
                        style={isActive ? { color: "#6C63FF" } : undefined}
                      >
                        <span className="w-3 shrink-0">
                          {isActive && <IconCheck className="w-3 h-3" />}
                        </span>
                        {t(langOpt.labelKey)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 입력 */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("tr_placeholder_translate")}
            className="w-full h-48 min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]/20 transition"
          />
          <div className="flex justify-end mt-3 shrink-0">
            <button
              onClick={handleRun}
              disabled={loading || !input.trim()}
              className="btn-press flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
            >
              {loading ? (
                <><IconLoader2 className="w-4 h-4 animate-spin text-white" />{t("tr_loading_translate")}</>
              ) : (
                <><IconWorld className="w-4 h-4" />{t("tr_run_translate")}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── 톤 다듬기 모드 ── */}
      {mode === "refine" && (
        <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col shrink-0">

          {/* 톤 선택 줄 */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {TONES.map(({ id, labelKey }) => {
              const isActive = tone === id;
              return (
                <button
                  key={id}
                  onClick={() => setTone(id)}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    isActive
                      ? "bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF]"
                      : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3">
            {t(TONES.find((tn) => tn.id === tone)!.descKey)}
          </p>

          {/* 입력 */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("tr_placeholder_polish")}
            className="w-full h-48 min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]/20 transition"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleRun}
              disabled={loading || !input.trim()}
              className="btn-press flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
            >
              {loading ? (
                <><IconLoader2 className="w-4 h-4 animate-spin text-white" />{t("tr_loading_polish")}</>
              ) : (
                <><IconSparkles className="w-4 h-4" />{t("tr_run_polish")}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div role="alert" className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* 결과 */}
      {result ? (
        <div ref={resultRef} className="animate-result-in min-w-0 w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300 truncate mr-3">
              {mode === "translate"
                ? tFormat(t("tr_result_translate"), { lang: t(LANG_OPTIONS.find((l) => l.code === targetLang)!.labelKey) })
                : tFormat(t("tr_result_polish"), { tone: t(TONES.find((tn) => tn.id === tone)!.labelKey) })}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition shrink-0"
            >
              {copied ? (
                <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />{t("copied")}</>
              ) : (
                <><IconCopy className="w-3.5 h-3.5" />{t("copy")}</>
              )}
            </button>
          </div>
          <EditableResult value={result} onChange={setResult} rows={8}>
            <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed min-h-[120px] break-words">
              {result}
            </div>
          </EditableResult>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
          <IconSparkles className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">{t("tr_empty")}</p>
        </div>
      )}
      <HelpButton
        title={t("help_tr_title")}
        steps={[
          { step: t("help_tr_1_step"), desc: t("help_tr_1_desc") },
          { step: t("help_tr_2_step"), desc: t("help_tr_2_desc") },
          { step: t("help_tr_3_step"), desc: t("help_tr_3_desc") },
          { step: t("help_tr_4_step"), desc: t("help_tr_4_desc") },
        ]}
      />
    </div>
  );
}
