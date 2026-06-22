"use client";

import { useState, useEffect, useRef } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

const PICKER_DAYS   = ["일","월","화","수","목","금","토"];
const PICKER_MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function DatePickerInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const parseYear  = () => value ? Number(value.split("-")[0]) : new Date().getFullYear();
  const parseMonth = () => value ? Number(value.split("-")[1]) - 1 : new Date().getMonth();

  const [open,  setOpen]  = useState(false);
  const [year,  setYear]  = useState(parseYear);
  const [month, setMonth] = useState(parseMonth);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => { setYear(parseYear()); setMonth(parseMonth()); setOpen(true); };
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

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={handleOpen}
        className={[
          "w-full px-3 py-2 rounded-xl border text-sm text-left transition focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40",
          "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800",
          value ? "text-slate-800 dark:text-zinc-100" : "text-slate-400 dark:text-zinc-500",
        ].join(" ")}
      >{display}</button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-2 px-1">
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition">
              <IconChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">{year}년 {PICKER_MONTHS[month]}</span>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition">
              <IconChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {PICKER_DAYS.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-medium py-1 ${i===0?"text-red-400":i===6?"text-blue-400":"text-slate-400 dark:text-zinc-500"}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const key = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isSel = key === value;
              const isToday = key === todayStr;
              const dow = (firstDow + day - 1) % 7;
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
        </div>
      )}
    </div>
  );
}
