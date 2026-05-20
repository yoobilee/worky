"use client";

import { useState, useEffect, useRef } from "react";
import {
  IconBuilding, IconPlus, IconPencil, IconTrash,
  IconUser, IconNotes, IconCalendar, IconArrowsSort,
  IconX, IconExternalLink, IconPhone,
  IconMessage, IconChevronDown, IconChevronUp,
  IconChevronLeft, IconChevronRight,
  IconCircleCheck, IconCircleX, IconClock, IconPlayerPlay,
} from "@tabler/icons-react";

/* ── 타입 ── */
type ReportStatus = "pending" | "inprogress" | "complete" | "stopped";
type DayStatus    = "done" | "failed";
type SortOrder    = "inprogress" | "pending" | "expiry" | "name";

interface HistoryEntry {
  date:   string;
  status: ReportStatus;
}

interface Client {
  id:             string;
  name:           string;
  status:         ReportStatus;
  contact:        string;
  phone:          string;
  link:           string;
  tags:           string[];
  contractStart:  string;
  contractDays:   number | null;
  reportTone:     string;
  memo:           string;
  statusHistory:  HistoryEntry[];
  dailyLog:       Record<string, DayStatus>;
  showGrassGrid:  boolean;
  createdAt:      number;
}

interface FormState {
  name:          string;
  status:        ReportStatus;
  contact:       string;
  phone:         string;
  link:          string;
  tagInput:      string;
  tags:          string[];
  contractStart: string;
  contractDays:  string;
  reportTone:    string;
  memo:          string;
  showGrassGrid: boolean;
}

/* ── 상수 ── */
const STORAGE_KEY    = "worky_clients";
const RESET_DATE_KEY = "worky_clients_reset_date";

const EMPTY_FORM: FormState = {
  name: "", status: "pending", contact: "", phone: "",
  link: "", tagInput: "", tags: [], contractStart: "",
  contractDays: "", reportTone: "", memo: "", showGrassGrid: false,
};

const STATUS_CONFIG: Record<ReportStatus, {
  label: string; textCls: string; bgCls: string; borderCls: string; hoverCls: string; barCls: string;
}> = {
  pending: {
    label:     "대기 중",
    textCls:   "text-slate-500 dark:text-slate-400",
    bgCls:     "bg-slate-100 dark:bg-zinc-800",
    borderCls: "border-slate-200 dark:border-zinc-700",
    hoverCls:  "hover:bg-slate-200 dark:hover:bg-zinc-700",
    barCls:    "bg-slate-300 dark:bg-zinc-600",
  },
  inprogress: {
    label:     "진행 중",
    textCls:   "text-blue-600 dark:text-blue-400",
    bgCls:     "bg-blue-100 dark:bg-blue-950/40",
    borderCls: "border-blue-200 dark:border-blue-800",
    hoverCls:  "hover:bg-blue-200 dark:hover:bg-blue-900/60",
    barCls:    "bg-blue-500",
  },
  complete: {
    label:     "완료",
    textCls:   "text-emerald-600 dark:text-emerald-400",
    bgCls:     "bg-emerald-100 dark:bg-emerald-950/40",
    borderCls: "border-emerald-200 dark:border-emerald-800",
    hoverCls:  "hover:bg-emerald-200 dark:hover:bg-emerald-900/60",
    barCls:    "bg-emerald-500",
  },
  stopped: {
    label:     "중단",
    textCls:   "text-red-500 dark:text-red-400",
    bgCls:     "bg-red-100 dark:bg-red-950/40",
    borderCls: "border-red-200 dark:border-red-800",
    hoverCls:  "hover:bg-red-200 dark:hover:bg-red-900/60",
    barCls:    "bg-red-400",
  },
};

const STATUS_ICONS: Record<ReportStatus, React.ReactNode> = {
  pending:    <IconClock        className="w-3.5 h-3.5 shrink-0" />,
  inprogress: <IconPlayerPlay   className="w-3.5 h-3.5 shrink-0" />,
  complete:   <IconCircleCheck  className="w-3.5 h-3.5 shrink-0" />,
  stopped:    <IconCircleX      className="w-3.5 h-3.5 shrink-0" />,
};

