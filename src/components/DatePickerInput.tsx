"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

const PICKER_DAYS   = ["일","월","화","수","목","금","토"];
const PICKER_MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const THIS_YEAR   = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: THIS_YEAR + 5 - (THIS_YEAR - 100) + 1 }, (_, i) => THIS_YEAR + 5 - i);

export default function DatePickerInput({ value, onChange, placeholder, forceDown }: { value: string; onChange: (v: string) => void; placeholder?: string; forceDown?: boolean }) {
  const parseYear  = () => value ? Number(value.split("-")[0]) : new Date().getFullYear();
  const parseMonth = () => value ? Number(value.split("-")[1]) - 1 : new Date().getMonth();

  const [open,           setOpen]           = useState(false);
  const [year,           setYear]           = useState(parseYear);
  const [month,          setMonth]          = useState(parseMonth);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [pos,            setPos]            = useState<{ top: number; left: number; width: number } | null>(null);

  const triggerRef  = useRef<HTMLButtonElement>(null);
  const popoverRef  = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger  = triggerRef.current?.contains(target);
      const inPopover  = popoverRef.current?.contains(target);
      if (!inTrigger && !inPopover) {
        setOpen(false);
        setYearPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const computePos = (rect: DOMRect) => {
    if (forceDown) {
      return { top: rect.bottom + 4 + window.scrollY, left: rect.left, width: Math.max(rect.width, 256) };
    }
    const estimatedHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedHeight + 16 && rect.top > estimatedHeight + 16;
    const top = (openUpward ? rect.top - estimatedHeight - 4 : rect.bottom + 4) + window.scrollY;
    return { top, left: rect.left, width: Math.max(rect.width, 256) };
  };

  // 리사이즈 시 팝업 위치 재계산
  useEffect(() => {
    if (!open) return;
    const recalc = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPos(computePos(rect));
    };
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("resize", recalc);
    };
  }, [open]);

  // 연도 피커 열릴 때 선택 연도로 스크롤
  useEffect(() => {
    if (!yearPickerOpen || !yearListRef.current) return;
    const btn = yearListRef.current.querySelector(`[data-year="${year}"]`) as HTMLElement | null;
    if (btn) btn.scrollIntoView({ block: "center" });
  }, [yearPickerOpen]);

  const handleOpen = () => {
    setYear(parseYear());
    setMonth(parseMonth());
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos(computePos(rect));
    setOpen(true);
  };

  const prevMonth = () => month === 0  ? (setYear((y) => y-1), setMonth(11)) : setMonth((m) => m-1);
  const nextMonth = () => month === 11 ? (setYear((y) => y+1), setMonth(0))  : setMonth((m) => m+1);

  const todayStr    = toDateKey(new Date());
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const display = (() => {
    if (!value) return placeholder ?? "날짜 선택";
    const [y, m, d] = value.split("-").map(Number);
    return `${y}년 ${m}월 ${d}일 (${PICKER_DAYS[new Date(y, m-1, d).getDay()]})`;
  })();

  const popover = open && pos ? (
    <div
      ref={popoverRef}
      style={{ position: "absolute", top: pos.top, left: pos.left, width: pos.width, zIndex: 50 }}
      className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl p-3"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2 px-1">
        {yearPickerOpen ? (
          <div className="flex-1 text-center">
            <button type="button" onClick={() => setYearPickerOpen(false)}
              className="px-2 py-0.5 rounded-lg text-xs font-semibold text-[#6C63FF] hover:bg-[#6C63FF]/10 transition">
              {year}년 ▲
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition">
              <IconChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setYearPickerOpen(true)}
              className="px-2 py-0.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-[#6C63FF]/10 hover:text-[#6C63FF] transition">
              {year}년 {PICKER_MONTHS[month]}
            </button>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition">
              <IconChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* 연도 피커 */}
      {yearPickerOpen ? (
        <div className="rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden">
          <div ref={yearListRef} className="max-h-48 overflow-y-auto">
          {YEAR_OPTIONS.map(y => (
            <button key={y} type="button" data-year={y}
              onClick={() => { setYear(y); setYearPickerOpen(false); }}
              className={[
                "w-full px-3 py-1.5 text-xs text-left transition",
                y === year
                  ? "bg-[#6C63FF]/10 text-[#6C63FF] font-medium"
                  : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800",
              ].join(" ")}
            >{y}년</button>
          ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 mb-1">
            {PICKER_DAYS.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-medium py-1 ${i===0?"text-red-400":i===6?"text-blue-400":"text-slate-400 dark:text-zinc-500"}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const key     = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isSel   = key === value;
              const isToday = key === todayStr;
              const dow     = (firstDow + day - 1) % 7;
              return (
                <button key={idx} type="button" onClick={() => { onChange(key); setOpen(false); }}
                  className={[
                    "h-7 w-full rounded-lg text-xs font-medium transition-all",
                    isSel?"text-white shadow-sm":isToday?"bg-[#6C63FF]/10 text-[#6C63FF]":"hover:bg-slate-100 dark:hover:bg-zinc-800",
                    !isSel&&dow===0?"text-red-400":!isSel&&dow===6?"text-blue-400":!isSel&&!isToday?"text-slate-700 dark:text-zinc-300":"",
                  ].join(" ")}
                  style={isSel?{background:"linear-gradient(135deg,#6C63FF,#8B85FF)"}:undefined}
                >{day}</button>
              );
            })}
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="relative">
      <button ref={triggerRef} type="button" onClick={handleOpen}
        className={[
          "w-full px-3 py-2 rounded-xl border text-sm text-left transition focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40",
          "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800",
          value ? "text-slate-800 dark:text-zinc-100" : "text-slate-400 dark:text-zinc-500",
        ].join(" ")}
      >{display}</button>
      {typeof document !== "undefined" && popover && createPortal(popover, document.body)}
    </div>
  );
}
