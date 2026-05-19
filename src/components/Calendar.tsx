"use client";

import { useState, useEffect } from "react";
import {
  IconChevronLeft, IconChevronRight, IconPlus,
  IconTrash, IconCalendar, IconClock, IconMapPin,
} from "@tabler/icons-react";
import {
  CalendarEvent, loadCalendarEvents, saveCalendarEvents,
} from "@/lib/calendarStorage";

const DAY_LABELS  = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

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
  const [selected, setSelected] = useState(todayKey);
  const [events, setEvents]     = useState<CalendarEvent[]>([]);
  const [formTitle,    setFormTitle]    = useState("");
  const [formTime,     setFormTime]     = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEvents(loadCalendarEvents());
    setHydrated(true);
  }, []);

  const prevMonth = () => { month === 0 ? (setYear(y => y-1), setMonth(11)) : setMonth(m => m-1); };
  const nextMonth = () => { month === 11 ? (setYear(y => y+1), setMonth(0))  : setMonth(m => m+1); };

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsOn = (key: string) => events.filter(e => e.date === key);
  const selectedEvents = eventsOn(selected);

  const persist = (next: CalendarEvent[]) => { setEvents(next); saveCalendarEvents(next); };

  const handleAdd = () => {
    if (!formTitle.trim()) return;
    persist([...events, {
      id: crypto.randomUUID(),
      date: selected,
      title: formTitle.trim(),
      time: formTime.trim() || undefined,
      location: formLocation.trim() || undefined,
    }]);
    setFormTitle(""); setFormTime(""); setFormLocation("");
  };

  const handleDelete = (id: string) => persist(events.filter(e => e.id !== id));

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

        {/* 요일 */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-medium py-1.5 ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400 dark:text-zinc-500"
            }`}>{d}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="aspect-square" />;
            const key = toKey(year, month, day);
            const evts  = eventsOn(key);
            const isSel = key === selected;
            const isToday = key === todayKey;
            const dow = (firstDow + day - 1) % 7;
            return (
              <button key={idx} onClick={() => setSelected(key)}
                className={[
                  "flex flex-col items-center justify-start pt-1.5 pb-1 rounded-xl transition-all min-h-[44px]",
                  isSel   ? "bg-[#6C63FF] text-white shadow-sm"
                  : isToday ? "bg-[#6C63FF]/10"
                  : "hover:bg-slate-100 dark:hover:bg-zinc-800",
                  !isSel && dow === 0 ? "text-red-400"
                  : !isSel && dow === 6 ? "text-blue-400"
                  : !isSel && !isToday ? "text-slate-700 dark:text-zinc-300"
                  : !isSel ? "text-[#6C63FF]" : "",
                ].join(" ")}
              >
                <span className="text-sm font-medium leading-tight">{day}</span>
                {evts.length > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
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

      {/* 선택 날짜 일정 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <IconCalendar className="w-4 h-4 text-[#6C63FF]" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{formatKey(selected)}</h2>
        </div>

        {/* 일정 목록 */}
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-zinc-500 mb-4">등록된 일정이 없습니다.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {selectedEvents.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 group">
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
                <button onClick={() => handleDelete(ev.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 text-red-400 transition shrink-0">
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
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
  );
}