/* ── 헬퍼 ── */
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayKey(): string { return toDateKey(new Date()); }

function addBusinessDays(start: string, days: number): string {
  const d = new Date(start + "T00:00:00");
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return toDateKey(d);
}

function getContractEnd(c: Client): string | null {
  if (!c.contractStart || !c.contractDays) return null;
  return addBusinessDays(c.contractStart, c.contractDays);
}

function getDday(endDate: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const end   = new Date(endDate + "T00:00:00");
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function formatDday(dday: number): { text: string; cls: string } {
  if (dday < 0)   return { text: `D+${Math.abs(dday)}`, cls: "text-slate-400 dark:text-zinc-500" };
  if (dday === 0) return { text: "D-Day",                cls: "text-red-500 font-bold" };
  if (dday <= 3)  return { text: `D-${dday}`,            cls: "text-red-500 font-semibold" };
  if (dday <= 7)  return { text: `D-${dday}`,            cls: "text-orange-500 font-medium" };
  return               { text: `D-${dday}`,            cls: "text-slate-500 dark:text-zinc-400" };
}

function formatDate(s: string): string {
  const [y,m,d] = s.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

// 구형 데이터 마이그레이션
function normalize(raw: Record<string, unknown>): Client {
  // 구형 status 매핑
  let status = (raw.status as string) ?? "";
  if (status === "incomplete" || status === "") status = "pending";
  if (status === "failed")                      status = "stopped";
  if (!["pending","inprogress","complete","stopped"].includes(status)) status = "pending";
  if (!status && (raw.reportedToday as boolean)) status = "complete";

  const contractStart = (raw.contractStart as string) ?? "";
  const contractDays  = (raw.contractDays  as number) ?? null;

  return {
    id:            (raw.id   as string)  ?? crypto.randomUUID(),
    name:          (raw.name as string)  ?? "",
    status:        status as ReportStatus,
    contact:       (raw.contact    as string) ?? "",
    phone:         (raw.phone      as string) ?? "",
    link:          (raw.link       as string) ?? "",
    tags:          Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    contractStart,
    contractDays,
    reportTone:    (raw.reportTone as string) ?? "",
    memo:          (raw.memo       as string) ?? "",
    statusHistory: Array.isArray(raw.statusHistory)
      ? (raw.statusHistory as HistoryEntry[])
      : (Array.isArray(raw.reportHistory)
         ? (raw.reportHistory as string[]).map((d) => ({ date: d, status: "complete" as ReportStatus }))
         : []),
    dailyLog:      (raw.dailyLog as Record<string, DayStatus>) ?? {},
    showGrassGrid: (raw.showGrassGrid as boolean) ?? (!!contractStart && !!contractDays),
    createdAt:     (raw.createdAt as number) ?? Date.now(),
  };
}

function loadClients(): Client[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return (JSON.parse(data) as Record<string, unknown>[]).map(normalize);
  } catch { return []; }
}

function saveClients(clients: Client[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

/* ── 잔디밭 그리드 (가로 흐름) ── */
function GrassGrid({
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

  const allDates: string[] = [];
  const cur = new Date(contractStart + "T00:00:00");
  const end = new Date(contractEnd   + "T00:00:00");
  while (cur <= end) {
    allDates.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }

  // 누적 완료 수 (done 날짜 카운트)
  let cumDone = 0;
  const cumMap: Record<string, number> = {};
  for (const d of allDates) {
    if (dailyLog[d] === "done") cumDone++;
    cumMap[d] = cumDone;
  }

  return (
    <div>
      {/* 날짜 칸 (가로 흐름, 자동 줄바꿈) */}
      <div className="flex flex-wrap gap-0.5">
        {allDates.map((date) => {
          const ds       = dailyLog[date];
          const isFuture = date > today;
          const isToday  = date === today;
          const count    = ds === "done" ? cumMap[date] : 0;
          return (
            <button
              key={date}
              type="button"
              onClick={() => { if (!isFuture) onToggle(date); }}
              title={`${date}${ds === "done" ? ` · 누적 ${count}일` : ds === "failed" ? " · 미달성" : ""}`}
              className={[
                "w-4 h-4 rounded-sm transition-all flex items-center justify-center shrink-0",
                isToday  ? "ring-1 ring-[#6C63FF] ring-offset-1" : "",
                isFuture ? "opacity-25 cursor-not-allowed" : "cursor-pointer hover:opacity-80",
                ds === "done"   ? "bg-emerald-500"
                : ds === "failed" ? "bg-red-400"
                : "bg-slate-200 dark:bg-zinc-700",
              ].join(" ")}
            >
              {ds === "done" && (
                <span className="text-[6px] font-bold text-white leading-none">{count}</span>
              )}
            </button>
          );
        })}
      </div>
      {/* 범례 */}
      <div className="flex items-center gap-3 mt-2">
        {[
          { cls: "bg-emerald-500",                       label: "완료" },
          { cls: "bg-red-400",                           label: "미달성" },
          { cls: "bg-slate-200 dark:bg-zinc-700",        label: "미확인" },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${cls}`} />
            <span className="text-[9px] text-slate-400 dark:text-zinc-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 커스텀 날짜 피커 ── */
const PICKER_DAYS   = ["일","월","화","수","목","금","토"];
const PICKER_MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function DatePickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
    if (!value) return "날짜 선택";
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

/* ── 메인 컴포넌트 ── */
export default function ClientManager() {
  const [clients,           setClients]           = useState<Client[]>([]);
  const [hydrated,          setHydrated]          = useState(false);
  const [sortOrder,         setSortOrder]         = useState<SortOrder>("inprogress");
  const [showForm,          setShowForm]          = useState(false);
  const [editingId,         setEditingId]         = useState<string | null>(null);
  const [form,              setForm]              = useState<FormState>(EMPTY_FORM);
  const [expandedHistories, setExpandedHistories] = useState<Set<string>>(new Set());
  const [openStatusId,      setOpenStatusId]      = useState<string | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = todayKey();
    let cls = loadClients();
    const lastReset = localStorage.getItem(RESET_DATE_KEY);
    if (lastReset !== today) {
      // 완료 → 대기 중으로 리셋 (진행 중/중단은 유지)
      cls = cls.map((c) =>
        c.status === "complete" ? { ...c, status: "pending" as ReportStatus } : c
      );
      saveClients(cls);
      localStorage.setItem(RESET_DATE_KEY, today);
    }
    setClients(cls);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!openStatusId) return;
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node))
        setOpenStatusId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openStatusId]);

  const setStatus = (id: string, newStatus: ReportStatus) => {
    const today = todayKey();
    setClients((prev) => {
      const updated = prev.map((c) =>
        c.id !== id ? c : {
          ...c, status: newStatus,
          statusHistory: [...c.statusHistory, { date: today, status: newStatus }],
        }
      );
      saveClients(updated);
      return updated;
    });
    setOpenStatusId(null);
  };

  const toggleDailyLog = (clientId: string, date: string) => {
    setClients((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== clientId) return c;
        const log = { ...c.dailyLog };
        if (!log[date])           log[date] = "done";
        else if (log[date] === "done")   log[date] = "failed";
        else                            delete log[date];
        return { ...c, dailyLog: log };
      });
      saveClients(updated);
      return updated;
    });
  };

  const commitTag = () => {
    const tag = form.tagInput.trim().replace(/,+$/, "");
    if (!tag || form.tags.includes(tag)) { setForm((f) => ({ ...f, tagInput: "" })); return; }
    setForm((f) => ({ ...f, tags: [...f.tags, tag], tagInput: "" }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const base = {
      name:          form.name.trim(),
      status:        form.status,
      contact:       form.contact.trim(),
      phone:         form.phone.trim(),
      link:          form.link.trim(),
      tags:          form.tags,
      contractStart: form.contractStart,
      contractDays:  form.contractDays ? Number(form.contractDays) : null,
      reportTone:    form.reportTone.trim(),
      memo:          form.memo.trim(),
      showGrassGrid: form.showGrassGrid,
    };
    setClients((prev) => {
      const updated = editingId
        ? prev.map((c) => c.id !== editingId ? c : { ...c, ...base })
        : [...prev, { ...base, id: crypto.randomUUID(), statusHistory: [], dailyLog: {}, createdAt: Date.now() }];
      saveClients(updated);
      return updated;
    });
    closeForm();
  };

  const startEdit = (c: Client) => {
    setEditingId(c.id);
    setForm({
      name: c.name, status: c.status, contact: c.contact, phone: c.phone,
      link: c.link, tagInput: "", tags: [...c.tags],
      contractStart: c.contractStart, contractDays: c.contractDays != null ? String(c.contractDays) : "",
      reportTone: c.reportTone, memo: c.memo,
      showGrassGrid: c.showGrassGrid ?? (!!c.contractStart && !!c.contractDays),
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("이 거래처를 삭제할까요?")) return;
    setClients((prev) => { const u = prev.filter((c) => c.id !== id); saveClients(u); return u; });
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); };

  const toggleHistory = (id: string) =>
    setExpandedHistories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // 계약 필드 변경 시 잔디밭 체크박스 자동 활성
  const handleContractChange = (field: "contractStart" | "contractDays", value: string) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      const bothFilled = !!next.contractStart && !!next.contractDays;
      if (bothFilled && !f.showGrassGrid) next.showGrassGrid = true;
      return next;
    });
  };

  const sorted = [...clients].sort((a, b) => {
    if (sortOrder === "inprogress") {
      const order: Record<ReportStatus, number> = { inprogress: 0, pending: 1, stopped: 2, complete: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    }
    if (sortOrder === "pending") {
      const order: Record<ReportStatus, number> = { pending: 0, inprogress: 1, stopped: 2, complete: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    }
    if (sortOrder === "expiry") {
      const ea = getContractEnd(a), eb = getContractEnd(b);
      if (!ea && !eb) return a.name.localeCompare(b.name, "ko");
      if (!ea) return 1; if (!eb) return -1;
      if (ea !== eb) return ea.localeCompare(eb);
    }
    return a.name.localeCompare(b.name, "ko");
  });

  const total       = clients.length;
  const cComplete   = clients.filter((c) => c.status === "complete").length;
  const cInprogress = clients.filter((c) => c.status === "inprogress").length;
  const cStopped    = clients.filter((c) => c.status === "stopped").length;
  const cPending    = total - cComplete - cInprogress - cStopped;

  const contractEndPreview =
    form.contractStart && form.contractDays
      ? addBusinessDays(form.contractStart, Number(form.contractDays))
      : null;

  if (!hydrated) return null;

  const SORT_LABELS: Record<SortOrder, string> = {
    inprogress: "진행 중 우선",
    pending:    "대기 중 우선",
    expiry:     "만료 임박순",
    name:       "거래처명순",
  };
  const SORT_CYCLE: SortOrder[] = ["inprogress", "pending", "expiry", "name"];

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">거래처 목록</h2>
          <span className="text-xs text-slate-400 dark:text-zinc-500">총 {total}개</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortOrder((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s)+1)%SORT_CYCLE.length])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
          >
            <IconArrowsSort className="w-3.5 h-3.5" />{SORT_LABELS[sortOrder]}
          </button>
          <button
            onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            <IconPlus className="w-4 h-4" />거래처 추가
          </button>
        </div>
      </div>

      {/* 추가/수정 폼 */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-[#6C63FF]/40 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
              {editingId ? "거래처 수정" : "새 거래처 추가"}
            </h3>
            <button onClick={closeForm} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
              <IconX className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* 거래처명 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                거래처명 <span className="text-red-400">*</span>
              </label>
              <input autoFocus value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="(주)워키코퍼레이션"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>

            {/* 상태 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">
                보고/업무 상태 <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {(["pending","inprogress","complete","stopped"] as ReportStatus[]).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const active = form.status === s;
                  return (
                    <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={[
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                        active
                          ? `${cfg.bgCls} ${cfg.borderCls} ${cfg.textCls}`
                          : "border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800",
                      ].join(" ")}
                    >
                      {STATUS_ICONS[s]}{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 담당자 + 연락처 */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">담당자명</label>
                <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  placeholder="홍길동 과장"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">연락처</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                />
              </div>
            </div>

            {/* 링크 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">링크 (URL)</label>
              <input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="https://example.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>

            {/* 태그 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">태그/키워드</label>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map((t) => (
                    <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#6C63FF]/10 text-[#6C63FF]">
                      {t}
                      <button type="button" onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))}>
                        <IconX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input value={form.tagInput}
                onChange={(e) => setForm((f) => ({ ...f, tagInput: e.target.value }))}
                onKeyDown={(e) => { if (e.key==="Enter"||e.key===",") { e.preventDefault(); commitTag(); } }}
                onBlur={commitTag}
                placeholder="태그 입력 후 Enter (예: 신규, VIP)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>

            {/* 계약 시작일 + 기간 + 잔디밭 체크박스 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-zinc-400">계약 정보</label>
                {/* 진행 현황 체크박스 */}
                <button
                  type="button"
                  disabled={!form.contractStart || !form.contractDays}
                  onClick={() => setForm((f) => ({ ...f, showGrassGrid: !f.showGrassGrid }))}
                  className={`flex items-center gap-1.5 text-xs ${(!form.contractStart || !form.contractDays) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className={[
                    "w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                    form.showGrassGrid ? "bg-[#6C63FF] border-[#6C63FF]" : "border-slate-300 dark:border-zinc-600",
                  ].join(" ")}>
                    {form.showGrassGrid && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </span>
                  <span className="text-slate-500 dark:text-zinc-400">진행 현황</span>
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <DatePickerInput
                    value={form.contractStart}
                    onChange={(v) => handleContractChange("contractStart", v)}
                  />
                </div>
                <div>
                  <input type="number" min="1" value={form.contractDays}
                    onChange={(e) => handleContractChange("contractDays", e.target.value)}
                    placeholder="계약 기간 (영업일, 예: 30)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                  />
                </div>
              </div>
              {contractEndPreview && (
                <p className="text-xs text-[#6C63FF] mt-1.5">
                  만료 예정일: {formatDate(contractEndPreview)}
                </p>
              )}
            </div>

            {/* 보고 메시지 톤 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">보고 메시지 톤/선호사항</label>
              <input value={form.reportTone} onChange={(e) => setForm((f) => ({ ...f, reportTone: e.target.value }))}
                placeholder="예: 간결하게, 수치 중심, 정중한 어투"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">메모</label>
              <textarea value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                rows={2} placeholder="주요 관심사, 특이사항 등"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={closeForm}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
              취소
            </button>
            <button onClick={handleSave} disabled={!form.name.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
              {editingId ? "수정 완료" : "추가"}
            </button>
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm px-1 py-1">
        <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-zinc-800">
          {[
            { label: "전체",   value: total,       cls: "text-slate-800 dark:text-slate-100" },
            { label: "진행 중", value: cInprogress, cls: "text-blue-500" },
            { label: "완료",   value: cComplete,   cls: "text-emerald-500" },
            { label: "중단",   value: cStopped,    cls: "text-red-400" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="px-5 py-4">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
        {/* 스택 프로그레스바 */}
        <div className="mx-4 mb-3 h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden flex">
          {total === 0 ? <div className="w-full" /> : (
            <>
              <div style={{ width: `${(cComplete  /total)*100}%` }} className="bg-emerald-500 transition-all duration-500" />
              <div style={{ width: `${(cInprogress/total)*100}%` }} className="bg-blue-500   transition-all duration-500" />
              <div style={{ width: `${(cStopped   /total)*100}%` }} className="bg-red-400    transition-all duration-500" />
              <div style={{ width: `${(cPending   /total)*100}%` }} className="bg-slate-300 dark:bg-zinc-600 transition-all duration-500" />
            </>
          )}
        </div>
      </div>

      {/* 거래처 카드 그리드 */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-zinc-600">
          <IconBuilding className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium text-slate-400 dark:text-zinc-500">등록된 거래처가 없습니다</p>
          <p className="text-xs text-slate-300 dark:text-zinc-600 mt-1">위 버튼을 눌러 거래처를 추가하세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((c) => {
            const cfg         = STATUS_CONFIG[c.status];
            const contractEnd = getContractEnd(c);
            const dday        = contractEnd ? getDday(contractEnd) : null;
            const ddayFmt     = dday != null ? formatDday(dday) : null;
            const histOpen    = expandedHistories.has(c.id);
            const showGrass   = c.status === "inprogress" && c.showGrassGrid && !!c.contractStart && !!contractEnd;

            return (
              <div key={c.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-2.5 group"
              >
                {/* 헤더: 거래처명 + 상태 드롭다운 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">{c.name}</p>
                    {c.contact && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <IconUser className="w-3 h-3 text-slate-400 shrink-0" />
                        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{c.contact}</p>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <IconPhone className="w-3 h-3 text-slate-400 shrink-0" />
                        <p className="text-xs text-slate-500 dark:text-zinc-400">{c.phone}</p>
                      </div>
                    )}
                  </div>
                  <div className="relative shrink-0" ref={openStatusId === c.id ? statusDropdownRef : null}>
                    <button
                      onClick={() => setOpenStatusId((prev) => prev === c.id ? null : c.id)}
                      className={[
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer active:scale-95",
                        cfg.bgCls, cfg.borderCls, cfg.textCls, cfg.hoverCls,
                      ].join(" ")}
                    >
                      {STATUS_ICONS[c.status]}{cfg.label}
                    </button>
                    {openStatusId === c.id && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg overflow-hidden min-w-[110px]">
                        {(["pending","inprogress","complete","stopped"] as ReportStatus[]).map((s) => {
                          const sc = STATUS_CONFIG[s];
                          return (
                            <button key={s} onClick={() => setStatus(c.id, s)}
                              className={[
                                "flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold transition-colors",
                                c.status === s ? `${sc.bgCls} ${sc.textCls}` : "text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800",
                              ].join(" ")}
                            >
                              {STATUS_ICONS[s]}{sc.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 태그 */}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6C63FF]/10 text-[#6C63FF]">{t}</span>
                    ))}
                  </div>
                )}

                {/* 메모 */}
                {c.memo && (
                  <div className="flex items-start gap-1.5">
                    <IconNotes className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">{c.memo}</p>
                  </div>
                )}

                {/* 보고 메시지 톤 */}
                {c.reportTone && (
                  <div className="flex items-start gap-1.5">
                    <IconMessage className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{c.reportTone}</p>
                  </div>
                )}

                {/* 계약 D-day */}
                {contractEnd && ddayFmt && (
                  <div className="flex items-center gap-1.5">
                    <IconCalendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{formatDate(contractEnd)}</p>
                    <span className={`text-xs font-medium ml-auto ${ddayFmt.cls}`}>{ddayFmt.text}</span>
                  </div>
                )}

                {/* 잔디밭 */}
                {showGrass && (
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">진행 현황</p>
                    <GrassGrid
                      contractStart={c.contractStart}
                      contractEnd={contractEnd!}
                      dailyLog={c.dailyLog}
                      onToggle={(date) => toggleDailyLog(c.id, date)}
                    />
                  </div>
                )}

                {/* 링크 */}
                {c.link && (
                  <a href={c.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#6C63FF] hover:text-[#8B85FF] transition w-fit"
                  >
                    <IconExternalLink className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[160px]">{c.link.replace(/^https?:\/\//, "")}</span>
                  </a>
                )}

                {/* 히스토리 토글 */}
                {c.statusHistory.length > 0 && (
                  <div>
                    <button onClick={() => toggleHistory(c.id)}
                      className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition">
                      {histOpen ? <IconChevronUp className="w-3.5 h-3.5" /> : <IconChevronDown className="w-3.5 h-3.5" />}
                      히스토리 {c.statusHistory.length}건
                    </button>
                    {histOpen && (
                      <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto pl-1">
                        {[...c.statusHistory].reverse().map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={STATUS_CONFIG[h.status]?.textCls ?? "text-slate-400"}>{STATUS_CONFIG[h.status]?.label ?? h.status}</span>
                            <span className="text-slate-400 dark:text-zinc-500">{formatDate(h.date)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 수정/삭제 (호버 시 노출) */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button onClick={() => startEdit(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                    <IconPencil className="w-3.5 h-3.5" />수정
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 transition">
                    <IconTrash className="w-3.5 h-3.5" />삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
