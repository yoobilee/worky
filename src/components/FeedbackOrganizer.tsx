"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import {
  IconMessageCheck, IconAlertCircle, IconCircleCheck, IconBulb,
  IconLoader2, IconAlertTriangle, IconCopy, IconCheck,
} from "@tabler/icons-react";
import EditableResult from "./EditableResult";
import { trackUsage } from "@/lib/usageStats";

interface FeedbackResult {
  required: string[];
  optional: string[];
  clarified: { original: string; clarified: string }[];
}

const SYSTEM_PROMPT = `당신은 클라이언트 피드백 분석 전문가입니다.
입력된 피드백 텍스트를 분석하여 아래 JSON 형식으로만 응답하세요.
마크다운 코드블록, 설명 텍스트 없이 순수 JSON만 반환하세요.

{
  "required": [
    "반드시 수정해야 할 사항 (명확하고 구체적인 요청)"
  ],
  "optional": [
    "선택적으로 검토할 사항 (제안이나 모호한 요청)"
  ],
  "clarified": [
    {
      "original": "모호한 원문 피드백",
      "clarified": "구체적인 수정 방향으로 해석한 내용"
    }
  ]
}

분류 기준:
- required: 클라이언트가 명확하고 구체적으로 변경을 요청한 항목 (예: "로고 크기 줄여주세요", "배경색 흰색으로 바꿔주세요")
- optional: 재확인이 필요한 막연한 요청이나 선호 표현 (예: "전반적으로 좀 더 세련되게", "느낌이 달랐으면 해요")
- clarified: 추상적이거나 정량화하기 어려운 표현만 포함하여 실무적으로 해석 (예: "고급스럽게" → "불필요한 장식 제거 및 여백 확대, 모노크롬 계열 색상 검토")
  - 이미 구체적인 항목(required에 포함된 항목)은 clarified에 절대 포함하지 않음
  - required·optional과 clarified 간 중복 항목 없음
  - 추상적 표현이 없으면 빈 배열 반환
- 모든 값은 한국어로 작성`;

function parseResult(raw: string): FeedbackResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("응답을 파싱할 수 없습니다.");
  const parsed = JSON.parse(match[0]);
  return {
    required:  Array.isArray(parsed.required)  ? parsed.required  : [],
    optional:  Array.isArray(parsed.optional)  ? parsed.optional  : [],
    clarified: Array.isArray(parsed.clarified) ? parsed.clarified : [],
  };
}

export default function FeedbackOrganizer() {
  const [input,   setInput]   = useState("");
  const [result,        setResult]        = useState<FeedbackResult | null>(null);
  const [editableText,  setEditableText]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true); setError(""); setResult(null);
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
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      const parsed = parseResult(data.result);
      setResult(parsed);
      // initialize editable text from formatted output
      const lines: string[] = [];
      if (parsed.required.length) { lines.push("[필수 수정사항]"); parsed.required.forEach((r) => lines.push(`• ${r}`)); }
      if (parsed.optional.length) { lines.push("", "[선택 수정사항]"); parsed.optional.forEach((r) => lines.push(`• ${r}`)); }
      if (parsed.clarified.length) { lines.push("", "[구체화된 피드백]"); parsed.clarified.forEach(({ original, clarified }) => lines.push(`• "${original}" → ${clarified}`)); }
      setEditableText(lines.join("\n"));
      trackUsage("feedback");
    } catch (e) {
      setError(e instanceof Error ? e.message : "피드백 분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const lines: string[] = [];
    if (result.required.length) {
      lines.push("[필수 수정사항]");
      result.required.forEach((r) => lines.push(`• ${r}`));
    }
    if (result.optional.length) {
      lines.push("", "[선택 수정사항]");
      result.optional.forEach((r) => lines.push(`• ${r}`));
    }
    if (result.clarified.length) {
      lines.push("", "[구체화된 피드백]");
      result.clarified.forEach(({ original, clarified }) =>
        lines.push(`• "${original}" → ${clarified}`)
      );
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto w-full self-start">

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          클라이언트 피드백 입력
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder="예: 전체적으로 톤이 너무 밝아요. 로고 크기 줄여주세요. 폰트가 마음에 안 들어요."
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
              <><IconLoader2 className="w-4 h-4 animate-spin text-white" />분석 중...</>
            ) : (
              <><IconMessageCheck className="w-4 h-4" />피드백 정리</>
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
      {result ? (
        <div ref={resultRef} className="space-y-3">

          {/* 전체 복사 */}
          <div className="flex justify-end">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              {copied
                ? <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</>
                : <><IconCopy className="w-3.5 h-3.5" />전체 복사</>}
            </button>
          </div>

          {/* 필수 수정사항 */}
          {result.required.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/40 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                  <IconAlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">필수 수정사항</p>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                  {result.required.length}건
                </span>
              </div>
              <ul className="space-y-2">
                {result.required.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-zinc-300">
                    <span className="text-red-400 shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 선택 수정사항 */}
          {result.optional.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-amber-200 dark:border-amber-900/40 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                  <IconCircleCheck className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">선택 수정사항</p>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  {result.optional.length}건
                </span>
              </div>
              <ul className="space-y-2">
                {result.optional.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-zinc-300">
                    <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 구체화된 피드백 */}
          {result.clarified.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-[#6C63FF]/30 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center shrink-0">
                  <IconBulb className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF]" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">구체화된 피드백</p>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF]">
                  {result.clarified.length}건
                </span>
              </div>
              <ul className="space-y-3">
                {result.clarified.map(({ original, clarified }, i) => (
                  <li key={i} className="space-y-1">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-through">"{original}"</p>
                    <p className="flex gap-2 text-sm text-slate-700 dark:text-zinc-300">
                      <span className="text-[#4D44CC] dark:text-[#8B85FF] shrink-0 mt-0.5">→</span>
                      <span>{clarified}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 편집 가능한 전체 텍스트 */}
          {editableText && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">편집 가능한 정리 결과</p>
              <EditableResult value={editableText} onChange={setEditableText} rows={10}>
                <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{editableText}</p>
              </EditableResult>
            </div>
          )}

        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
          <IconMessageCheck className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">피드백 내용을 입력하고 정리하면 결과가 여기에 표시됩니다.</p>
        </div>
      )}
      <HelpButton
        title="피드백 정리 사용법"
        steps={[
          { step: "피드백 입력", desc: "클라이언트 피드백 텍스트를 그대로 붙여넣으세요." },
          { step: "AI 분류", desc: "필수·선택·구체화 항목으로 자동 분류됩니다." },
          { step: "우선 처리", desc: "빨간 카드(필수 수정)부터 순서대로 처리하세요." },
          { step: "편집·복사", desc: "정리된 내용을 편집하거나 전체 복사합니다." },
        ]}
      />
    </div>
  );
}
