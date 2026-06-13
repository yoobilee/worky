"use client";


import HelpButton from "./HelpButton";
import { Fragment, useState, useEffect, useRef } from "react";
import ConfirmModal from "./ConfirmModal";
import {
  IconBuilding, IconPlus, IconPencil, IconTrash,
  IconUser, IconNotes, IconCalendar, IconCalendarPlus, IconCalendarX, IconArrowsSort,
  IconX, IconExternalLink, IconPhone,
  IconMessage, IconChevronDown, IconChevronUp,
  IconChevronLeft, IconChevronRight,
  IconCircleCheck, IconCircleX, IconClock, IconPlayerPlay,
  IconLayoutGrid, IconLayoutList, IconLayoutSidebarRight, IconCheck, IconSearch,
  IconEye, IconEyeOff, IconTag,
} from "@tabler/icons-react";
import { useTheme } from "./ThemeProvider";
import { createClient } from "@/lib/supabase/client";
import {
  getClients as getDbClients, addClient as addDbClient,
  updateClient as updateDbClient, deleteClient as deleteDbClient,
  type DbClient,
} from "@/lib/db/clients";
import { getSettings, upsertSettings } from "@/lib/db/settings";

/* ── 타입 ── */
type ReportStatus = "pending" | "inprogress" | "complete" | "stopped";
type DayStatus    = "done" | "failed";
type SortOrder    = "status" | "expiry" | "contractStart_asc" | "contractStart_desc" | "name_asc" | "name_desc" | "contact_asc" | "contact_desc";

interface HistoryEntry {
  date:   string;
  status: ReportStatus;
}

interface CustomField {
  key:    string;
  value:  string;
  masked: boolean;
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
  maskPhone:      boolean;
  companyPhone:     string;
  maskCompanyPhone: boolean;
  customFields:   CustomField[];
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
  maskPhone:     boolean;
  companyPhone:     string;
  maskCompanyPhone: boolean;
  customFields:   CustomField[];
}

/* ── 상수 ── */
const RESET_DATE_KEY = "worky_clients_reset_date";
const VIEW_MODE_KEY  = "worky_clients_view";
const GRASS_PANEL_KEY = "worky_grass_panel";

type ViewMode = "grid" | "list";

const EMPTY_FORM: FormState = {
  name: "", status: "pending", contact: "", phone: "",
  link: "", tagInput: "", tags: [], contractStart: "",
  contractDays: "", reportTone: "", memo: "", showGrassGrid: false, maskPhone: false,
  companyPhone: "", maskCompanyPhone: false,
  customFields: [],
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

const fmtShort = (s: string) => {
  const [y, m, d] = s.split("-");
  return `'${y.slice(2)}.${m}.${d}`;
};

const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  if (digits.length === 10) {
    if (digits.startsWith("02")) return `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6)}`;
    return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9 && digits.startsWith("02")) return `${digits.slice(0,2)}-${digits.slice(2,5)}-${digits.slice(5)}`;
  if (digits.length === 8) return `${digits.slice(0,4)}-${digits.slice(4)}`;
  return phone;
};

const maskPhoneNum = (phone: string) => {
  const formatted = formatPhone(phone);
  const parts = formatted.split("-");
  if (parts.length === 3) return `${parts[0]}-****-${parts[2]}`;
  if (parts.length === 2) return `${parts[0]}-****`;
  return formatted;
};

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
    maskPhone:     (raw.maskPhone as boolean) ?? false,
    companyPhone:     (raw.companyPhone as string) ?? "",
    maskCompanyPhone: (raw.maskCompanyPhone as boolean) ?? false,
    customFields:  Array.isArray(raw.customFields) ? (raw.customFields as CustomField[]) : [],
    createdAt:     (raw.createdAt as number) ?? Date.now(),
  };
}

function dbToClient(row: DbClient): Client {
  return normalize({
    id:            row.id,
    name:          row.name,
    status:        row.status,
    contact:       row.contact_person,
    phone:         row.phone,
    link:          row.link,
    tags:          row.tags,
    contractStart: row.contract_start ?? "",
    contractDays:  row.contract_days,
    reportTone:    row.report_tone ?? "",
    memo:          row.memo,
    statusHistory: row.history,
    dailyLog:      row.progress as Record<string, DayStatus>,
    showGrassGrid: row.show_grass_grid,
    maskPhone:     row.mask_phone ?? false,
    companyPhone:     row.company_phone ?? "",
    maskCompanyPhone: row.mask_company_phone ?? false,
    customFields:  row.custom_fields ?? [],
    createdAt:     row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  });
}

function clientToDb(c: Omit<Client, "id" | "createdAt">): Omit<DbClient, "id" | "created_at"> {
  return {
    name:            c.name,
    status:          c.status,
    contact_person:  c.contact,
    phone:           c.phone,
    link:            c.link,
    tags:            c.tags,
    contract_start:  c.contractStart || null,
    contract_days:   c.contractDays,
    report_tone:     c.reportTone,
    memo:            c.memo,
    history:         c.statusHistory as unknown[],
    progress:        c.dailyLog as Record<string, string>,
    show_grass_grid: c.showGrassGrid,
    mask_phone:      c.maskPhone,
    company_phone:      c.companyPhone,
    mask_company_phone: c.maskCompanyPhone,
    custom_fields:      c.customFields,
  };
}

/* ── 한국 공휴일 (2026) ── */
const GRASS_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "크리스마스",
};

