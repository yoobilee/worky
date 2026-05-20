"use client";

import { useState, useEffect } from "react";
import {
  IconSend, IconCopy, IconCheck, IconChevronDown,
} from "@tabler/icons-react";
import { trackUsage } from "@/lib/usageStats";

type ToneId = "formal" | "friendly" | "concise";

/* ── 상수 ── */
const TONES: { id: ToneId; label: string; desc: string }[] = [
  { id: "formal",   label: "정중하게", desc: "격식 있고 공손한 어투" },
  { id: "friendly", label: "친근하게", desc: "따뜻하고 편안한 어투" },
  { id: "concise",  label: "간결하게", desc: "핵심만 짧게 전달" },
];

const TONE_GUIDE: Record<ToneId, string> = {
  formal: `격식체로 작성하세요.
- "~드립니다", "~드렸습니다", "~해 드렸습니다", "~확인했습니다" 등 정중한 종결어미를 사용하세요.
- 문장 끝을 "~습니다"로만 반복하지 말고 "~드립니다", "~드렸습니다", "~말씀드립니다" 등 다양하게 사용하세요.
- 3~5문장으로 구성하세요.`,

  friendly: `구어체에 가까운 따뜻한 어투로 작성하세요.
- "~했어요", "~됐어요", "~드렸어요", "~확인했어요" 등 부드러운 종결어미를 사용하세요.
- 실제 카톡 보고 메시지처럼 자연스럽고 가볍게 작성하세요.
- 지나치게 딱딱하거나 사무적이지 않게, 사람 냄새 나게 쓰세요.
- 2~4문장으로 구성하세요.`,

  concise: `핵심만 1~2문장으로 매우 짧게 전달하세요.
- 주어·설명 없이 완료된 사실만 나열하세요.
- 군더더기 표현 없이 최대한 압축하세요.
- "~완료", "~처리", "~전달" 등 단호한 종결 표현을 사용하세요.`,
};

/* ── 헬퍼 ── */
function buildSystemPrompt(tone: ToneId, clientTone: string, customSample?: string): string {
  let prompt: string;

  if (customSample?.trim()) {
    prompt = `당신은 실무 경험이 풍부한 한국 비즈니스 보고 메시지 작성 전문가입니다.
완료한 업무 내용을 바탕으로 보고 메시지를 작성하세요.

[말투 샘플 — 아래 문체를 최대한 그대로 따라 작성하세요]
"${customSample.trim()}"

위 샘플에서 사용된 어투, 종결어미, 문장 길이, 표현 방식을 분석하여 동일한 스타일로 작성하세요.`;
  } else {
    prompt = `당신은 실무 경험이 풍부한 한국 비즈니스 보고 메시지 작성 전문가입니다.
완료한 업무 내용을 바탕으로 실제로 쓰이는 자연스러운 보고 메시지를 작성하세요.

[톤 지침]
${TONE_GUIDE[tone]}`;
  }

  if (clientTone.trim()) {
    prompt += `\n\n[거래처 선호사항]\n${clientTone.trim()}`;
  }

  prompt += `

[공통 규칙]
- 인사말("안녕하세요" 등)·맺음말("감사합니다" 등) 없이 보고 내용만 작성
- 마크다운(**, ## 등) 사용 금지
- 반드시 한국어로만 작성${customSample?.trim() ? "" : "\n- 같은 종결어미 반복 금지 — 문장마다 다른 표현 사용"}`;

  return prompt;
}

