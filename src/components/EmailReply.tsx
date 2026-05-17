"use client";

import { useState } from "react";
import {
  IconTie,
  IconBolt,
  IconBan,
  IconHeartHandshake,
  IconHeart,
} from "@tabler/icons-react";

type Tone = "정중하게" | "간결하게" | "거절하기" | "사과하기" | "감사하기";

const TONES: { id: Tone; Icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: "정중하게", Icon: IconTie,           desc: "격식 있고 공손한 톤" },
  { id: "간결하게", Icon: IconBolt,          desc: "짧고 핵심만 전달" },
  { id: "거절하기", Icon: IconBan,           desc: "정중히 거절하는 톤" },
  { id: "사과하기", Icon: IconHeartHandshake, desc: "진심 어린 사과 표현" },
  { id: "감사하기", Icon: IconHeart,         desc: "감사함을 전하는 톤" },
];

const SYSTEM_PROMPT = `당신은 비즈니스 이메일 작성 전문가입니다.
사용자가 받은 이메일 내용과 원하는 답장 톤을 제공하면, 해당 톤에 맞는 한국어 답장 초안 3가지를 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록, 설명 텍스트는 절대 포함하지 마세요.
{"drafts":["초안1 전체 내용","초안2 전체 내용","초안3 전체 내용"]}

각 초안은 완성된 이메일 본문이어야 합니다. 인사말과 서명 포함, 200자 내외로 작성하세요.`;

function parseDrafts(raw: string): string[] {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed.drafts)) return parsed.drafts.slice(0, 3);
    return [];
  } catch {
    return [];
  }
}

export default function EmailReply() {
  const [emailInput, setEmailInput] = useState("");
  const [selectedTone, setSelectedTone] = useState<Tone>("정중하게");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!emailInput.trim()) return;
    setLoading(true);
    setError("");
    setDrafts([]);

    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `받은 이메일:\n${emailInput}\n\n답장 톤: ${selectedTone}`,
            },
          ],
          systemPrompt: SYSTEM_PROMPT,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      const parsed = parseDrafts(data.result);
      if (parsed.length === 0) throw new Error("초안을 파싱하지 못했습니다. 다시 시도해주세요.");
      setDrafts(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이메일 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          받은 이메일 내용
        </label>
        <textarea
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder={"안녕하세요,\n다음 주 회의 일정을 변경할 수 있을지 문의드립니다..."}
          rows={6}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
      </div>

      {/* 톤 선택 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">답장 톤 선택</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {TONES.map((tone) => {
            const isActive = selectedTone === tone.id;
            return (
              <button
                key={tone.id}
                onClick={() => setSelectedTone(tone.id)}
                className={[
                  "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-all",
                  isActive
                    ? "text-white border-transparent shadow-md"
                    : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-[#6C63FF]/40 hover:bg-slate-50 dark:hover:bg-zinc-800",
                ].join(" ")}
                style={isActive ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
              >
                <tone.Icon className="w-5 h-5" />
                <span>{tone.id}</span>
                <span className={`text-xs ${isActive ? "text-white/70" : "text-slate-400 dark:text-zinc-500"}`}>
                  {tone.desc}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleGenerate}
            disabled={loading || !emailInput.trim()}
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                답장 초안 생성
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

      {/* 초안 결과 — Bento Grid */}
      {drafts.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          {drafts.map((draft, i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                  초안 {i + 1}
                </span>
                <button
                  onClick={() => handleCopy(draft, i)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copiedIndex === i ? "복사됨!" : "복사"}
                </button>
              </div>
              <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed flex-1">
                {draft}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
