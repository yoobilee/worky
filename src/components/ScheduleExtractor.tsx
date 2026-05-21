"use client";

import { useState } from "react";
import EditableResult from "./EditableResult";
import { trackUsage } from "@/lib/usageStats";
import { addCalendarEvent, parseKoreanDate } from "@/lib/calendarStorage";
import {
  IconCalendarEvent,
  IconClock,
  IconMapPin,
  IconNotes,
  IconCopy,
  IconCheck,
  IconClipboardList,
  IconCalendarPlus,
} from "@tabler/icons-react";

interface Schedule {
  date: string;
  time: string;
  location: string;
  content: string;
}

function buildSystemPrompt(): string {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  const dow = ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"][now.getDay()];
  const today = `${y}년 ${Number(m)}월 ${Number(d)}일 (${dow})`;

  return `당신은 일정 추출 전문가입니다. 사용자가 붙여넣은 이메일, 공지, 메시지 텍스트에서 일정 정보를 모두 추출하세요.

오늘 날짜: ${today}
"다음 주 월요일", "이번 주 목요일", "내일", "모레" 등 상대적 날짜 표현은 반드시 위 오늘 날짜를 기준으로 실제 날짜(YYYY년 MM월 DD일)로 변환해서 반환하세요.

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록이나 설명 텍스트는 절대 포함하지 마세요.
{"schedules":[{"date":"날짜(예: ${y}년 ${Number(m)}월 ${Number(d)}일)","time":"시간(예: 오후 3시, 없으면 빈 문자열)","location":"장소(없으면 빈 문자열)","content":"일정 내용"}]}

- 날짜는 항상 구체적인 날짜로 변환하세요. 상대적 표현을 그대로 두지 마세요.
- 일정이 없으면 {"schedules":[]} 를 반환하세요.
- 복수의 일정이 있으면 모두 추출하세요.`;
}

function parseSchedules(raw: string): Schedule[] {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.schedules)) return [];
    return parsed.schedules.filter(
      (s: unknown): s is Schedule =>
        typeof s === "object" && s !== null && "content" in s
    );
  } catch {
    return [];
  }
}

function formatScheduleText(s: Schedule): string {
  const lines = [`내용: ${s.content}`];
  if (s.date) lines.unshift(`날짜: ${s.date}`);
  if (s.time) lines.push(`시간: ${s.time}`);
  if (s.location) lines.push(`장소: ${s.location}`);
  return lines.join("\n");
}

export default function ScheduleExtractor() {
  const [input, setInput] = useState("");
  const [schedules,     setSchedules]     = useState<Schedule[]>([]);
  const [editableText,  setEditableText]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | "all" | null>(null);
  const [savedIndex, setSavedIndex]   = useState<number | null>(null);

  const handleSaveToCalendar = (s: Schedule, index: number) => {
    const date = parseKoreanDate(s.date) ?? new Date().toISOString().slice(0, 10);
    addCalendarEvent({
      date,
      title: s.content,
      time:  s.time     || undefined,
      location: s.location || undefined,
    });
    setSavedIndex(index);
    setTimeout(() => setSavedIndex(null), 2000);
  };

  const handleExtract = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setSchedules([]);

    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: input }],
          systemPrompt: buildSystemPrompt(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      const parsed = parseSchedules(data.result);
      if (parsed.length === 0) {
        setError("추출된 일정이 없습니다. 날짜나 시간이 포함된 텍스트를 입력해주세요.");
      } else {
        setSchedules(parsed);
        setEditableText(parsed.map((s, i) => `[일정 ${i + 1}]\n${formatScheduleText(s)}`).join("\n\n"));
        trackUsage("schedule");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "일정 추출 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOne = async (s: Schedule, index: number) => {
    await navigator.clipboard.writeText(formatScheduleText(s));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = async () => {
    const text = schedules.map((s, i) => `[일정 ${i + 1}]\n${formatScheduleText(s)}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopiedIndex("all");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full">
      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col shrink-0">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          이메일 / 공지 / 메시지 붙여넣기
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"안녕하세요,\n다음 주 수요일 오후 2시에 3층 회의실에서 전략 회의가 있습니다.\n참석 부탁드립니다."}
          rows={5}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleExtract}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                추출 중...
              </>
            ) : (
              <>
                <IconCalendarEvent className="w-4 h-4" />
                일정 추출하기
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
      {schedules.length > 0 && (
        <>
          {/* 결과 헤더 */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
              추출된 일정 {schedules.length}건
            </span>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              {copiedIndex === "all" ? (
                <>
                  <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                  복사됨!
                </>
              ) : (
                <>
                  <IconClipboardList className="w-3.5 h-3.5" />
                  전체 복사
                </>
              )}
            </button>
          </div>

          {/* 일정 카드 그리드 */}
          <div className="grid gap-3 sm:grid-cols-2">
            {schedules.map((s, i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3"
              >
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
                  >
                    일정 {i + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSaveToCalendar(s, i)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                    >
                      {savedIndex === i ? (
                        <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />저장됨!</>
                      ) : (
                        <><IconCalendarPlus className="w-3.5 h-3.5" />일정 저장</>
                      )}
                    </button>
                    <button
                      onClick={() => handleCopyOne(s, i)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                    >
                      {copiedIndex === i ? (
                        <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</>
                      ) : (
                        <><IconCopy className="w-3.5 h-3.5" />복사</>
                      )}
                    </button>
                  </div>
                </div>

                {/* 일정 필드 */}
                <div className="space-y-2">
                  {s.date && (
                    <div className="flex items-start gap-2.5">
                      <IconCalendarEvent className="w-4 h-4 text-[#6C63FF] shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700 dark:text-zinc-300">{s.date}</span>
                    </div>
                  )}
                  {s.time && (
                    <div className="flex items-start gap-2.5">
                      <IconClock className="w-4 h-4 text-[#6C63FF] shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700 dark:text-zinc-300">{s.time}</span>
                    </div>
                  )}
                  {s.location && (
                    <div className="flex items-start gap-2.5">
                      <IconMapPin className="w-4 h-4 text-[#6C63FF] shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700 dark:text-zinc-300">{s.location}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <IconNotes className="w-4 h-4 text-[#6C63FF] shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">{s.content}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 편집 가능한 전체 텍스트 */}
          {editableText && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">편집 가능한 전체 일정</p>
              <EditableResult value={editableText} onChange={setEditableText} rows={10}>
                <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{editableText}</p>
              </EditableResult>
            </div>
          )}
        </>
      )}
    </div>
  );
}
