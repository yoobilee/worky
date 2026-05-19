"use client";

import { useState, useEffect } from "react";
import {
  IconBuilding, IconPlus, IconPencil, IconTrash,
  IconUser, IconNotes, IconCalendar, IconArrowsSort,
  IconX, IconExternalLink, IconTag, IconPhone,
  IconLink, IconMessage, IconChevronDown, IconChevronUp,
  IconCircleCheck, IconCircleX, IconAlertCircle,
} from "@tabler/icons-react";

/* ── 타입 ── */
type ReportStatus = "incomplete" | "complete" | "failed";
type SortOrder    = "incomplete" | "name" | "expiry";

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
  createdAt:      number;
}

interface FormState {
  name:         string;
  status:       ReportStatus;
  contact:      string;
  phone:        string;
  link:         string;
  tagInput:     string;
  tags:         string[];
  contractStart: string;
  contractDays:  string;
  reportTone:   string;
  memo:         string;
}

/* ── 상수 ── */
const STORAGE_KEY   = "worky_clients";
const RESET_DATE_KEY = "worky_clients_reset_date";

const EMPTY_FORM: FormState = {
  name: "", status: "incomplete", contact: "", phone: "",
  link: "", tagInput: "", tags: [], contractStart: "",
  contractDays: "", reportTone: "", memo: "",
};

const STATUS_CONFIG: Record<ReportStatus, {
  label: string; textCls: string; bgCls: string; borderCls: string; hoverCls: string; barCls: string;
}> = {
  incomplete: {
    label:     "미완료",
    textCls:   "text-red-500 dark:text-red-400",
    bgCls:     "bg-red-100 dark:bg-red-950/40",
    borderCls: "border-red-200 dark:border-red-800",
    hoverCls:  "hover:bg-red-200 dark:hover:bg-red-900/60",
    barCls:    "bg-red-400",
  },
  complete: {
    label:     "완료",
    textCls:   "text-emerald-600 dark:text-emerald-400",
    bgCls:     "bg-emerald-100 dark:bg-emerald-950/40",
    borderCls: "border-emerald-200 dark:border-emerald-800",
    hoverCls:  "hover:bg-emerald-200 dark:hover:bg-emerald-900/60",
    barCls:    "bg-emerald-500",
  },
  failed: {
    label:     "실패",
    textCls:   "text-orange-500 dark:text-orange-400",
    bgCls:     "bg-orange-100 dark:bg-orange-950/40",
    borderCls: "border-orange-200 dark:border-orange-800",
    hoverCls:  "hover:bg-orange-200 dark:hover:bg-orange-900/60",
    barCls:    "bg-orange-400",
  },
};

const STATUS_ICONS: Record<ReportStatus, React.ReactNode> = {
  incomplete: <IconAlertCircle  className="w-3.5 h-3.5 shrink-0" />,
  complete:   <IconCircleCheck  className="w-3.5 h-3.5 shrink-0" />,
  failed:     <IconCircleX      className="w-3.5 h-3.5 shrink-0" />,
};

const STATUS_CYCLE: Record<ReportStatus, ReportStatus> = {
  incomplete: "complete",
  complete:   "failed",
  failed:     "incomplete",
};

/* ── 헬퍼 ── */
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayKey():     string { return toDateKey(new Date()); }

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
  if (dday < 0)  return { text: `D+${Math.abs(dday)}`, cls: "text-slate-400 dark:text-zinc-500" };
  if (dday === 0) return { text: "D-Day",               cls: "text-red-500 font-bold" };
  if (dday <= 3)  return { text: `D-${dday}`,           cls: "text-red-500 font-semibold" };
  if (dday <= 7)  return { text: `D-${dday}`,           cls: "text-orange-500 font-medium" };
  return               { text: `D-${dday}`,           cls: "text-slate-500 dark:text-zinc-400" };
}

