"use client";

import { useState, useEffect, useRef } from "react";
import {
  IconChevronLeft, IconChevronRight, IconPlus,
  IconTrash, IconCalendar, IconClock, IconMapPin,
  IconPencil, IconCheck, IconX, IconChevronUp,
} from "@tabler/icons-react";
import {
  CalendarEvent, loadCalendarEvents, saveCalendarEvents,
} from "@/lib/calendarStorage";

const DAY_LABELS  = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

const HOLIDAYS: Record<string, string> = {
  // 고정 공휴일
  "2026-01-01": "신정",
  "2026-03-01": "삼일절",
  "2026-05-05": "어린이날",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-10-03": "개천절",
  "2026-10-09": "한글날",
  "2026-12-25": "크리스마스",
  // 2026년 음력 공휴일
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-05-24": "부처님오신날",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  // 2026년 대체공휴일
  "2026-03-02": "대체공휴일",   // 삼일절(일) → 월
  "2026-05-25": "대체공휴일",   // 부처님오신날(일) → 월
  "2026-08-17": "대체공휴일",   // 광복절(토) → 월
  "2026-10-05": "대체공휴일",   // 개천절(토) → 월
};

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function formatKey(key: string): string {
  return key.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) =>
    `${y}년 ${Number(m)}월 ${Number(d)}일`
  );
}