/* ── 컴포넌트 ── */
export default function ReportMessage() {
  const [workInput,        setWorkInput]        = useState("");
  const [tone,             setTone]             = useState<ToneId>("formal");
  const [result,           setResult]           = useState("");
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState("");
  const [copied,           setCopied]           = useState(false);
  const [hydrated,         setHydrated]         = useState(false);
  const [customToneSample, setCustomToneSample] = useState("");
  const [useCustomTone,    setUseCustomTone]    = useState(false);
  const [sampleOpen,       setSampleOpen]       = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("worky_report_tone_sample");
      if (saved) setCustomToneSample(saved);
    } catch {}
    setHydrated(true);
  }, []);

  const handleCustomToneChange = (v: string) => {
    setCustomToneSample(v);
    localStorage.setItem("worky_report_tone_sample", v);
    if (!v.trim()) setUseCustomTone(false);
  };

  const handleGenerate = async () => {
    if (!workInput.trim()) return;
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: workInput.trim() }],
          systemPrompt: buildSystemPrompt(tone, "", useCustomTone ? customToneSample : undefined),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setResult(data.result);
      trackUsage("report");
    } catch (e) {
      setError(e instanceof Error ? e.message : "메시지 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!hydrated) return null;

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full self-start">

      {/* 작업 내용 입력 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          완료한 작업 내용
        </label>
        <textarea
          value={workInput}
          onChange={(e) => setWorkInput(e.target.value)}
          rows={4}
          placeholder={"오늘 완료한 작업을 자유롭게 입력하세요.\n예: A사 견적서 발송 완료, B사 미팅 일정 조율, 계약서 검토 후 수정안 전달"}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
      </div>

      {/* 내 말투 샘플 카드 — 접기/펼치기 */}
      <div className="rounded-2xl border border-[#6C63FF]/40 shadow-sm overflow-hidden bg-[#6C63FF]/[0.04] dark:bg-[#6C63FF]/[0.08]">
        {/* 헤더 토글 버튼 */}
        <button
          type="button"
          onClick={() => setSampleOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">내 말투 샘플</span>
            <span className={[
              "text-[10px] font-semibold px-2 py-0.5 rounded-full",
              customToneSample.trim()
                ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500",
            ].join(" ")}>
              {customToneSample.trim() ? "설정됨" : "미설정"}
            </span>
          </div>
          <IconChevronDown className={`w-4 h-4 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${sampleOpen ? "rotate-180" : ""}`} />
        </button>

        {/* 접기/펼치기 본문 */}
        <div
          style={{ maxHeight: sampleOpen ? "280px" : "0px", opacity: sampleOpen ? 1 : 0 }}
          className="overflow-hidden transition-all duration-300 ease-in-out"
        >
          <div className="px-5 pt-1 pb-5">
            <textarea
              value={customToneSample}
              onChange={(e) => handleCustomToneChange(e.target.value)}
              rows={3}
              placeholder={"안녕하세요 대표님, 오늘 업로드 완료됐고 노출 확인했습니다. 감사합니다!"}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
            {/* 사용자 설정 톤 사용 체크박스 */}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                disabled={!customToneSample.trim()}
                onClick={() => setUseCustomTone((v) => !v)}
                className={`flex items-center gap-2 ${!customToneSample.trim() ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className={[
                  "w-4 h-4 rounded flex items-center justify-center border-2 transition-all shrink-0",
                  useCustomTone ? "bg-[#6C63FF] border-[#6C63FF]" : "border-slate-300 dark:border-zinc-600",
                ].join(" ")}>
                  {useCustomTone && <IconCheck className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">사용자 설정 톤 사용</span>
              </button>
              {useCustomTone && (
                <p className="text-xs text-[#6C63FF]/70">위 샘플 스타일로 생성됩니다</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 톤 선택 — 커스텀 톤 사용 시 숨김 */}
      <div
        style={{ maxHeight: useCustomTone ? 0 : "300px", opacity: useCustomTone ? 0 : 1 }}
        className="overflow-hidden transition-all duration-300 ease-in-out"
      >
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">톤 선택</p>
          <div className="grid grid-cols-3 gap-3">
            {TONES.map((t) => {
              const active = tone === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={[
                    "flex flex-col gap-1.5 p-4 rounded-2xl border text-left transition-all",
                    active
                      ? "border-[#6C63FF] shadow-md"
                      : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#6C63FF]/40 hover:shadow-sm",
                  ].join(" ")}
                  style={active ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" } : undefined}
                >
                  <span className={`text-sm font-semibold ${active ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-300"}`}>
                    {t.label}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-zinc-400">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 생성 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={loading || !workInput.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              <IconSend className="w-4 h-4" />
              메시지 생성
            </>
          )}
        </button>
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
      {result && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">생성된 보고 메시지</h2>
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
          <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {result}
          </p>
        </div>
      )}
    </div>
  );
}
