"use client";

import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import ConfirmModal from "./ConfirmModal";
import {
  IconChevronLeft, IconChevronRight, IconPlus,
  IconTrash, IconCalendar, IconClock, IconMapPin,
  IconPencil, IconCheck, IconX, IconRepeat,
} from "@tabler/icons-react";
import { CalendarEvent } from "@/lib/calendarStorage";
import { createClient } from "@/lib/supabase/client";
import { getEventsInRange, addEvent, addEvents, updateEvent, deleteEvent } from "@/lib/db/calendar";
import { getHolidays } from "@/lib/holidays";
import { useToast } from "@/contexts/ToastContext";
import DatePickerInput from "./DatePickerInput";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function formatKey(key: string, locale: string, monthNames: string[]): string {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return key;
  const [, y, m, d] = match;
  if (locale === "en") return `${monthNames[Number(m) - 1]} ${Number(d)}, ${y}`;
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

const HOUR_OPTIONS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

function parseTimeValue(v: string): { hour: number; minute: number } | null {
  let m = v.match(/^(오전|오후)\s*(\d{1,2}):(\d{2})$/);
  if (m) {
    let h = Number(m[2]) % 12;
    if (m[1] === "오후") h += 12;
    return { hour: h, minute: Number(m[3]) };
  }
  m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return { hour: Number(m[1]), minute: Number(m[2]) };
  return null;
}

function TimePickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t, locale } = useLocale();
  const [open,       setOpen]       = useState(false);
  const [hourOpen,   setHourOpen]   = useState(false);
  const [minuteOpen, setMinuteOpen] = useState(false);
  const ref        = useRef<HTMLDivElement>(null);
  const hourRef    = useRef<HTMLDivElement>(null);
  const minuteRef  = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setHourOpen(false); setMinuteOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!hourOpen && !minuteOpen) return;
    const handler = (e: MouseEvent) => {
      if (hourRef.current   && !hourRef.current.contains(e.target as Node))   setHourOpen(false);
      if (minuteRef.current && !minuteRef.current.contains(e.target as Node)) setMinuteOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [hourOpen, minuteOpen]);

  const parsed = parseTimeValue(value);
  const hour   = parsed?.hour ?? 9;
  const minute = parsed?.minute ?? 0;

  const commit = (h: number, m: number) =>
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

  const hourLabel   = (h: number) => locale === "en" ? String(h)                  : `${h}시`;
  const minuteLabel = (m: number) => locale === "en" ? String(m).padStart(2, "0") : `${m}분`;

  return (
    <div className="relative" ref={ref}>
      <button type="button"
        onClick={() => setOpen(v => { const next = !v; if (next) requestAnimationFrame(() => popoverRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })); return next; })}
        className={[
          "w-full px-3 py-2 rounded-xl border text-sm text-left flex items-center gap-1.5 transition",
          "bg-slate-50 dark:bg-zinc-800",
          parsed ? "border-[#6C63FF] text-[#4D44CC] dark:text-[#8B85FF]" : "border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400",
        ].join(" ")}
      >
        <IconClock className="w-3.5 h-3.5 shrink-0" />
        {parsed ? `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}` : t("time_select")}
      </button>

      {open && (
        <div ref={popoverRef} className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg w-[280px] max-w-[calc(100vw-2rem)] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{t("time_setting")}</span>
            <button type="button" onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1" ref={hourRef}>
              <button type="button" onClick={() => setHourOpen(v => !v)}
                className={[
                  "w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-800 text-sm text-left transition text-slate-800 dark:text-zinc-100",
                  hourOpen ? "border-[#6C63FF] ring-2 ring-[#6C63FF]/40" : "border-slate-200 dark:border-zinc-700",
                ].join(" ")}
              >{hourLabel(hour)}</button>
              {hourOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg overflow-hidden w-full">
                  <div className="max-h-40 overflow-y-auto">
                    {HOUR_OPTIONS.map(h => (
                      <button key={h} type="button" onClick={() => { commit(h, minute); setHourOpen(false); }}
                        className={[
                          "w-full px-3 py-1.5 text-xs text-left transition",
                          h === hour ? "bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF] font-medium" : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800",
                        ].join(" ")}
                      >{hourLabel(h)}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative flex-1" ref={minuteRef}>
              <button type="button" onClick={() => setMinuteOpen(v => !v)}
                className={[
                  "w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-800 text-sm text-left transition text-slate-800 dark:text-zinc-100",
                  minuteOpen ? "border-[#6C63FF] ring-2 ring-[#6C63FF]/40" : "border-slate-200 dark:border-zinc-700",
                ].join(" ")}
              >{minuteLabel(minute)}</button>
              {minuteOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg overflow-hidden w-full">
                  <div className="max-h-40 overflow-y-auto">
                    {MINUTE_OPTIONS.map(m => (
                      <button key={m} type="button" onClick={() => { commit(hour, m); setMinuteOpen(false); }}
                        className={[
                          "w-full px-3 py-1.5 text-xs text-left transition",
                          m === minute ? "bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF] font-medium" : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800",
                        ].join(" ")}
                      >{minuteLabel(m)}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-zinc-800">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-300 transition">
              {t("time_reset")}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
              {t("time_done")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface KakaoPlace {
  place_name:   string;
  address_name: string;
  place_url:    string;
}

function LocationInput({ value, onChange, urlValue, onUrlChange }: {
  value: string;
  onChange: (v: string) => void;
  urlValue?: string;
  onUrlChange: (v: string | undefined) => void;
}) {
  const { t } = useLocale();
  const [results,      setResults]      = useState<KakaoPlace[]>([]);
  const [showResults,  setShowResults]  = useState(false);
  const [addrTooltip,  setAddrTooltip]  = useState<{ x: number; y: number; text: string } | null>(null);
  const ref         = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showResults) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showResults]);

  const search = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res  = await fetch(`/api/kakao-places?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.documents && data.documents.length > 0) {
        setResults(data.documents.slice(0, 5));
        setShowResults(true);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);
  };

  const handleChange = (v: string) => { onChange(v); search(v); };
  const handleSelect = (place: KakaoPlace) => {
    onChange(place.place_name);
    onUrlChange(place.place_url);
    setResults([]); setShowResults(false);
  };
  const handleClear = () => {
    onChange(""); onUrlChange(undefined);
    setResults([]); setShowResults(false);
  };

  const hasUrl = !!urlValue;

  return (
    <div className="relative" ref={ref}>
      {addrTooltip && (
        <div
          style={{ position: "fixed", left: addrTooltip.x, top: addrTooltip.y, transform: "translateY(-100%)" }}
          className="z-[9999] text-xs px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {addrTooltip.text}
        </div>
      )}
      <input
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={t("location_ph")}
        className={[
          "w-full px-3 py-2 pr-8 rounded-xl border text-sm bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition",
          hasUrl ? "border-[#6C63FF]" : "border-slate-200 dark:border-zinc-700",
        ].join(" ")}
      />
      {value && (
        <button type="button" onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
          aria-label={t("location_delete")}>
          <IconX className="w-3.5 h-3.5" />
        </button>
      )}
      {showResults && results.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg overflow-hidden w-full">
          <div className="max-h-56 overflow-y-auto">
            {results.map((p, i) => (
              <button key={i} type="button" onClick={() => handleSelect(p)}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition border-b border-slate-100 dark:border-zinc-800 last:border-b-0">
                <p
                  className="text-xs font-medium text-slate-700 dark:text-zinc-200 truncate"
                  onMouseEnter={(e) => { const el = e.currentTarget; if (el.scrollWidth <= el.offsetWidth) return; const rect = el.getBoundingClientRect(); setAddrTooltip({ x: rect.left, y: rect.top - 4, text: p.place_name }); }}
                  onMouseLeave={() => setAddrTooltip(null)}
                >{p.place_name}</p>
                <p
                  className="text-[11px] text-slate-500 dark:text-zinc-400 truncate"
                  onMouseEnter={(e) => { const el = e.currentTarget; if (el.scrollWidth <= el.offsetWidth) return; const rect = el.getBoundingClientRect(); setAddrTooltip({ x: rect.left, y: rect.top - 4, text: p.place_name }); }}
                  onMouseLeave={() => setAddrTooltip(null)}
                >{p.address_name}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MAX_REPEAT_COUNT = 1000;

type RepeatType = "none" | "daily" | "weekly" | "monthly";

interface RepeatPickerProps {
  value: RepeatType;
  onValueChange: (v: RepeatType) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
}

function RepeatPicker({ value, onValueChange, endDate, onEndDateChange }: RepeatPickerProps) {
  const { t, locale } = useLocale();
  const [open,       setOpen]       = useState(false);
  const [useEndDate, setUseEndDate] = useState(false);
  const ref        = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const REPEAT_CYCLE_OPTIONS: { value: Exclude<RepeatType, "none">; label: string }[] = [
    { value: "daily",   label: t("repeat_daily") },
    { value: "weekly",  label: t("repeat_weekly") },
    { value: "monthly", label: t("repeat_monthly") },
  ];
  const REPEAT_CYCLE_LABEL: Record<Exclude<RepeatType, "none">, string> = {
    daily: t("repeat_daily"), weekly: t("repeat_weekly"), monthly: t("repeat_monthly"),
  };

  const isActive  = value !== "none";
  const cycleLabel = isActive ? REPEAT_CYCLE_LABEL[value as Exclude<RepeatType, "none">] : "";

  const triggerLabel = (() => {
    if (!isActive) return t("repeat_none");
    if (endDate) return tFormat(t("repeat_n_until"), { cycle: cycleLabel, date: endDate });
    return locale === "en" ? cycleLabel : `${cycleLabel} 반복`;
  })();

  return (
    <div className="relative" ref={ref}>
      <button type="button"
        onClick={() => setOpen(v => { const next = !v; if (next) requestAnimationFrame(() => popoverRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })); return next; })}
        className={[
          "w-full px-3 py-2 rounded-xl border text-sm text-left flex items-center gap-1.5 transition",
          "bg-slate-50 dark:bg-zinc-800",
          isActive ? "border-[#6C63FF] text-[#4D44CC] dark:text-[#8B85FF]" : "border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400",
        ].join(" ")}
      >
        <IconRepeat className="w-3.5 h-3.5 shrink-0" />
        {triggerLabel}
      </button>

      {open && (
        <div ref={popoverRef} className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg w-[280px] max-w-[calc(100vw-2rem)] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{t("repeat_setting")}</span>
            <button type="button" onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-1.5">
            {REPEAT_CYCLE_OPTIONS.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => onValueChange(opt.value)}
                className={[
                  "flex-1 py-2 rounded-xl text-xs font-medium transition-all",
                  value === opt.value ? "text-white" : "text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700",
                ].join(" ")}
                style={value === opt.value ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
              >{opt.label}</button>
            ))}
          </div>

          {isActive && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">{t("repeat_end_date")}</span>
                <button type="button"
                  role="switch"
                  aria-checked={useEndDate}
                  onClick={() => { setUseEndDate(v => { if (v) onEndDateChange(""); return !v; }); }}
                  className={[
                    "relative inline-flex w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0",
                    useEndDate ? "bg-[#6C63FF]" : "bg-slate-200 dark:bg-zinc-700",
                  ].join(" ")}
                >
                  <span className={[
                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    useEndDate ? "translate-x-5" : "translate-x-1",
                  ].join(" ")} />
                </button>
              </div>
              {useEndDate ? (
                <DatePickerInput value={endDate} onChange={onEndDateChange} forceDown />
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">{t("repeat_max_hint")}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button type="button"
              onClick={() => { onValueChange("none"); onEndDateChange(""); setUseEndDate(false); setOpen(false); }}
              className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-300 transition">
              {t("repeat_none")}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              disabled={!isActive || (useEndDate && !endDate)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
              {t("time_done")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalendarComponent() {
  const toast    = useToast();
  const { t, locale } = useLocale();
  const today    = new Date();
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  const DAY_LABELS = [
    t("day_sun"), t("day_mon"), t("day_tue"), t("day_wed"),
    t("day_thu"), t("day_fri"), t("day_sat"),
  ];
  const MONTH_NAMES = [
    t("month_short_1"),  t("month_short_2"),  t("month_short_3"),  t("month_short_4"),
    t("month_short_5"),  t("month_short_6"),  t("month_short_7"),  t("month_short_8"),
    t("month_short_9"),  t("month_short_10"), t("month_short_11"), t("month_short_12"),
  ];

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [events,   setEvents]   = useState<CalendarEvent[]>([]);
  const [formTitle,       setFormTitle]       = useState("");
  const [formTime,        setFormTime]        = useState("");
  const [formLocation,    setFormLocation]    = useState("");
  const [formLocationUrl, setFormLocationUrl] = useState<string | undefined>(undefined);
  const [formRepeat,      setFormRepeat]      = useState<RepeatType>("none");
  const [formRepeatEnd,   setFormRepeatEnd]   = useState("");
  const [hydrated,        setHydrated]        = useState(false);
  const [userId,          setUserId]          = useState<string | null>(null);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [displayed,       setDisplayed]       = useState<string | null>(null);
  const [editTitle,       setEditTitle]       = useState("");
  const [editTime,        setEditTime]        = useState("");
  const [editLocation,    setEditLocation]    = useState("");
  const [editLocationUrl, setEditLocationUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const startDate = toKey(year, month, 1);
    const lastDay   = new Date(year, month + 1, 0).getDate();
    const endDate   = toKey(year, month, lastDay);
    getEventsInRange(userId, startDate, endDate).then((rows) => {
      setEvents(rows.map((r) => ({
        id: r.id, date: r.date, title: r.title,
        time: r.time ?? undefined, location: r.location ?? undefined,
        location_url: r.location_url ?? undefined,
      })));
    });
  }, [year, month, userId]);

  useEffect(() => {
    if (selected) setDisplayed(selected);
  }, [selected]);

  const prevMonth = () => { month === 0  ? (setYear(y => y-1), setMonth(11)) : setMonth(m => m-1); };
  const nextMonth = () => { month === 11 ? (setYear(y => y+1), setMonth(0))  : setMonth(m => m+1); };

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsOn       = (key: string) => events.filter(e => e.date === key);
  const selectedEvents = displayed ? eventsOn(displayed) : [];

  const resetForm = () => {
    setFormTitle(""); setFormTime(""); setFormLocation(""); setFormLocationUrl(undefined);
    setFormRepeat("none"); setFormRepeatEnd("");
  };

  const buildRepeatDates = (start: string, end: string | null, repeat: RepeatType, maxCount: number): string[] => {
    const dates: string[] = [];
    const cur     = new Date(start);
    const endDate = end ? new Date(end) : null;
    while (dates.length < maxCount) {
      if (endDate && cur > endDate) break;
      dates.push(toKey(cur.getFullYear(), cur.getMonth(), cur.getDate()));
      if (repeat === "daily") {
        cur.setDate(cur.getDate() + 1);
      } else if (repeat === "weekly") {
        cur.setDate(cur.getDate() + 7);
      } else if (repeat === "monthly") {
        const targetDay = new Date(start).getDate();
        cur.setMonth(cur.getMonth() + 1);
        if (cur.getDate() !== targetDay) {
          cur.setDate(1);
          cur.setMonth(cur.getMonth() + 1);
          cur.setDate(targetDay);
        }
      }
    }
    return dates;
  };

  const handleAdd = async () => {
    if (!formTitle.trim() || !displayed || !userId) return;
    const base = {
      title: formTitle.trim(),
      time: formTime.trim() || undefined,
      location: formLocation.trim() || undefined,
      location_url: formLocation.trim() ? formLocationUrl : undefined,
    };

    if (formRepeat === "none") {
      const row = await addEvent(userId, { date: displayed, ...base });
      if (row) setEvents((prev) => [...prev, { id: row.id, date: row.date, title: row.title, time: row.time ?? undefined, location: row.location ?? undefined, location_url: row.location_url ?? undefined }]);
      resetForm();
      return;
    }

    const dates   = buildRepeatDates(displayed, formRepeatEnd || null, formRepeat, MAX_REPEAT_COUNT);
    const groupId = crypto.randomUUID();
    const rows    = await addEvents(userId, dates.map(date => ({ ...base, date, recurrence_group_id: groupId })));
    setEvents(prev => [...prev, ...rows.map(r => ({ id: r.id, date: r.date, title: r.title, time: r.time ?? undefined, location: r.location ?? undefined, location_url: r.location_url ?? undefined }))]);
    toast.success(tFormat(t("toast_events_created"), { n: rows.length }));
    resetForm();
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);
  const doDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteEvent(confirmDeleteId);
    setEvents((prev) => prev.filter(e => e.id !== confirmDeleteId));
    if (editingId === confirmDeleteId) setEditingId(null);
    setConfirmDeleteId(null);
  };

  const startEdit = (ev: CalendarEvent) => {
    setEditingId(ev.id);
    setEditTitle(ev.title);
    setEditTime(ev.time || "");
    setEditLocation(ev.location || "");
    setEditLocationUrl(ev.location_url);
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    const patch = {
      title: editTitle.trim(),
      time: editTime.trim() || undefined,
      location: editLocation.trim() || undefined,
      location_url: editLocation.trim() ? editLocationUrl : undefined,
    };
    await updateEvent(id, patch);
    setEvents((prev) => prev.map(e => e.id !== id ? e : { ...e, ...patch }));
    setEditingId(null);
  };

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
        <div className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-2xl h-10 w-40" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-xl aspect-square" />
          ))}
        </div>
      </div>
    );
  }

  const sidePanelContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconCalendar className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF]" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
            {displayed ? formatKey(displayed, locale, MONTH_NAMES) : ""}
          </h2>
        </div>
        <button
          onClick={() => setSelected(null)}
          className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          aria-label={t("cal_close")}
        >
          <IconX className="w-4 h-4" />
        </button>
      </div>

      {/* 일정 목록 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">{t("no_events_msg")}</p>
        ) : (
          <div className="space-y-2 mb-4">
            {selectedEvents.map(ev => (
              <div key={ev.id} className="rounded-xl bg-slate-50 dark:bg-zinc-800 group overflow-visible">
                {editingId === ev.id ? (
                  <div className="px-3 py-3 space-y-2 overflow-visible">
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      autoFocus
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                    />
                    <div className="flex flex-col gap-2">
                      <TimePickerInput value={editTime} onChange={setEditTime} />
                      <LocationInput
                        value={editLocation}
                        onChange={setEditLocation}
                        urlValue={editLocationUrl}
                        onUrlChange={setEditLocationUrl}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition">
                        <IconX className="w-3.5 h-3.5" />{t("cancel")}
                      </button>
                      <button onClick={() => saveEdit(ev.id)} disabled={!editTitle.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                        <IconCheck className="w-3.5 h-3.5" />{t("save")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 truncate">{ev.title}</p>
                      {(ev.time || ev.location) && (
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {ev.time && (
                            <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                              <IconClock className="w-3 h-3" />{ev.time}
                            </span>
                          )}
                          {ev.location && (
                            ev.location_url ? (
                              <span
                                onClick={() => window.open(ev.location_url, "_blank")}
                                className="text-xs text-[#4D44CC] dark:text-[#8B85FF] underline cursor-pointer flex items-center gap-1"
                              >
                                <IconMapPin className="w-3 h-3" />{ev.location}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                                <IconMapPin className="w-3 h-3" />{ev.location}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button onClick={() => startEdit(ev)}
                        className="p-1 rounded-lg hover:bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF] transition">
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
      </div>

      {/* 일정 추가 폼 */}
      <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0">
        <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">{t("event_add_section")}</p>
        <input
          value={formTitle}
          onChange={e => setFormTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder={t("event_title_ph")}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        <div className="grid grid-cols-2 gap-2">
          <TimePickerInput value={formTime} onChange={setFormTime} />
          <LocationInput
            value={formLocation}
            onChange={setFormLocation}
            urlValue={formLocationUrl}
            onUrlChange={setFormLocationUrl}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <RepeatPicker
              value={formRepeat}
              onValueChange={(v) => { setFormRepeat(v); if (v === "none") setFormRepeatEnd(""); }}
              endDate={formRepeatEnd}
              onEndDateChange={setFormRepeatEnd}
            />
          </div>
          <button onClick={handleAdd} disabled={!formTitle.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 shrink-0"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
            <IconPlus className="w-4 h-4" />
            {t("add")}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">

      {confirmDeleteId && (
        <ConfirmModal
          message={t("confirm_delete_event")}
          onConfirm={doDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start">

        {/* 캘린더 카드 */}
        <div className="flex-1 w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} aria-label={t("cal_prev_month")}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
              <IconChevronLeft className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
            </button>
            <span className="text-base font-semibold text-slate-800 dark:text-zinc-100">
              {locale === "en" ? `${MONTH_NAMES[month]} ${year}` : `${year}년 ${MONTH_NAMES[month]}`}
            </span>
            <button onClick={nextMonth} aria-label={t("cal_next_month")}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
              <IconChevronRight className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className={`text-center text-xs font-medium py-1.5 ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-500 dark:text-zinc-400"
              }`}>{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} className="min-h-[88px]" />;
              const key     = toKey(year, month, day);
              const evts    = eventsOn(key);
              const isSel   = key === selected;
              const isToday = key === todayKey;
              const dow     = (firstDow + day - 1) % 7;
              const holiday = getHolidays(year)[key];
              const isSun   = dow === 0;
              const isSat   = dow === 6;
              return (
                <button key={idx} onClick={() => setSelected(prev => prev === key ? null : key)}
                  className={[
                    "flex flex-col items-center justify-start pt-1.5 pb-1 px-0.5 rounded-xl transition-all min-h-[88px]",
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
                      ? "text-[#4D44CC] dark:text-[#8B85FF]"
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

        {/* 사이드 패널 (sm 이상) */}
        <div
          className={[
            "hidden sm:flex flex-col self-stretch bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-[width,opacity] duration-300 ease-in-out",
            selected ? "w-[320px] opacity-100 p-5" : "w-0 opacity-0 overflow-hidden p-0 border-0",
          ].join(" ")}
        >
          {selected && sidePanelContent}
        </div>
      </div>

      {/* 선택 날짜 패널 (모바일) */}
      <div
        className="sm:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
        style={{ maxHeight: selected ? "1000px" : "0px", opacity: selected ? 1 : 0 }}
      >
        <div className="flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          {sidePanelContent}
        </div>
      </div>

      <HelpButton
        title={t("help_cal_title")}
        steps={[
          { step: t("date_select"), desc: t("help_cal_1") },
          { step: t("event_add_section"), desc: t("help_cal_2") },
          { step: t("location_ph"),       desc: t("help_cal_3") },
          { step: t("modify"),            desc: t("help_cal_4") },
          { step: locale === "en" ? "Navigate" : "월 이동", desc: t("help_cal_5") },
        ]}
      />
    </div>
  );
}
