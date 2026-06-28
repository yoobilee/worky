"use client";

import { useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { isOffDay, getHolidays } from "@/lib/holidays";
import type { DayStatus } from "@/types/client";

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function todayKey(): string { return toDateKey(new Date()); }

function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

function getWeekStartOf(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const offset = d.getDay();
  d.setDate(d.getDate() - offset);
  return toDateKey(d);
}

/* ── 미니 잔디밭 (목록형 뷰: 이번 주만 표시) ── */
export function MiniGrassGrid({
  contractStart,
  contractEnd,
  dailyLog,
  onToggle,
}: {
  contractStart: string;
  contractEnd:   string;
  dailyLog:      Record<string, DayStatus>;
  onToggle?:     (date: string) => void;
}) {
  const today = todayKey();

  const startWeek = getWeekStartOf(contractStart);
  const endWeek   = getWeekStartOf(contractEnd);
  const initWeek  = today >= contractStart && today <= contractEnd
    ? getWeekStartOf(today)
    : startWeek;

  const [weekStart, setWeekStart] = useState(initWeek);
  const canPrev = weekStart > startWeek;
  const canNext = weekStart < endWeek;

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayDate = todayKey();

  const allDates: string[] = [];
  {
    const cur = new Date(contractStart + "T00:00:00");
    const end = new Date(contractEnd   + "T00:00:00");
    while (cur <= end) { allDates.push(toDateKey(cur)); cur.setDate(cur.getDate() + 1); }
  }
  let cumDone = 0;
  const cumMap: Record<string, number> = {};
  for (const d of allDates) { if (dailyLog[d] === "done") cumDone++; cumMap[d] = cumDone; }

  return (
    <div className="flex flex-col gap-0.5">
      {/* 날짜 레이블 행 */}
      <div className="flex items-center gap-0.5">
        <div className="w-4 h-4 shrink-0" />
        {weekDates.map((date) => {
          const [, m, d] = date.split("-").map(Number);
          const isToday = date === todayDate;
          return (
            <span
              key={date}
              className={[
                "w-5 text-center text-[9px] leading-none",
                isToday ? "text-[#6C63FF] dark:text-[#a99dff] font-bold" : "text-slate-500 dark:text-zinc-300",
              ].join(" ")}
            >
              {m}/{d}
            </span>
          );
        })}
        <div className="w-4 h-4 shrink-0" />
      </div>

      {/* 네비 + 셀 행 */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="w-4 h-4 p-0.5 shrink-0 text-slate-500 dark:text-zinc-300 disabled:opacity-25 disabled:cursor-not-allowed hover:text-[#6C63FF] transition-colors"
        >
          <IconChevronLeft className="w-full h-full" />
        </button>
        {weekDates.map((date) => {
          if (date < contractStart || date > contractEnd) {
            return <div key={date} className="w-5 h-5 rounded-sm" />;
          }
          const ds  = dailyLog[date];
          const off = isOffDay(date);
          const [, m, d] = date.split("-").map(Number);
          const cls = off
            ? "bg-slate-200 dark:bg-zinc-700 opacity-40"
            : ds === "done"   ? "bg-emerald-500"
            : ds === "failed" ? "bg-red-400"
            :                   "bg-slate-200 dark:bg-zinc-700";
          const disabled = off || date > todayDate;
          return (
            <button
              key={date}
              type="button"
              title={`${m}/${d}`}
              disabled={disabled}
              onClick={() => onToggle?.(date)}
              className={`w-5 h-5 rounded-sm flex items-center justify-center transition-opacity ${cls} ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:opacity-75"}`}
            >
              {ds === "done" && (
                <span className="text-[8px] font-bold text-white leading-none">{cumMap[date]}</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="w-4 h-4 p-0.5 shrink-0 text-slate-500 dark:text-zinc-300 disabled:opacity-25 disabled:cursor-not-allowed hover:text-[#6C63FF] transition-colors"
        >
          <IconChevronRight className="w-full h-full" />
        </button>
      </div>
    </div>
  );
}

/* ── 잔디밭 그리드 (주 단위 네비게이션) ── */
export function GrassGrid({
  contractStart,
  contractEnd,
  dailyLog,
  onToggle,
}: {
  contractStart: string;
  contractEnd:   string;
  dailyLog:      Record<string, DayStatus>;
  onToggle:      (date: string) => void;
}) {
  const today = todayKey();

  const startWeek = getWeekStartOf(contractStart);
  const endWeek   = getWeekStartOf(contractEnd);

  const initWeek = today >= contractStart && today <= contractEnd
    ? getWeekStartOf(today)
    : startWeek;

  const [weekStart, setWeekStart] = useState(initWeek);

  const canPrev = weekStart > startWeek;
  const canNext = weekStart < endWeek;

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const allDates: string[] = [];
  {
    const cur = new Date(contractStart + "T00:00:00");
    const end = new Date(contractEnd   + "T00:00:00");
    while (cur <= end) { allDates.push(toDateKey(cur)); cur.setDate(cur.getDate() + 1); }
  }

  let cumDone = 0;
  const cumMap: Record<string, number> = {};
  for (const d of allDates) { if (dailyLog[d] === "done") cumDone++; cumMap[d] = cumDone; }

  const workdays   = allDates.filter((d) => !isOffDay(d));
  const statDone   = workdays.filter((d) => dailyLog[d] === "done").length;
  const statFailed = workdays.filter((d) => dailyLog[d] === "failed").length;
  const statNone   = workdays.filter((d) => !dailyLog[d] && d <= today).length;

  const [, ws_m, ws_d] = weekStart.split("-").map(Number);
  const weekEndDate = addDays(weekStart, 6);
  const [, we_m, we_d] = weekEndDate.split("-").map(Number);

  const year = Number(contractStart.split("-")[0]);
  const holidays = getHolidays(year);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* 네비게이션 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="p-1 rounded-lg disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-slate-500 dark:text-zinc-300"
        >
          <IconChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-300">
          {ws_m}/{ws_d} – {we_m}/{we_d}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="p-1 rounded-lg disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-slate-500 dark:text-zinc-300"
        >
          <IconChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 7일 셀 */}
      <div className="flex gap-1.5 justify-between">
        {weekDates.map((date) => {
          if (date < contractStart || date > contractEnd) {
            return (
              <div key={date} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-[9px] leading-none text-transparent select-none">·</span>
                <div className="w-full h-[30px] rounded-md" />
              </div>
            );
          }

          const ds          = dailyLog[date];
          const isFuture    = date > today;
          const isToday     = date === today;
          const off         = isOffDay(date);
          const holidayName = holidays[date];
          const [, m, d]    = date.split("-").map(Number);
          const dateLabel   = `${m}/${d}`;

          const tooltip = off
            ? (holidayName ? `${dateLabel} · ${holidayName}` : dateLabel)
            : ds === "done"   ? `${dateLabel} · ${cumMap[date]}회차`
            : ds === "failed" ? `${dateLabel} · 실패`
            : dateLabel;

          const labelCls = [
            "text-[9px] leading-none font-medium",
            isToday ? "text-[#6C63FF] dark:text-[#a99dff] font-bold"
            : off   ? "text-slate-500 dark:text-zinc-600"
            :         "text-slate-500 dark:text-zinc-300",
          ].join(" ");

          if (off) {
            return (
              <div key={date} className="flex flex-col items-center gap-1 flex-1" title={tooltip}>
                <span className={labelCls}>{dateLabel}</span>
                <div className="w-full h-[30px] rounded-md bg-slate-200 dark:bg-zinc-700 opacity-40" />
              </div>
            );
          }

          return (
            <div key={date} className="flex flex-col items-center gap-1 flex-1">
              <span className={labelCls}>{dateLabel}</span>
              <button
                type="button"
                onClick={() => { if (!isFuture) onToggle(date); }}
                title={tooltip}
                className={[
                  "w-full h-[30px] rounded-md transition-all flex items-center justify-center",
                  isToday  ? "ring-2 ring-[#6C63FF] ring-offset-1 dark:ring-offset-zinc-900" : "",
                  isFuture ? "opacity-20 cursor-not-allowed" : "cursor-pointer hover:opacity-75 active:scale-95",
                  ds === "done"     ? "bg-emerald-500"
                  : ds === "failed" ? "bg-red-400"
                  :                   "bg-slate-200 dark:bg-zinc-700",
                ].join(" ")}
              >
                {ds === "done" && (
                  <span className="text-[11px] font-bold text-white leading-none">{cumMap[date]}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 하단 범례 + 전체 통계 */}
      <div className="flex items-center gap-3 flex-wrap pt-0.5">
        {[
          { cls: "bg-emerald-500",                           label: "완료",   count: statDone,   showCount: true  },
          { cls: "bg-red-400",                               label: "실패",   count: statFailed, showCount: true  },
          { cls: "bg-slate-200 dark:bg-zinc-700",            label: "미확인", count: statNone,   showCount: true  },
          { cls: "bg-slate-200 dark:bg-zinc-700 opacity-40", label: "휴일",   count: 0,          showCount: false },
        ].map(({ cls, label, count, showCount }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm shrink-0 ${cls}`} />
            <span className="text-[9px] text-slate-500 dark:text-zinc-300">{label}</span>
            {showCount && <span className="text-[9px] font-semibold text-slate-700 dark:text-zinc-200">{count}건</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
