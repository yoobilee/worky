"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import { trackUsage } from "@/lib/usageStats";
import { parseKoreanDate } from "@/lib/calendarStorage";
import { createClient } from "@/lib/supabase/client";
import { addEvent } from "@/lib/db/calendar";
import {
  IconCalendarEvent,
  IconClock,
  IconMapPin,
  IconNotes,
  IconCopy,
  IconCheck,
  IconCalendarPlus,
} from "@tabler/icons-react";

interface Schedule {
  date: string;
  time: string;
  location: string;
  content: string;
}

function buildSystemPrompt(): string {
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = String(now.getMonth() + 1).padStart(2, "0");
  const d     = String(now.getDate()).padStart(2, "0");
  const iso   = `${y}-${m}-${d}`;
  const dow   = ["일","월","화","수","목","금","토"][now.getDay()];

  return `당신은 일정 추출 전문가입니다. 사용자가 붙여넣은 이메일, 공지, 메시지 텍스트에서 일정 정보를 모두 추출하세요.

오늘 날짜: ${iso} (YYYY-MM-DD 형식)
오늘 요일: ${dow}요일

상대적 날짜 표현은 반드시 위 오늘 날짜를 기준으로 아래 규칙에 따라 실제 날짜(YYYY-MM-DD)로 변환해서 반환하세요.
- "내일", "모레" 등은 오늘 날짜 기준으로 계산하세요.
- "이번주"는 이번 주 월요일부터 일요일까지를 의미합니다.
- "다음주"는 오늘 날짜 기준 다음 주 월요일부터 시작하는 주를 의미합니다. (예: "다음 주 화요일"은 다음 주 월요일의 다음 날)
- "다음달 첫째 주 월요일"처럼 다음 달을 기준으로 한 표현은, 다음 달 1일 이후 첫 번째로 오는 해당 요일로 계산하세요.
- "이번달 말"은 이번 달의 마지막 날짜로 계산하세요.

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록이나 설명 텍스트는 절대 포함하지 마세요.
{"schedules":[{"date":"날짜(YYYY-MM-DD 형식, 예: ${iso})","time":"시간(예: 오후 3시, 없으면 빈 문자열)","location":"장소(없으면 빈 문자열)","content":"일정 내용"}]}

- 날짜는 항상 YYYY-MM-DD 형식의 구체적인 날짜로 변환하세요. 상대적 표현을 그대로 두지 마세요.
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
  const [schedules,   setSchedules]   = useState<Schedule[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedIndex,  setSavedIndex]  = useState<number | null>(null);
  const [savedAll,    setSavedAll]    = useState(false);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (schedules.length > 0) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [schedules]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const handleSaveToCalendar = async (s: Schedule, index: number) => {
    if (!userId) {
      showToast(false, "로그인 후 이용해주세요.");
      return;
    }
    const date = parseKoreanDate(s.date) ?? new Date().toISOString().slice(0, 10);
    const row = await addEvent(userId, {
      date,
      title: s.content,
      time:  s.time     || undefined,
      location: s.location || undefined,
    });
    if (row) {
      setSavedIndex(index);
      setTimeout(() => setSavedIndex(null), 2000);
      showToast(true, "일정이 캘린더에 저장되었습니다.");
    } else {
      showToast(false, "일정 저장에 실패했습니다.");
    }
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

  const handleSaveAll = async () => {
    if (!userId) {
      showToast(false, "로그인 후 이용해주세요.");
      return;
    }
    const results = await Promise.all(
      schedules.map((s) => {
        const date = parseKoreanDate(s.date) ?? new Date().toISOString().slice(0, 10);
        return addEvent(userId, { date, title: s.content, time: s.time || undefined, location: s.location || undefined });
      })
    );
    if (results.every((r) => r)) {
      setSavedAll(true);
      setTimeout(() => setSavedAll(false), 2000);
      showToast(true, "모든 일정이 캘린더에 저장되었습니다.");
    } else {
      showToast(false, "일부 일정 저장에 실패했습니다.");
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-5xl mx-auto w-full">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.ok ? "bg-green-500 text-white" : "bg-red-500 text-white"
        }`}>
          {toast.ok ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.msg}
        </div>
      )}

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
          <div ref={resultRef} className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
              추출된 일정 {schedules.length}건
            </span>
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              {savedAll ? (
                <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />저장됨!</>
              ) : (
                <><IconCalendarPlus className="w-3.5 h-3.5" />전체 일정 추가</>
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

        </>
      )}
      <HelpButton
        title="일정 추출 사용법"
        steps={[
          { step: "텍스트 붙여넣기", desc: "이메일·공지·메시지 원문을 그대로 입력합니다." },
          { step: "일정 추출", desc: "AI가 날짜·시간·장소·내용을 자동으로 추출합니다." },
          { step: "개별 저장", desc: "각 일정 카드의 '일정 저장' 버튼으로 캘린더에 저장합니다." },
          { step: "전체 저장", desc: "'전체 일정 추가' 버튼으로 모든 일정을 한 번에 저장합니다." },
        ]}
      />
    </div>
  );
}