export default function CalendarComponent() {
  const today    = new Date();
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [events,   setEvents]   = useState<CalendarEvent[]>([]);
  const [formTitle,    setFormTitle]    = useState("");
  const [formTime,     setFormTime]     = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [hydrated,   setHydrated]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const panelWrapRef = useRef<HTMLDivElement>(null);
  const panelRef     = useRef<HTMLDivElement>(null);
  const [editTitle,    setEditTitle]    = useState("");
  const [editTime,     setEditTime]     = useState("");
  const [editLocation, setEditLocation] = useState("");

  useEffect(() => {
    setEvents(loadCalendarEvents());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const wrap  = panelWrapRef.current;
    const inner = panelRef.current;
    if (!wrap || !inner) return;

    if (selected) {
      wrap.style.height = inner.scrollHeight + "px";
      const onEnd = () => {
        wrap.style.height = "auto";
        wrap.removeEventListener("transitionend", onEnd);
      };
      wrap.addEventListener("transitionend", onEnd);
      return () => wrap.removeEventListener("transitionend", onEnd);
    } else {
      // height: auto → 숫자로 확정 → 0 으로 트랜지션
      if (!wrap.style.height || wrap.style.height === "0px") return;
      wrap.style.height = inner.scrollHeight + "px";
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => { wrap.style.height = "0px"; })
      );
      return () => cancelAnimationFrame(raf);
    }
  }, [selected]);

  const prevMonth = () => { month === 0 ? (setYear(y => y-1), setMonth(11)) : setMonth(m => m-1); };
  const nextMonth = () => { month === 11 ? (setYear(y => y+1), setMonth(0))  : setMonth(m => m+1); };

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsOn       = (key: string) => events.filter(e => e.date === key);
  const selectedEvents = selected ? eventsOn(selected) : [];

  const persist = (next: CalendarEvent[]) => { setEvents(next); saveCalendarEvents(next); };

  const handleAdd = () => {
    if (!formTitle.trim() || !selected) return;
    persist([...events, {
      id: crypto.randomUUID(),
      date: selected,
      title: formTitle.trim(),
      time: formTime.trim() || undefined,
      location: formLocation.trim() || undefined,
    }]);
    setFormTitle(""); setFormTime(""); setFormLocation("");
  };

  const handleDelete = (id: string) => {
    persist(events.filter(e => e.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (ev: CalendarEvent) => {
    setEditingId(ev.id);
    setEditTitle(ev.title);
    setEditTime(ev.time || "");
    setEditLocation(ev.location || "");
  };

  const saveEdit = (id: string) => {
    if (!editTitle.trim()) return;
    persist(events.map(e => e.id !== id ? e : {
      ...e,
      title: editTitle.trim(),
      time: editTime.trim() || undefined,
      location: editLocation.trim() || undefined,
    }));
    setEditingId(null);
  };

  if (!hydrated) return null;

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">

      {/* 캘린더 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <IconChevronLeft className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
          </button>
          <span className="text-base font-semibold text-slate-800 dark:text-zinc-100">
            {year}년 {MONTH_NAMES[month]}
          </span>
          <button onClick={nextMonth}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <IconChevronRight className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-medium py-1.5 ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400 dark:text-zinc-500"
            }`}>{d}</div>
          ))}
        </div>

        {/* 날짜 그리드 — 모든 셀 동일 높이 */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="min-h-[64px]" />;
            const key      = toKey(year, month, day);
            const evts     = eventsOn(key);
            const isSel    = key === selected;
            const isToday  = key === todayKey;
            const dow      = (firstDow + day - 1) % 7;
            const holiday  = HOLIDAYS[key];
            const isSun    = dow === 0;
            const isSat    = dow === 6;
            return (
              <button key={idx} onClick={() => setSelected(prev => prev === key ? null : key)}
                className={[
                  "flex flex-col items-center justify-start pt-1.5 pb-1 px-0.5 rounded-xl transition-all min-h-[64px]",
                  isSel
                    ? "bg-[#6C63FF] text-white shadow-sm"
                    : isToday
                    ? "bg-[#6C63FF]/10"
                    : "hover:bg-slate-100 dark:hover:bg-zinc-800",
                  !isSel && (isSun || holiday)
                    ? "text-red-400"
                    : !isSel && isSat
                    ? "text-blue-400"
                    : !isSel && !isToday
                    ? "text-slate-700 dark:text-zinc-300"
                    : !isSel
                    ? "text-[#6C63FF]"
                    : "",
                ].join(" ")}
              >
                <span className="text-sm font-medium leading-tight">{day}</span>
                {holiday && (
                  <span className={`text-[9px] leading-tight mt-0.5 font-medium w-full text-center truncate ${
                    isSel ? "text-white/80" : "text-red-400"
                  }`}>{holiday}</span>
                )}
                {evts.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                    {evts.slice(0, 3).map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-white/70" : "bg-[#6C63FF]"}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택 날짜 패널 — 날짜 미선택 시 숨김, 선택 시 사르르 펼침 */}
      <div
        ref={panelWrapRef}
        className="overflow-hidden transition-[height,opacity] duration-300 ease-in-out"
        style={{ height: 0, opacity: selected ? 1 : 0 }}
      >
        <div ref={panelRef} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <IconCalendar className="w-4 h-4 text-[#6C63FF]" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                {selected ? formatKey(selected) : ""}
              </h2>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              aria-label="접기"
            >
              <IconChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* 일정 목록 */}
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-zinc-500 mb-4">등록된 일정이 없습니다.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {selectedEvents.map(ev => (
                <div key={ev.id} className="rounded-xl bg-slate-50 dark:bg-zinc-800 group overflow-hidden">
                  {editingId === ev.id ? (
                    /* 인라인 편집 폼 */
                    <div className="px-3 py-3 space-y-2">
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        autoFocus
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                      />
                      <div className="flex gap-2">
                        <input
                          value={editTime}
                          onChange={e => setEditTime(e.target.value)}
                          placeholder="시간 (선택)"
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                        />
                        <input
                          value={editLocation}
                          onChange={e => setEditLocation(e.target.value)}
                          placeholder="장소 (선택)"
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition">
                          <IconX className="w-3.5 h-3.5" />취소
                        </button>
                        <button onClick={() => saveEdit(ev.id)} disabled={!editTitle.trim()}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition disabled:opacity-40"
                          style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                          <IconCheck className="w-3.5 h-3.5" />저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 일반 표시 */
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 truncate">{ev.title}</p>
                        {(ev.time || ev.location) && (
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {ev.time && (
                              <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                                <IconClock className="w-3 h-3" />{ev.time}
                              </span>
                            )}
                            {ev.location && (
                              <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                                <IconMapPin className="w-3 h-3" />{ev.location}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button onClick={() => startEdit(ev)}
                          className="p-1 rounded-lg hover:bg-[#6C63FF]/10 text-[#6C63FF] transition">
                          <IconPencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(ev.id)}
                          className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 text-red-400 transition">
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 일정 추가 폼 */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">일정 추가</p>
            <input
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              placeholder="일정 제목을 입력하세요"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
            <div className="flex gap-2">
              <input
                value={formTime}
                onChange={e => setFormTime(e.target.value)}
                placeholder="시간 (선택)"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
              <input
                value={formLocation}
                onChange={e => setFormLocation(e.target.value)}
                placeholder="장소 (선택)"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>
            <div className="flex justify-end">
              <button onClick={handleAdd} disabled={!formTitle.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                <IconPlus className="w-4 h-4" />
                추가
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