function isOffDay(dateKey: string): boolean {
  if (GRASS_HOLIDAYS[dateKey]) return true;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

/* ── 미니 잔디밭 (목록형 뷰: 이번 주만 표시) ── */
function MiniGrassGrid({
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
                isToday ? "text-[#6C63FF] dark:text-[#a99dff] font-bold" : "text-slate-400 dark:text-zinc-300",
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
          className="w-4 h-4 p-0.5 shrink-0 text-slate-400 dark:text-zinc-300 disabled:opacity-25 disabled:cursor-not-allowed hover:text-[#6C63FF] transition-colors"
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
          className="w-4 h-4 p-0.5 shrink-0 text-slate-400 dark:text-zinc-300 disabled:opacity-25 disabled:cursor-not-allowed hover:text-[#6C63FF] transition-colors"
        >
          <IconChevronRight className="w-full h-full" />
        </button>
      </div>
    </div>
  );
}

/* ── 잔디밭 그리드 (주 단위 네비게이션) ── */
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

  function addDays(dateKey: string, n: number): string {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + n);
    return toDateKey(d);
  }

  // 주의 시작일 계산 (일요일 기준)
  function getWeekStartOf(dateKey: string): string {
    const d = new Date(dateKey + "T00:00:00");
    const offset = d.getDay();
    d.setDate(d.getDate() - offset);
    return toDateKey(d);
  }

  const startWeek = getWeekStartOf(contractStart);
  const endWeek   = getWeekStartOf(contractEnd);

  // 초기 주: 오늘이 계약 기간 내면 오늘의 주, 아니면 시작 주
  const initWeek = today >= contractStart && today <= contractEnd
    ? getWeekStartOf(today)
    : startWeek;

  const [weekStart, setWeekStart] = useState(initWeek);

  const canPrev = weekStart > startWeek;
  const canNext = weekStart < endWeek;

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // 전체 날짜 (누적 회차 + 통계 계산용)
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

  // 네비게이션 헤더 날짜 범위 레이블
  const [, ws_m, ws_d] = weekStart.split("-").map(Number);
  const weekEndDate = addDays(weekStart, 6);
  const [, we_m, we_d] = weekEndDate.split("-").map(Number);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* 네비게이션 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="p-1 rounded-lg disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-slate-400 dark:text-zinc-300"
        >
          <IconChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-300">
          {ws_m}/{ws_d} – {we_m}/{we_d}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="p-1 rounded-lg disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-slate-400 dark:text-zinc-300"
        >
          <IconChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 7일 셀 */}
      <div className="flex gap-1.5 justify-between">
        {weekDates.map((date) => {
          // 계약 범위 밖 — 빈 자리 유지
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
          const holidayName = GRASS_HOLIDAYS[date];
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
            : off   ? "text-slate-400 dark:text-zinc-600"
            :         "text-slate-400 dark:text-zinc-300",
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
          { cls: "bg-emerald-500",                              label: "완료",   count: statDone,   showCount: true  },
          { cls: "bg-red-400",                                  label: "실패",   count: statFailed, showCount: true  },
          { cls: "bg-slate-200 dark:bg-zinc-700",               label: "미확인", count: statNone,   showCount: true  },
          { cls: "bg-slate-200 dark:bg-zinc-700 opacity-40",    label: "휴일",   count: 0,          showCount: false },
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
  const [userId,            setUserId]            = useState<string | null>(null);
  const [sortOrder,         setSortOrder]         = useState<SortOrder>("status");
  const [showForm,          setShowForm]          = useState(false);
  const [editingId,         setEditingId]         = useState<string | null>(null);
  const [form,              setForm]              = useState<FormState>(EMPTY_FORM);
  const [expandedHistories, setExpandedHistories] = useState<Set<string>>(new Set());
  const [expandedGrass,     setExpandedGrass]     = useState<Set<string>>(new Set());
  const [openStatusId,      setOpenStatusId]      = useState<string | null>(null);
  const [dropdownPos,       setDropdownPos]       = useState<{ top: number; right: number } | null>(null);
  const [confirmDeleteId,   setConfirmDeleteId]   = useState<string | null>(null);
  const [viewMode,          setViewMode]          = useState<ViewMode>("grid");
  const [showGrassPanel,    setShowGrassPanel]    = useState(false);
  const [listEditMode,      setListEditMode]      = useState<"none" | "edit">("none");
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; id: string; type: "name" | "memo" | "tone" } | null>(null);
  const [revealingPhoneId, setRevealingPhoneId] = useState<string | null>(null);
  const [revealingCompanyPhoneId, setRevealingCompanyPhoneId] = useState<string | null>(null);
  const [savedCustomKeys, setSavedCustomKeys] = useState<string[]>([]);
  const [revealingCustomField, setRevealingCustomField] = useState<{ clientId: string; key: string } | null>(null);
  const [customPopover, setCustomPopover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [focusedCustomKeyIdx, setFocusedCustomKeyIdx] = useState<number | null>(null);
  const nameRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const memoRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const toneRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const [hoveredMemoIdBox,  setHoveredMemoIdBox]  = useState<string | null>(null);
  const memoBoxRefs = useRef<Map<string, HTMLParagraphElement>>(new Map());
  const [hoveredToneIdBox,  setHoveredToneIdBox]  = useState<string | null>(null);
  const toneBoxRefs = useRef<Map<string, HTMLParagraphElement>>(new Map());
  const [searchQuery,      setSearchQuery]        = useState("");
  const [sortDropdownOpen, setSortDropdownOpen]   = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [hoveredTagId,      setHoveredTagId]      = useState<string | null>(null);
  const [tagTooltipAlign,   setTagTooltipAlign]   = useState<"left" | "right">("left");
  const [hoveredRowId,      setHoveredRowId]      = useState<string | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const getRowBg = (idx: number, isHovered: boolean) => isHovered
    ? "rgba(108,99,255,0.05)"
    : idx % 2 === 0
      ? (isDark ? "#18181b" : "#ffffff")
      : (isDark ? "#27272a" : "#f8fafc");
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const customPopoverRef = useRef<HTMLDivElement>(null);

  /* 가로 스크롤 드래그 */
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, hasMoved: false });
  const [isDragging, setIsDragging] = useState(false);

  const handleScrollMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tableScrollRef.current;
    if (!el) return;
    dragStateRef.current.isDown = true;
    dragStateRef.current.hasMoved = false;
    dragStateRef.current.startX = e.pageX - el.offsetLeft;
    dragStateRef.current.scrollLeft = el.scrollLeft;
    setIsDragging(true);
  };
  const handleScrollMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tableScrollRef.current;
    if (!el || !dragStateRef.current.isDown) return;
    e.preventDefault();
    dragStateRef.current.hasMoved = true;
    const x = e.pageX - el.offsetLeft;
    const walk = x - dragStateRef.current.startX;
    el.scrollLeft = dragStateRef.current.scrollLeft - walk;
  };
  const handleScrollMouseUp = () => {
    dragStateRef.current.isDown = false;
    setIsDragging(false);
  };
  const handleScrollClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragStateRef.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragStateRef.current.hasMoved = false;
  };
  const handleScrollWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = tableScrollRef.current;
    if (!el) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        let rows = await getDbClients(uid);
        const today = todayKey();
        const lastReset = localStorage.getItem(RESET_DATE_KEY);
        if (lastReset !== today) {
          // 완료 → 대기 중으로 일괄 리셋
          const toReset = rows.filter((r) => r.status === "complete");
          for (const r of toReset) {
            await updateDbClient(r.id, { status: "pending" });
          }
          if (toReset.length > 0) rows = await getDbClients(uid);
          localStorage.setItem(RESET_DATE_KEY, today);
        }
        setClients(rows.map(dbToClient));
        const settings = await getSettings(uid);
        if (settings?.custom_field_keys) setSavedCustomKeys(settings.custom_field_keys);
      }
      const savedView = localStorage.getItem(VIEW_MODE_KEY);
      if (savedView === "grid" || savedView === "list") setViewMode(savedView);
      const savedGrassPanel = localStorage.getItem(GRASS_PANEL_KEY);
      if (savedGrassPanel === "true") setShowGrassPanel(true);
      setHydrated(true);
    });
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [listEditMode]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const doBulkDelete = async () => {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => deleteDbClient(id)));
    setClients((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  };

  useEffect(() => {
    if (!openStatusId) return;
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node))
        setOpenStatusId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openStatusId]);

  useEffect(() => {
    if (!customPopover) return;
    const handler = (e: PointerEvent) => {
      if (customPopoverRef.current && !customPopoverRef.current.contains(e.target as Node))
        setCustomPopover(null);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [customPopover]);

  const setStatus = (id: string, newStatus: ReportStatus) => {
    const today = todayKey();
    setClients((prev) => {
      const updated = prev.map((c) =>
        c.id !== id ? c : {
          ...c, status: newStatus,
          statusHistory: [...c.statusHistory, { date: today, status: newStatus }],
        }
      );
      const c = updated.find((x) => x.id === id);
      if (c) updateDbClient(id, { status: newStatus, history: c.statusHistory as unknown[] }).catch(() => {});
      return updated;
    });
    setOpenStatusId(null);
  };

  const toggleDailyLog = (clientId: string, date: string) => {
    setClients((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== clientId) return c;
        const log = { ...c.dailyLog };
        if (!log[date])                log[date] = "done";
        else if (log[date] === "done") log[date] = "failed";
        else                           delete log[date];
        updateDbClient(clientId, { progress: log as Record<string, string> }).catch(() => {});
        return { ...c, dailyLog: log };
      });
      return updated;
    });
  };

  const commitTag = () => {
    const tag = form.tagInput.trim().replace(/,+$/, "");
    if (!tag || form.tags.includes(tag)) { setForm((f) => ({ ...f, tagInput: "" })); return; }
    setForm((f) => ({ ...f, tags: [...f.tags, tag], tagInput: "" }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !userId) return;
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
      maskPhone:     form.maskPhone,
      companyPhone:     form.companyPhone.trim(),
      maskCompanyPhone: form.maskCompanyPhone,
      customFields:  form.customFields
        .map((f) => ({ key: f.key.trim(), value: f.value.trim(), masked: f.masked }))
        .filter((f) => f.key),
    };

    const newKeys = base.customFields
      .map((f) => f.key)
      .filter((key) => !savedCustomKeys.includes(key));
    if (newKeys.length > 0) {
      const updatedKeys = [...savedCustomKeys, ...newKeys];
      setSavedCustomKeys(updatedKeys);
      upsertSettings(userId, { custom_field_keys: updatedKeys }).catch(() => {});
    }

    if (editingId) {
      const existing = clients.find((c) => c.id === editingId);
      if (!existing) { closeForm(); return; }
      const updated = { ...existing, ...base };
      await updateDbClient(editingId, clientToDb(updated));
      setClients((prev) => prev.map((c) => c.id !== editingId ? c : updated));
    } else {
      const dbRow = await addDbClient(userId, {
        ...clientToDb({ ...base, statusHistory: [], dailyLog: {} }),
      });
      if (dbRow) setClients((prev) => [...prev, dbToClient(dbRow)]);
    }
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
      maskPhone: c.maskPhone,
      companyPhone: c.companyPhone,
      maskCompanyPhone: c.maskCompanyPhone,
      customFields: c.customFields.map((f) => ({ ...f })),
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);
  const doDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteDbClient(confirmDeleteId);
    setClients((prev) => prev.filter((c) => c.id !== confirmDeleteId));
    setConfirmDeleteId(null);
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
    if (sortOrder === "status") {
      const order: Record<ReportStatus, number> = { inprogress: 0, pending: 1, stopped: 2, complete: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.name.localeCompare(b.name, "ko");
    }
    if (sortOrder === "expiry") {
      const ea = getContractEnd(a), eb = getContractEnd(b);
      if (!ea && !eb) return a.name.localeCompare(b.name, "ko");
      if (!ea) return 1; if (!eb) return -1;
      if (ea !== eb) return ea.localeCompare(eb);
      return a.name.localeCompare(b.name, "ko");
    }
    if (sortOrder === "contractStart_asc" || sortOrder === "contractStart_desc") {
      const sa = a.contractStart, sb = b.contractStart;
      if (!sa && !sb) return a.name.localeCompare(b.name, "ko");
      if (!sa) return 1; if (!sb) return -1;
      if (sa !== sb) return sortOrder === "contractStart_asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
      return a.name.localeCompare(b.name, "ko");
    }
    if (sortOrder === "name_asc") return a.name.localeCompare(b.name, "ko");
    if (sortOrder === "name_desc") return b.name.localeCompare(a.name, "ko");
    if (sortOrder === "contact_asc" || sortOrder === "contact_desc") {
      const ca = a.contact, cb = b.contact;
      if (!ca && !cb) return a.name.localeCompare(b.name, "ko");
      if (!ca) return 1; if (!cb) return -1;
      if (ca !== cb) return sortOrder === "contact_asc" ? ca.localeCompare(cb, "ko") : cb.localeCompare(ca, "ko");
      return a.name.localeCompare(b.name, "ko");
    }
    return a.name.localeCompare(b.name, "ko");
  });

  const filtered = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => {
      const fields = [
        c.name, c.contact, c.phone, c.tags.join(" "), c.memo, c.reportTone, c.link,
      ];
      return fields.some((f) => (f ?? "").toLowerCase().includes(q));
    });
  })();

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
    status:             "상태순",
    expiry:             "만료 임박순",
    contractStart_asc:  "계약 시작일 ↑",
    contractStart_desc: "계약 시작일 ↓",
    name_asc:           "거래처명 ↑",
    name_desc:          "거래처명 ↓",
    contact_asc:        "담당자 ↑",
    contact_desc:       "담당자 ↓",
  };

  const confirmDeleteName = clients.find((c) => c.id === confirmDeleteId)?.name ?? "";

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full">

      {confirmDeleteId && (
        <ConfirmModal
          message={`'${confirmDeleteName}'을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* 목록형 셀 호버 툴팁 (fixed) */}
      {tooltipPos && (() => {
        const text = tooltipPos.type === "name"
          ? filtered.find((c) => c.id === tooltipPos.id)?.name
          : tooltipPos.type === "memo"
          ? filtered.find((c) => c.id === tooltipPos.id)?.memo
          : filtered.find((c) => c.id === tooltipPos.id)?.reportTone;
        if (!text) return null;
        return (
          <div
            style={{ position: "fixed", left: tooltipPos.x, top: tooltipPos.y - 6, transform: "translateY(-100%)" }}
            className={[
              "z-[9999] text-xs px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none",
              tooltipPos.type === "memo"
                ? "whitespace-normal break-words max-w-[240px]"
                : "whitespace-nowrap",
              isDark ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-white",
            ].join(" ")}
          >
            {text}
          </div>
        );
      })()}

      {confirmBulkDelete && (
        <ConfirmModal
          message={`${selectedIds.size}개 거래처를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={doBulkDelete}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      )}

      {/* 목록형 상태 드롭다운 (fixed) */}
      {openStatusId && dropdownPos && (() => {
        const dc = sorted.find((c) => c.id === openStatusId);
        if (!dc) return null;
        return (
          <div
            ref={statusDropdownRef}
            style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right }}
            className="z-[9999] bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg overflow-hidden min-w-[110px]"
          >
            {(["pending","inprogress","complete","stopped"] as ReportStatus[]).map((s) => {
              const sc = STATUS_CONFIG[s];
              return (
                <button key={s} onClick={() => setStatus(dc.id, s)} onMouseDown={(e) => e.stopPropagation()}
                  className={[
                    "flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold transition-colors",
                    dc.status === s ? `${sc.bgCls} ${sc.textCls}` : "text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  {STATUS_ICONS[s]}{sc.label}
                </button>
              );
            })}
          </div>
        );
      })()}

      {customPopover && (() => {
        const client = filtered.find((c) => c.id === customPopover.id);
        if (!client || client.customFields.length === 0) return null;
        return (
          <div
            ref={customPopoverRef}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ position: "fixed", left: customPopover.x, top: customPopover.y }}
            className="z-[9999] bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xl p-3 min-w-[180px] max-w-[280px]"
          >
            <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">커스텀 속성</p>
            <div className="space-y-1.5">
              {client.customFields.map((f) => {
                const revealing = revealingCustomField?.clientId === client.id && revealingCustomField?.key === f.key;
                return (
                  <div key={f.key} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 dark:text-zinc-500 shrink-0 font-medium">{f.key}</span>
                    <span className="text-slate-700 dark:text-zinc-200 flex-1">
                      {f.masked && !revealing ? "****" : f.value}
                    </span>
                    {f.masked && (
                      <button
                        type="button"
                        onMouseDown={(e) => { e.stopPropagation(); setRevealingCustomField({ clientId: client.id, key: f.key }); }}
                        onMouseUp={() => setRevealingCustomField(null)}
                        onMouseLeave={() => setRevealingCustomField(null)}
                        className="text-slate-400 hover:text-[#6C63FF] transition shrink-0"
                      >
                        {revealing ? <IconEyeOff className="w-3 h-3" /> : <IconEye className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">거래처 목록</h2>
          <span className="text-xs text-slate-400 dark:text-zinc-500">총 {total}개</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 뷰 모드 토글 */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl border border-slate-200 dark:border-zinc-700">
            <button
              onClick={() => handleViewModeChange("grid")}
              aria-label="박스형 보기"
              className={[
                "p-1.5 rounded-lg transition-colors",
                viewMode === "grid"
                  ? "bg-[#6C63FF]/10 text-[#6C63FF]"
                  : "text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              <IconLayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange("list")}
              aria-label="목록형 보기"
              className={[
                "p-1.5 rounded-lg transition-colors",
                viewMode === "list"
                  ? "bg-[#6C63FF]/10 text-[#6C63FF]"
                  : "text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              <IconLayoutList className="w-4 h-4" />
            </button>
          </div>
          {viewMode === "list" && (
            <button
              onClick={() => {
                localStorage.setItem(GRASS_PANEL_KEY, String(!showGrassPanel));
                setShowGrassPanel((v) => !v);
              }}
              aria-label="진행현황 패널"
              className={[
                "p-1.5 rounded-xl border transition-colors",
                showGrassPanel
                  ? "border-[#6C63FF]/40 bg-[#6C63FF]/10 text-[#6C63FF]"
                  : "border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              <IconLayoutSidebarRight className="w-4 h-4" />
            </button>
          )}
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

            {/* 거래처 연락처 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-500 dark:text-zinc-400">거래처 연락처</label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, maskCompanyPhone: !f.maskCompanyPhone }))}
                  className="flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <span className={[
                    "w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                    form.maskCompanyPhone ? "bg-[#6C63FF] border-[#6C63FF]" : "border-slate-300 dark:border-zinc-600",
                  ].join(" ")}>
                    {form.maskCompanyPhone && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </span>
                  <span className="text-slate-500 dark:text-zinc-400">연락처 마스킹</span>
                </button>
              </div>
              <input value={form.companyPhone} onChange={(e) => setForm((f) => ({ ...f, companyPhone: e.target.value }))}
                placeholder="02-0000-0000"
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-zinc-400">담당자 연락처</label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, maskPhone: !f.maskPhone }))}
                    className="flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    <span className={[
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                      form.maskPhone ? "bg-[#6C63FF] border-[#6C63FF]" : "border-slate-300 dark:border-zinc-600",
                    ].join(" ")}>
                      {form.maskPhone && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </span>
                    <span className="text-slate-500 dark:text-zinc-400">연락처 마스킹</span>
                  </button>
                </div>
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

            {/* 커스텀 속성 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">커스텀 속성</label>
              <div className="space-y-2">
                {form.customFields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative w-1/3">
                      <input value={field.key}
                        onChange={(e) => setForm((f) => ({
                          ...f,
                          customFields: f.customFields.map((cf, i) => i === idx ? { ...cf, key: e.target.value } : cf),
                        }))}
                        onFocus={() => setFocusedCustomKeyIdx(idx)}
                        onBlur={() => setFocusedCustomKeyIdx((cur) => cur === idx ? null : cur)}
                        placeholder="속성명"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                      />
                      {focusedCustomKeyIdx === idx && savedCustomKeys.length > 0 && (
                        <div className="absolute z-10 top-full left-0 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg">
                          {savedCustomKeys
                            .filter((k) => k.includes(field.key.trim()))
                            .map((k) => (
                              <button key={k} type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setForm((f) => ({
                                    ...f,
                                    customFields: f.customFields.map((cf, i) => i === idx ? { ...cf, key: k } : cf),
                                  }));
                                  setFocusedCustomKeyIdx(null);
                                }}
                                className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition"
                              >
                                {k}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <input value={field.value}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        customFields: f.customFields.map((cf, i) => i === idx ? { ...cf, value: e.target.value } : cf),
                      }))}
                      placeholder="값"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        customFields: f.customFields.map((cf, i) => i === idx ? { ...cf, masked: !cf.masked } : cf),
                      }))}
                      className="flex items-center gap-1.5 text-xs cursor-pointer shrink-0"
                    >
                      <span className={[
                        "w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                        field.masked ? "bg-[#6C63FF] border-[#6C63FF]" : "border-slate-300 dark:border-zinc-600",
                      ].join(" ")}>
                        {field.masked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                          </svg>
                        )}
                      </span>
                      <span className="text-slate-500 dark:text-zinc-400">마스킹</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        customFields: f.customFields.filter((_, i) => i !== idx),
                      }))}
                      aria-label="속성 삭제"
                      className="text-slate-400 hover:text-red-500 transition shrink-0"
                    >
                      <IconX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({
                  ...f,
                  customFields: [...f.customFields, { key: "", value: "", masked: false }],
                }))}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#6C63FF]/40 text-[#6C63FF] hover:bg-[#6C63FF]/10 transition"
              >
                <IconPlus className="w-3.5 h-3.5" />속성 추가
              </button>
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

      {/* 검색창 + 편집/정렬 버튼 바 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="거래처명, 담당자, 연락처, 태그 등 검색..."
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="검색어 지우기"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 목록형 편집 모드 버튼 바 */}
          {viewMode === "list" && (
            listEditMode === "none" ? (
              <button
                onClick={() => setListEditMode("edit")}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 active:bg-slate-100 dark:active:bg-zinc-700 transition-colors"
              >
                편집
              </button>
            ) : (
              <>
                <button
                  disabled={selectedIds.size !== 1}
                  onClick={() => {
                    const id = [...selectedIds][0];
                    const target = sorted.find((c) => c.id === id);
                    if (target) startEdit(target);
                  }}
                  className={[
                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                    selectedIds.size === 1
                      ? "bg-[#6C63FF]/10 text-[#6C63FF] border-[#6C63FF]/40 hover:bg-[#6C63FF]/20 active:bg-[#6C63FF]/30 dark:bg-[#6C63FF]/20 dark:text-[#a99dff] dark:border-[#6C63FF]/50"
                      : "bg-transparent text-slate-300 dark:text-zinc-600 border-slate-200 dark:border-zinc-700 opacity-100 cursor-not-allowed",
                  ].join(" ")}
                >
                  수정
                </button>
                <button
                  disabled={selectedIds.size === 0}
                  onClick={() => setConfirmBulkDelete(true)}
                  className={[
                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                    selectedIds.size > 0
                      ? "bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50"
                      : "bg-transparent text-slate-300 dark:text-zinc-600 border-slate-200 dark:border-zinc-700 opacity-100 cursor-not-allowed",
                  ].join(" ")}
                >
                  {selectedIds.size > 0 ? `${selectedIds.size}개 삭제` : "삭제"}
                </button>
                <button
                  onClick={() => { setListEditMode("none"); setSelectedIds(new Set()); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-zinc-600 text-slate-500 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 active:bg-slate-100 dark:active:bg-zinc-700 transition-colors"
                >
                  취소
                </button>
              </>
            )
          )}

          {/* 정렬 드롭다운 */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setSortDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              <IconArrowsSort className="w-3.5 h-3.5" />{SORT_LABELS[sortOrder]}
              {sortDropdownOpen ? <IconChevronUp className="w-3.5 h-3.5" /> : <IconChevronDown className="w-3.5 h-3.5" />}
            </button>
            {sortDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg overflow-hidden min-w-[160px]">
                {(Object.keys(SORT_LABELS) as SortOrder[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => { setSortOrder(key); setSortDropdownOpen(false); }}
                    className={[
                      "flex items-center gap-2 w-full px-3 py-2 text-xs font-medium transition-colors",
                      sortOrder === key
                        ? "bg-[#6C63FF]/10 text-[#6C63FF]"
                        : "text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800",
                    ].join(" ")}
                  >
                    {sortOrder === key ? <IconCheck className="w-3 h-3" /> : <span className="w-3 h-3" />}
                    {SORT_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 거래처 목록 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-zinc-600">
          <IconBuilding className="w-12 h-12 mb-3" />
          {clients.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-400 dark:text-zinc-500">등록된 거래처가 없습니다</p>
              <p className="text-xs text-slate-300 dark:text-zinc-600 mt-1">위 버튼을 눌러 거래처를 추가하세요</p>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-400 dark:text-zinc-500">검색 결과가 없습니다</p>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div className="flex items-stretch gap-3">
        <div className="flex-1 min-w-0 rounded-2xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div
          onMouseDown={handleScrollMouseDown}
          onMouseMove={handleScrollMouseMove}
          onMouseUp={handleScrollMouseUp}
          onMouseLeave={handleScrollMouseUp}
          onClick={handleScrollClick}
          className={[
            "overflow-visible",
            isDragging ? "cursor-grabbing select-none" : "cursor-grab",
          ].join(" ")}
        >
        <div
          ref={tableScrollRef}
          onWheel={handleScrollWheel}
          style={{ overflowX: "auto", overflowY: "visible", paddingBottom: "4px" }}
          className="client-list-scroll"
        >
          <style jsx>{`
            .client-list-scroll::-webkit-scrollbar {
              height: 4px;
            }
            .client-list-scroll::-webkit-scrollbar-track {
              background-color: transparent;
            }
            .client-list-scroll::-webkit-scrollbar-thumb {
              background-color: rgba(108, 99, 255, 0.25);
              border-radius: 9999px;
            }
            .client-list-scroll::-webkit-scrollbar-thumb:hover {
              background-color: rgba(108, 99, 255, 0.5);
            }
          `}</style>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider sticky top-0 z-10 bg-slate-50 dark:bg-zinc-800">
                <th className="px-2 py-3 whitespace-nowrap"></th>
                <th className="px-4 py-3 whitespace-nowrap text-center">거래처명</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">담당자</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">담당자 연락처</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">거래처 연락처</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">태그</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">계약 시작일</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">계약 만료일</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">D-day</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">메모</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">보고 톤</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const cfg         = STATUS_CONFIG[c.status];
                const contractEnd = getContractEnd(c);
                const dday        = contractEnd ? getDday(contractEnd) : null;
                const ddayFmt     = dday != null ? formatDday(dday) : null;
                const isHovered  = hoveredRowId === c.id;
                const isSelected = selectedIds.has(c.id);
                const rowBgColor = listEditMode === "edit" && isSelected
                  ? "rgba(108,99,255,0.05)"
                  : getRowBg(idx, isHovered);

                return (
                  <Fragment key={c.id}>
                  <tr
                    onMouseEnter={() => setHoveredRowId(c.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    className="group border-t border-slate-100 dark:border-zinc-800 transition-colors"
                    style={{ backgroundColor: rowBgColor }}
                  >
                    <td className="px-2 h-[52px] whitespace-nowrap">
                      {listEditMode === "edit" ? (
                        <button
                          type="button"
                          onClick={() => toggleSelected(c.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                          aria-label="선택"
                          className={[
                            "w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                            isSelected ? "bg-[#6C63FF] border-[#6C63FF]" : "border-slate-300 dark:border-zinc-600",
                          ].join(" ")}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                            </svg>
                          )}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 h-[52px] font-medium text-slate-800 dark:text-zinc-100 whitespace-nowrap relative">
                      <div className="flex items-center gap-1.5">
                        <span
                          ref={(el) => { if (el) nameRefs.current.set(c.id, el); else nameRefs.current.delete(c.id); }}
                          className="max-w-[120px] block truncate"
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollWidth <= el.offsetWidth) return;
                            const rect = el.getBoundingClientRect();
                            setTooltipPos({ x: rect.left, y: rect.top, id: c.id, type: "name" });
                          }}
                          onMouseLeave={() => setTooltipPos(null)}
                        >
                          {c.name}
                        </span>
                        {c.customFields.length > 0 && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setCustomPopover((prev) => prev?.id === c.id ? null : { id: c.id, x: rect.left, y: rect.bottom + 4 });
                            }}
                            aria-label="커스텀 속성 보기"
                            className="shrink-0"
                          >
                            <IconTag className={["w-3.5 h-3.5", customPopover?.id === c.id ? "text-[#6C63FF]" : "text-slate-400"].join(" ")} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 h-[52px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">{c.contact || "-"}</td>
                    <td className="px-4 h-[52px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                      {c.phone ? (
                        <div className="flex items-center gap-1.5">
                          <span>
                            {c.maskPhone && revealingPhoneId !== c.id ? maskPhoneNum(c.phone) : formatPhone(c.phone)}
                          </span>
                          {c.maskPhone && (
                            <button
                              type="button"
                              onMouseDown={() => setRevealingPhoneId(c.id)}
                              onMouseUp={() => setRevealingPhoneId(null)}
                              onMouseLeave={() => setRevealingPhoneId(null)}
                              aria-label="연락처 임시 표시"
                              className="text-slate-400 hover:text-[#6C63FF] transition"
                            >
                              {revealingPhoneId === c.id
                                ? <IconEyeOff className="w-3.5 h-3.5" />
                                : <IconEye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      ) : "-"}
                    </td>
                    <td className="px-4 h-[52px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                      {c.companyPhone ? (
                        <div className="flex items-center gap-1.5">
                          <span>
                            {c.maskCompanyPhone && revealingCompanyPhoneId !== c.id ? maskPhoneNum(c.companyPhone) : formatPhone(c.companyPhone)}
                          </span>
                          {c.maskCompanyPhone && (
                            <button
                              type="button"
                              onMouseDown={() => setRevealingCompanyPhoneId(c.id)}
                              onMouseUp={() => setRevealingCompanyPhoneId(null)}
                              onMouseLeave={() => setRevealingCompanyPhoneId(null)}
                              aria-label="거래처 연락처 임시 표시"
                              className="text-slate-400 hover:text-[#6C63FF] transition"
                            >
                              {revealingCompanyPhoneId === c.id
                                ? <IconEyeOff className="w-3.5 h-3.5" />
                                : <IconEye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      ) : "-"}
                    </td>
                    <td className="px-4 h-[52px]">
                      {c.tags.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6C63FF]/10 dark:bg-[#6C63FF]/25 text-[#6C63FF] dark:text-[#a99dff] whitespace-nowrap">{c.tags[0]}</span>
                          {c.tags.length > 1 && (
                            <div
                              className="relative"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTagTooltipAlign(rect.right + 200 > window.innerWidth ? "right" : "left");
                                setHoveredTagId(c.id);
                              }}
                              onMouseLeave={() => setHoveredTagId(null)}
                            >
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 whitespace-nowrap cursor-default">
                                +{c.tags.length - 1}
                              </span>
                              {hoveredTagId === c.id && (
                                <div className={[
                                  "absolute top-0 z-50 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-xl shadow-xl border border-[#6C63FF]/20 p-2 flex flex-wrap gap-1 w-max max-w-[200px]",
                                  tagTooltipAlign === "left" ? "left-full ml-1" : "right-full mr-1",
                                ].join(" ")}>
                                  {c.tags.slice(1).map((t) => (
                                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6C63FF]/10 dark:bg-[#6C63FF]/25 text-[#6C63FF] dark:text-[#a99dff] whitespace-nowrap">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : "-"}
                    </td>
                    <td className="px-4 h-[52px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">{c.contractStart ? fmtShort(c.contractStart) : "-"}</td>
                    <td className="px-4 h-[52px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">{contractEnd ? fmtShort(contractEnd) : "-"}</td>
                    <td className="px-4 h-[52px] whitespace-nowrap">
                      {ddayFmt ? <span className={`text-xs font-medium ${ddayFmt.cls}`}>{ddayFmt.text}</span> : "-"}
                    </td>
                    <td className="px-4 h-[52px] text-slate-500 dark:text-zinc-400 relative">
                      {c.memo ? (
                        <span
                          ref={(el) => { if (el) memoRefs.current.set(c.id, el); else memoRefs.current.delete(c.id); }}
                          className="max-w-[150px] block truncate"
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollWidth <= el.offsetWidth) return;
                            const rect = el.getBoundingClientRect();
                            setTooltipPos({ x: rect.left, y: rect.top, id: c.id, type: "memo" });
                          }}
                          onMouseLeave={() => setTooltipPos(null)}
                        >
                          {c.memo}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 h-[52px] text-slate-500 dark:text-zinc-400 relative">
                      {c.reportTone ? (
                        <span
                          ref={(el) => { if (el) toneRefs.current.set(c.id, el); else toneRefs.current.delete(c.id); }}
                          className="max-w-[120px] block truncate"
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollWidth <= el.offsetWidth) return;
                            const rect = el.getBoundingClientRect();
                            setTooltipPos({ x: rect.left, y: rect.top, id: c.id, type: "tone" });
                          }}
                          onMouseLeave={() => setTooltipPos(null)}
                        >
                          {c.reportTone}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 h-[52px] whitespace-nowrap relative">
                      <div className="relative w-fit">
                        <button
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                            setOpenStatusId((prev) => prev === c.id ? null : c.id);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={[
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap w-fit transition-all cursor-pointer active:scale-95",
                            cfg.bgCls, cfg.borderCls, cfg.textCls, cfg.hoverCls,
                          ].join(" ")}
                        >
                          {STATUS_ICONS[c.status]}{cfg.label}
                        </button>
                      </div>
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
        </div>

        {/* 진행현황 패널 */}
        <div
          className={[
            "shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
            showGrassPanel ? "w-[200px] opacity-100" : "w-0 opacity-0",
          ].join(" ")}
        >
          <div className="w-[200px] h-full rounded-2xl overflow-hidden border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
            {/* thead 높이에 맞춘 헤더 */}
            <div
              className="h-9 px-2 flex items-center justify-center text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider"
              style={{ backgroundColor: isDark ? "#27272a" : "#f8fafc" }}
            >
              진행 현황
            </div>
            {filtered.map((c, idx) => {
              const cEnd = getContractEnd(c);
              const show = c.status === "inprogress" && c.showGrassGrid && !!c.contractStart && !!cEnd;
              const rowBgColor = getRowBg(idx, hoveredRowId === c.id);
              return (
                <div
                  key={c.id}
                  onMouseEnter={() => setHoveredRowId(c.id)}
                  onMouseLeave={() => setHoveredRowId(null)}
                  className="h-[52px] px-2 flex items-center justify-center border-t border-slate-100 dark:border-zinc-800"
                  style={{ backgroundColor: rowBgColor }}
                >
                  {show ? (
                    <MiniGrassGrid
                      contractStart={c.contractStart}
                      contractEnd={cEnd!}
                      dailyLog={c.dailyLog}
                      onToggle={(date) => toggleDailyLog(c.id, date)}
                    />
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-zinc-600">-</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
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
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {c.maskPhone && revealingPhoneId !== c.id ? maskPhoneNum(c.phone) : formatPhone(c.phone)}
                        </p>
                        {c.maskPhone && (
                          <button
                            type="button"
                            onMouseDown={() => setRevealingPhoneId(c.id)}
                            onMouseUp={() => setRevealingPhoneId(null)}
                            onMouseLeave={() => setRevealingPhoneId(null)}
                            aria-label="연락처 임시 표시"
                            className="text-slate-400 hover:text-[#6C63FF] transition"
                          >
                            {revealingPhoneId === c.id
                              ? <IconEyeOff className="w-3 h-3" />
                              : <IconEye className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    )}
                    {c.companyPhone && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <IconBuilding className="w-3 h-3 text-slate-400 shrink-0" />
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {c.maskCompanyPhone && revealingCompanyPhoneId !== c.id ? maskPhoneNum(c.companyPhone) : formatPhone(c.companyPhone)}
                        </p>
                        {c.maskCompanyPhone && (
                          <button
                            type="button"
                            onMouseDown={() => setRevealingCompanyPhoneId(c.id)}
                            onMouseUp={() => setRevealingCompanyPhoneId(null)}
                            onMouseLeave={() => setRevealingCompanyPhoneId(null)}
                            aria-label="거래처 연락처 임시 표시"
                            className="text-slate-400 hover:text-[#6C63FF] transition"
                          >
                            {revealingCompanyPhoneId === c.id
                              ? <IconEyeOff className="w-3 h-3" />
                              : <IconEye className="w-3 h-3" />}
                          </button>
                        )}
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
                      <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6C63FF]/10 dark:bg-[#6C63FF]/25 text-[#6C63FF] dark:text-[#a99dff]">{t}</span>
                    ))}
                  </div>
                )}

                {/* 계약 시작일 */}
                {c.contractStart && (
                  <div className="flex items-center gap-1.5">
                    <IconCalendarPlus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{formatDate(c.contractStart)}</p>
                  </div>
                )}

                {/* 계약 D-day */}
                {contractEnd && ddayFmt && (
                  <div className="flex items-center gap-1.5">
                    <IconCalendarX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{formatDate(contractEnd)}</p>
                    <span className={`text-xs font-medium ml-auto ${ddayFmt.cls}`}>{ddayFmt.text}</span>
                  </div>
                )}

                {/* 메모 */}
                {c.memo && (
                  <div className="flex items-start gap-1.5 relative">
                    <IconNotes className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p
                      ref={(el) => { if (el) memoBoxRefs.current.set(c.id, el); else memoBoxRefs.current.delete(c.id); }}
                      className="text-xs text-slate-500 dark:text-zinc-400 truncate"
                      onMouseEnter={() => setHoveredMemoIdBox(c.id)}
                      onMouseLeave={() => setHoveredMemoIdBox(null)}
                    >
                      {c.memo}
                    </p>
                    {hoveredMemoIdBox === c.id && (() => {
                      const el = memoBoxRefs.current.get(c.id);
                      return el && el.scrollWidth > el.offsetWidth;
                    })() && (
                      <div className={[
                        "absolute left-0 bottom-full mb-0 z-50 text-xs px-2.5 py-1.5 rounded-lg shadow-lg whitespace-normal break-words max-w-[240px] pointer-events-none",
                        isDark ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-white",
                      ].join(" ")}>
                        {c.memo}
                      </div>
                    )}
                  </div>
                )}

                {/* 보고 메시지 톤 */}
                {c.reportTone && (
                  <div className="flex items-start gap-1.5 relative">
                    <IconMessage className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p
                      ref={(el) => { if (el) toneBoxRefs.current.set(c.id, el); else toneBoxRefs.current.delete(c.id); }}
                      className="text-xs text-slate-500 dark:text-zinc-400 truncate"
                      onMouseEnter={() => setHoveredToneIdBox(c.id)}
                      onMouseLeave={() => setHoveredToneIdBox(null)}
                    >
                      {c.reportTone}
                    </p>
                    {hoveredToneIdBox === c.id && (() => {
                      const el = toneBoxRefs.current.get(c.id);
                      return el && el.scrollWidth > el.offsetWidth;
                    })() && (
                      <div className={[
                        "absolute left-0 bottom-full mb-0 z-50 text-xs px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none",
                        isDark ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-white",
                      ].join(" ")}>
                        {c.reportTone}
                      </div>
                    )}
                  </div>
                )}

                {/* 잔디밭 */}
                {showGrass && (() => {
                  const grassOpen = expandedGrass.has(c.id);
                  return (
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setExpandedGrass((prev) => {
                          const next = new Set(prev);
                          next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                          return next;
                        })}
                        className="group/grass flex items-center gap-1.5 w-full mb-1 cursor-pointer"
                      >
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider transition-colors group-hover/grass:text-[#6C63FF]">진행 현황</p>
                        {grassOpen
                          ? <IconChevronUp   className="w-3 h-3 text-slate-400 dark:text-zinc-500 transition-colors group-hover/grass:text-[#6C63FF]" />
                          : <IconChevronDown className="w-3 h-3 text-slate-400 dark:text-zinc-500 transition-colors group-hover/grass:text-[#6C63FF]" />}
                      </button>
                      <div
                        style={{ maxHeight: grassOpen ? "180px" : "0px", opacity: grassOpen ? 1 : 0 }}
                        className="overflow-hidden transition-all duration-300 ease-in-out"
                      >
                        <GrassGrid
                          contractStart={c.contractStart}
                          contractEnd={contractEnd!}
                          dailyLog={c.dailyLog}
                          onToggle={(date) => toggleDailyLog(c.id, date)}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 링크 */}
                {c.link && (
                  <a href={c.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#6C63FF] hover:text-[#8B85FF] transition w-fit"
                  >
                    <IconExternalLink className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[160px]">{c.link.replace(/^https?:\/\//, "")}</span>
                  </a>
                )}

                {/* 커스텀 속성 */}
                {c.customFields.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1">
                    {c.customFields.map((f) => {
                      const revealing = revealingCustomField?.clientId === c.id && revealingCustomField?.key === f.key;
                      console.log('revealing check:', c.id, f.key, revealingCustomField, revealing);
                      return (
                        <div key={f.key} className="flex items-center gap-1.5 text-xs">
                          <span className="text-slate-400 dark:text-zinc-500 shrink-0">{f.key}</span>
                          <span className="text-slate-600 dark:text-zinc-300 truncate">
                            {f.masked && !revealing ? "****" : f.value}
                          </span>
                          {f.masked && (
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                console.log('mousedown', c.id, f.key);
                                setRevealingCustomField({ clientId: c.id, key: f.key });
                                console.log('set revealing:', { clientId: c.id, key: f.key });
                              }}
                              onMouseUp={() => setRevealingCustomField(null)}
                              onMouseLeave={() => setRevealingCustomField(null)}
                              aria-label="속성 임시 표시"
                              className="text-slate-400 hover:text-[#6C63FF] transition shrink-0 w-4 h-4 flex items-center justify-center"
                            >
                              <div className="relative w-3 h-3">
                                <IconEye className={["w-3 h-3 absolute", revealing ? "opacity-0" : "opacity-100"].join(" ")} />
                                <IconEyeOff className={["w-3 h-3 absolute", revealing ? "opacity-100" : "opacity-0"].join(" ")} />
                              </div>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
      <HelpButton
        title="거래처 관리 사용법"
        steps={[
          { step: "거래처 추가", desc: "우측 상단 버튼으로 거래처를 추가합니다. 계약 기간 입력 시 진행 현황 잔디밭이 활성화됩니다." },
          { step: "뷰 모드", desc: "박스형/목록형 두 가지 뷰를 지원합니다. 목록형에서는 진행현황 패널을 별도로 볼 수 있습니다." },
          { step: "검색 및 정렬", desc: "검색창으로 거래처명·담당자·태그 등을 검색하고, 드롭다운으로 정렬 기준을 선택합니다." },
          { step: "상태 변경", desc: "상태 배지를 클릭하면 진행 중·완료·대기 중·중단으로 변경할 수 있습니다." },
          { step: "편집 모드", desc: "편집 버튼으로 수정/삭제 모드를 활성화합니다. 삭제 모드에서는 체크박스로 여러 항목을 한 번에 삭제할 수 있습니다." },
          { step: "진행 현황", desc: "잔디밭 그리드를 클릭해 일별 보고 활동을 기록합니다. 완료→실패→미확인 순으로 토글됩니다." },
        ]}
      />
    </div>
  );
}
