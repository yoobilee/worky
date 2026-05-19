"use client";

import { useState, useEffect } from "react";
import {
  IconBuilding, IconPlus, IconPencil, IconTrash,
  IconCheck, IconAlertCircle, IconUser, IconNotes,
  IconCalendar, IconArrowsSort, IconX,
} from "@tabler/icons-react";

interface Client {
  id: string;
  name: string;
  contact: string;
  memo: string;
  reportedToday: boolean;
  lastReportDate: string | null;
  reportHistory: string[];
  createdAt: number;
}

type SortOrder = "unreported" | "name";

const STORAGE_KEY = "worky_clients";
const RESET_DATE_KEY = "worky_clients_reset_date";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatLastReport(dateStr: string | null): string {
  if (!dateStr) return "보고 기록 없음";
  const today = todayKey();
  const yesterday = yesterdayKey();
  if (dateStr === today) return "오늘 보고";
  if (dateStr === yesterday) return "어제 보고";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일 보고`;
}

function loadClients(): Client[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveClients(clients: Client[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

const EMPTY_FORM = { name: "", contact: "", memo: "" };

export default function ClientManager() {
  const [clients,   setClients]   = useState<Client[]>([]);
  const [hydrated,  setHydrated]  = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("unreported");
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);

  // 초기 로드 + 자정 기준 자동 초기화
  useEffect(() => {
    const today = todayKey();
    let clients = loadClients();

    const lastReset = localStorage.getItem(RESET_DATE_KEY);
    if (lastReset !== today) {
      clients = clients.map((c) => ({ ...c, reportedToday: false }));
      saveClients(clients);
      localStorage.setItem(RESET_DATE_KEY, today);
    }

    setClients(clients);
    setHydrated(true);
  }, []);

  // 보고 상태 토글
  const toggleReport = (id: string) => {
    const today = todayKey();
    setClients((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c;
        const nowReported = !c.reportedToday;
        const history = c.reportHistory ?? [];
        return {
          ...c,
          reportedToday: nowReported,
          lastReportDate: nowReported
            ? today
            : c.lastReportDate === today ? null : c.lastReportDate,
          reportHistory: nowReported
            ? history.includes(today) ? history : [...history, today]
            : history.filter((d) => d !== today),
        };
      });
      saveClients(updated);
      return updated;
    });
  };

  // 추가/수정 저장
  const handleSave = () => {
    if (!form.name.trim()) return;
    setClients((prev) => {
      let updated: Client[];
      if (editingId) {
        updated = prev.map((c) =>
          c.id !== editingId ? c : {
            ...c,
            name:    form.name.trim(),
            contact: form.contact.trim(),
            memo:    form.memo.trim(),
          }
        );
      } else {
        updated = [...prev, {
          id:            crypto.randomUUID(),
          name:          form.name.trim(),
          contact:       form.contact.trim(),
          memo:          form.memo.trim(),
          reportedToday: false,
          lastReportDate: null,
          reportHistory:  [],
          createdAt:      Date.now(),
        }];
      }
      saveClients(updated);
      return updated;
    });
    closeForm();
  };

  const startEdit = (c: Client) => {
    setEditingId(c.id);
    setForm({ name: c.name, contact: c.contact, memo: c.memo });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("이 거래처를 삭제할까요?")) return;
    setClients((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveClients(updated);
      return updated;
    });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  // 정렬
  const sorted = [...clients].sort((a, b) => {
    if (sortOrder === "unreported") {
      if (a.reportedToday !== b.reportedToday)
        return a.reportedToday ? 1 : -1;
    }
    return a.name.localeCompare(b.name, "ko");
  });

  const total    = clients.length;
  const reported = clients.filter((c) => c.reportedToday).length;
  const unre     = total - reported;

  if (!hydrated) return null;

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
            거래처 목록
          </h2>
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            총 {total}개
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortOrder((s) => s === "unreported" ? "name" : "unreported")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
          >
            <IconArrowsSort className="w-3.5 h-3.5" />
            {sortOrder === "unreported" ? "미보고 우선" : "거래처명순"}
          </button>
          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            <IconPlus className="w-4 h-4" />
            거래처 추가
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
            <button
              onClick={closeForm}
              className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                거래처명 <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="(주)워키코퍼레이션"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                담당자명
              </label>
              <input
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                placeholder="홍길동 과장"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                메모
              </label>
              <input
                value={form.memo}
                onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                placeholder="주요 관심사, 특이사항 등"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={closeForm}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
            >
              {editingId ? "수정 완료" : "추가"}
            </button>
          </div>
        </div>
      )}

      {/* 통계 — 하나의 카드 안에 묶기 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-zinc-800">
          <div className="px-6 py-4">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">전체</p>
            <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{total}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">보고완료</p>
            <p className="text-2xl font-bold mt-1 text-emerald-500">{reported}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">미보고</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{unre}</p>
          </div>
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
          {sorted.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3 group"
            >
              {/* 카드 헤더 */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">
                    {c.name}
                  </p>
                  {c.contact && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <IconUser className="w-3 h-3 text-slate-400 dark:text-zinc-500 shrink-0" />
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{c.contact}</p>
                    </div>
                  )}
                </div>
                {/* 보고 상태 토글 — 클릭 가능한 체크박스 스타일 */}
                <button
                  onClick={() => toggleReport(c.id)}
                  title={c.reportedToday ? "클릭하여 미보고로 변경" : "클릭하여 보고완료 처리"}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer select-none",
                    c.reportedToday
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 active:scale-95"
                      : "bg-red-100 dark:bg-red-950/40 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50 active:scale-95",
                  ].join(" ")}
                >
                  {/* 커스텀 체크박스 */}
                  <span className={[
                    "w-4 h-4 rounded flex items-center justify-center border transition-all",
                    c.reportedToday
                      ? "bg-emerald-500 border-emerald-500"
                      : "bg-white dark:bg-zinc-800 border-red-300 dark:border-red-700",
                  ].join(" ")}>
                    {c.reportedToday && <IconCheck className="w-2.5 h-2.5 text-white" />}
                  </span>
                  {c.reportedToday ? "보고완료" : "미보고"}
                </button>
              </div>

              {/* 메모 */}
              {c.memo && (
                <div className="flex items-start gap-1.5">
                  <IconNotes className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{c.memo}</p>
                </div>
              )}

              {/* 마지막 보고일 */}
              <div className="flex items-center gap-1.5">
                <IconCalendar className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                <p className={[
                  "text-xs",
                  c.lastReportDate === todayKey()
                    ? "text-emerald-500 font-medium"
                    : "text-slate-400 dark:text-zinc-500",
                ].join(" ")}>
                  {formatLastReport(c.lastReportDate)}
                </p>
              </div>

              {/* 수정/삭제 — 호버 시에만 노출 */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  onClick={() => startEdit(c)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                >
                  <IconPencil className="w-3.5 h-3.5" />수정
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                >
                  <IconTrash className="w-3.5 h-3.5" />삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