function formatDate(s: string): string {
  const [y,m,d] = s.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

// 구형 데이터 마이그레이션
function normalize(raw: Record<string, unknown>): Client {
  return {
    id:            (raw.id as string)            ?? crypto.randomUUID(),
    name:          (raw.name as string)          ?? "",
    status:        (raw.status as ReportStatus)  ?? ((raw.reportedToday as boolean) ? "complete" : "incomplete"),
    contact:       (raw.contact as string)       ?? "",
    phone:         (raw.phone as string)         ?? "",
    link:          (raw.link as string)          ?? "",
    tags:          Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    contractStart: (raw.contractStart as string) ?? "",
    contractDays:  (raw.contractDays as number)  ?? null,
    reportTone:    (raw.reportTone as string)    ?? "",
    memo:          (raw.memo as string)          ?? "",
    statusHistory: Array.isArray(raw.statusHistory)
      ? (raw.statusHistory as HistoryEntry[])
      : (Array.isArray(raw.reportHistory)
         ? (raw.reportHistory as string[]).map((d) => ({ date: d, status: "complete" as ReportStatus }))
         : []),
    createdAt: (raw.createdAt as number) ?? Date.now(),
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

/* ── 컴포넌트 ── */
export default function ClientManager() {
  const [clients,           setClients]           = useState<Client[]>([]);
  const [hydrated,          setHydrated]          = useState(false);
  const [sortOrder,         setSortOrder]         = useState<SortOrder>("incomplete");
  const [showForm,          setShowForm]          = useState(false);
  const [editingId,         setEditingId]         = useState<string | null>(null);
  const [form,              setForm]              = useState<FormState>(EMPTY_FORM);
  const [expandedHistories, setExpandedHistories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const today = todayKey();
    let cls = loadClients();
    const lastReset = localStorage.getItem(RESET_DATE_KEY);
    if (lastReset !== today) {
      cls = cls.map((c) => ({ ...c, status: "incomplete" as ReportStatus }));
      saveClients(cls);
      localStorage.setItem(RESET_DATE_KEY, today);
    }
    setClients(cls);
    setHydrated(true);
  }, []);

  /* ── 상태 토글 ── */
  const toggleStatus = (id: string) => {
    const today = todayKey();
    setClients((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c;
        const newStatus = STATUS_CYCLE[c.status];
        return {
          ...c,
          status: newStatus,
          statusHistory: [...c.statusHistory, { date: today, status: newStatus }],
        };
      });
      saveClients(updated);
      return updated;
    });
  };

  /* ── 태그 ── */
  const commitTag = () => {
    const tag = form.tagInput.trim().replace(/,+$/, "");
    if (!tag || form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tagInput: "" }));
      return;
    }
    setForm((f) => ({ ...f, tags: [...f.tags, tag], tagInput: "" }));
  };

  /* ── 추가/수정 ── */
  const handleSave = () => {
    if (!form.name.trim()) return;
    const base = {
      name:         form.name.trim(),
      status:       form.status,
      contact:      form.contact.trim(),
      phone:        form.phone.trim(),
      link:         form.link.trim(),
      tags:         form.tags,
      contractStart: form.contractStart,
      contractDays: form.contractDays ? Number(form.contractDays) : null,
      reportTone:   form.reportTone.trim(),
      memo:         form.memo.trim(),
    };
    setClients((prev) => {
      const updated = editingId
        ? prev.map((c) => c.id !== editingId ? c : { ...c, ...base })
        : [...prev, { ...base, id: crypto.randomUUID(), statusHistory: [], createdAt: Date.now() }];
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
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("이 거래처를 삭제할까요?")) return;
    setClients((prev) => { const u = prev.filter((c) => c.id !== id); saveClients(u); return u; });
  };

  const closeForm = () => {
    setShowForm(false); setEditingId(null); setForm(EMPTY_FORM);
  };

  const toggleHistory = (id: string) =>
    setExpandedHistories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /* ── 정렬 ── */
  const sorted = [...clients].sort((a, b) => {
    if (sortOrder === "incomplete") {
      const order: Record<ReportStatus, number> = { incomplete: 0, failed: 1, complete: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    }
    if (sortOrder === "expiry") {
      const ea = getContractEnd(a), eb = getContractEnd(b);
      if (!ea && !eb) return a.name.localeCompare(b.name, "ko");
      if (!ea) return 1;
      if (!eb) return -1;
      if (ea !== eb) return ea.localeCompare(eb);
    }
    return a.name.localeCompare(b.name, "ko");
  });

  const total      = clients.length;
  const cComplete  = clients.filter((c) => c.status === "complete").length;
  const cFailed    = clients.filter((c) => c.status === "failed").length;
  const cIncomplete = total - cComplete - cFailed;

  const contractEndPreview =
    form.contractStart && form.contractDays
      ? addBusinessDays(form.contractStart, Number(form.contractDays))
      : null;

  if (!hydrated) return null;

  const SORT_LABELS: Record<SortOrder, string> = {
    incomplete: "미완료 우선",
    name:       "거래처명순",
    expiry:     "만료 임박순",
  };
  const SORT_CYCLE: SortOrder[] = ["incomplete", "name", "expiry"];

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
            onClick={() => setSortOrder((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
          >
            <IconArrowsSort className="w-3.5 h-3.5" />
            {SORT_LABELS[sortOrder]}
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
              <div className="flex gap-2">
                {(["incomplete","complete","failed"] as ReportStatus[]).map((s) => {
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
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTag(); } }}
                onBlur={commitTag}
                placeholder="태그 입력 후 Enter (예: 신규, VIP)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>

            {/* 계약 시작일 + 기간 */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">계약 시작일</label>
                <input type="date" value={form.contractStart}
                  onChange={(e) => setForm((f) => ({ ...f, contractStart: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">계약 기간 (영업일)</label>
                <input type="number" min="1" value={form.contractDays}
                  onChange={(e) => setForm((f) => ({ ...f, contractDays: e.target.value }))}
                  placeholder="예: 30"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                />
              </div>
            </div>
            {contractEndPreview && (
              <p className="text-xs text-[#6C63FF] -mt-2">
                만료 예정일: {formatDate(contractEndPreview)}
              </p>
            )}

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

      {/* 통계 카드 (스택 프로그레스바 포함) */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm px-1 py-1">
        <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-zinc-800">
          {[
            { label: "전체",  value: total,      cls: "text-slate-800 dark:text-slate-100" },
            { label: "완료",  value: cComplete,  cls: "text-emerald-500" },
            { label: "미완료", value: cIncomplete, cls: "text-red-400" },
            { label: "실패",  value: cFailed,    cls: "text-orange-400" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="px-5 py-4">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
        {/* 스택 프로그레스바 */}
        <div className="mx-4 mb-3 h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden flex">
          {total === 0 ? (
            <div className="w-full" />
          ) : (
            <>
              <div style={{ width: `${(cComplete  / total) * 100}%` }} className="bg-emerald-500 transition-all duration-500" />
              <div style={{ width: `${(cFailed    / total) * 100}%` }} className="bg-orange-400 transition-all duration-500" />
              <div style={{ width: `${(cIncomplete / total) * 100}%` }} className="bg-red-400 transition-all duration-500" />
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
            const cfg       = STATUS_CONFIG[c.status];
            const contractEnd = getContractEnd(c);
            const dday      = contractEnd ? getDday(contractEnd) : null;
            const ddayFmt   = dday != null ? formatDday(dday) : null;
            const histOpen  = expandedHistories.has(c.id);

            return (
              <div key={c.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-2.5 group"
              >
                {/* 헤더: 거래처명 + 상태 토글 */}
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
                  <button
                    onClick={() => toggleStatus(c.id)}
                    title="클릭하여 상태 변경"
                    className={[
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer active:scale-95",
                      cfg.bgCls, cfg.borderCls, cfg.textCls, cfg.hoverCls,
                    ].join(" ")}
                  >
                    {STATUS_ICONS[c.status]}{cfg.label}
                  </button>
                </div>

                {/* 태그 */}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6C63FF]/10 text-[#6C63FF]">
                        {t}
                      </span>
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
                    <button
                      onClick={() => toggleHistory(c.id)}
                      className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition"
                    >
                      {histOpen ? <IconChevronUp className="w-3.5 h-3.5" /> : <IconChevronDown className="w-3.5 h-3.5" />}
                      히스토리 {c.statusHistory.length}건
                    </button>
                    {histOpen && (
                      <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto pl-1">
                        {[...c.statusHistory].reverse().map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={STATUS_CONFIG[h.status].textCls}>{STATUS_CONFIG[h.status].label}</span>
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
