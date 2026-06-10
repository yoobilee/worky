"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef, useCallback } from "react";
import ConfirmModal from "./ConfirmModal";
import { IconTrash, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { getTodos, upsertTodos, getPastTodoRows } from "@/lib/db/todos";
import { getMemos, upsertMemos } from "@/lib/db/memos";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  carriedOver?: boolean;
  originalDate?: string;
  originalId?: string;  // 이월 원본 todo의 id (중복 방지용)
}

type MemoTab = "업무" | "회의" | "개인";
type SaveStatus = "idle" | "saving" | "saved";

const MEMO_TABS: { id: MemoTab; label: string }[] = [
  { id: "업무", label: "업무 메모" },
  { id: "회의", label: "회의 메모" },
  { id: "개인", label: "개인 메모" },
];

const MEMO_DB_KEYS: Record<MemoTab, "work_memo" | "meeting_memo" | "personal_memo"> = {
  업무: "work_memo",
  회의: "meeting_memo",
  개인: "personal_memo",
};

const LEFT_RATIO_KEY = "todoMemoLeftRatio";
const MIN_RATIO = 0.3;
const MAX_RATIO = 0.7;

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return toDateKey(new Date());
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = DAY_LABELS[new Date(y, m - 1, d).getDay()];
  if (dateStr === todayKey()) return `오늘 · ${m}월 ${d}일 (${dow})`;
  return `${m}월 ${d}일 (${dow})`;
}

function formatOriginalDate(dateStr: string): string {
  const yesterday = shiftDate(todayKey(), -1);
  if (dateStr === yesterday) return "어제에서 이월";
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}월 ${d}일에서 이월`;
}

// 과거 날짜 미완료 항목 → 오늘로 이월 (id 기반 중복 방지)
async function doCarryoverAsync(
  userId: string,
  targetDate: string,
  existingTodos: Todo[]
): Promise<Todo[]> {
  const carriedIds = new Set(
    existingTodos.filter((t) => t.carriedOver && t.originalId).map((t) => t.originalId!)
  );

  const pastRows = await getPastTodoRows(userId, targetDate);
  const newCarryovers: Todo[] = [];

  for (const row of pastRows) {
    for (const t of row.todos) {
      if (t.completed || t.carriedOver) continue;
      if (carriedIds.has(t.id)) continue;
      newCarryovers.push({
        id: crypto.randomUUID(),
        text: t.text,
        completed: false,
        createdAt: Date.now(),
        carriedOver: true,
        originalDate: row.date,
        originalId: t.id,
      });
      carriedIds.add(t.id);
    }
  }

  if (newCarryovers.length === 0) return existingTodos;
  const merged = [...newCarryovers, ...existingTodos];
  await upsertTodos(userId, targetDate, merged);
  return merged;
}

export default function TodoMemo() {
  const [todos,        setTodos]        = useState<Todo[]>([]);
  const [input,        setInput]        = useState("");
  const [memoTab,        setMemoTab]        = useState<MemoTab>("업무");
  const [confirmAction,  setConfirmAction]  = useState<"memo" | "completed" | null>(null);
  const [memos,        setMemos]        = useState<Record<MemoTab, string>>({ 업무: "", 회의: "", 개인: "" });
  const [saveStatus,   setSaveStatus]   = useState<SaveStatus>("idle");
  const [hydrated,     setHydrated]     = useState(false);
  const [userId,       setUserId]       = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);

  // 커스텀 날짜 피커
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [pickerYear,  setPickerYear]  = useState(() => new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth());

  // 좌우 패널 리사이즈
  const [leftRatio,    setLeftRatio]    = useState(0.5);
  const [isDragging,   setIsDragging]   = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  const inputRef        = useRef<HTMLInputElement>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerRef       = useRef<HTMLDivElement>(null);
  const selectedDateRef = useRef<string>(selectedDate);
  const containerRef    = useRef<HTMLDivElement>(null);
  const leftRatioRef    = useRef(leftRatio);

  // 패널 비율 복원 + 화면 크기 감지
  useEffect(() => {
    const saved = localStorage.getItem(LEFT_RATIO_KEY);
    if (saved) {
      const ratio = parseFloat(saved);
      if (!isNaN(ratio) && ratio >= MIN_RATIO && ratio <= MAX_RATIO) {
        setLeftRatio(ratio);
        leftRatioRef.current = ratio;
      }
    }

    const mq = window.matchMedia("(min-width: 1024px)");
    setIsLargeScreen(mq.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsLargeScreen(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // 패널 드래그 리사이즈
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, (e.clientX - rect.left) / rect.width));
      leftRatioRef.current = ratio;
      setLeftRatio(ratio);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem(LEFT_RATIO_KEY, String(leftRatioRef.current));
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // 피커 외부 클릭 닫기
  useEffect(() => {
    if (!pickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  // 초기 로드
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const today = todayKey();
        let todayTodos = await getTodos(uid, today);
        todayTodos = await doCarryoverAsync(uid, today, todayTodos);
        setTodos(todayTodos);

        const memoData = await getMemos(uid);
        setMemos({
          업무: memoData.work_memo     ?? "",
          회의: memoData.meeting_memo  ?? "",
          개인: memoData.personal_memo ?? "",
        });
      }
      setHydrated(true);
    });
  }, []);

  // 할 일 저장 (Supabase)
  useEffect(() => {
    if (!hydrated || !userId) return;
    upsertTodos(userId, selectedDateRef.current, todos).catch(() => {});
  }, [todos, hydrated, userId]);

  // 날짜 이동 + 이월 처리
  const goToDate = useCallback(async (newDate: string) => {
    selectedDateRef.current = newDate;
    setSelectedDate(newDate);
    setPickerOpen(false);
    if (!userId) { setTodos([]); return; }
    let loaded = await getTodos(userId, newDate);
    if (newDate === todayKey()) {
      loaded = await doCarryoverAsync(userId, newDate, loaded);
    }
    setTodos(loaded);
  }, [userId]);

  const openPicker = () => {
    const [y, m] = selectedDate.split("-").map(Number);
    setPickerYear(y);
    setPickerMonth(m - 1);
    setPickerOpen(true);
  };

  const prevPickerMonth = () => setPickerMonth((m) => m === 0 ? (setPickerYear((y) => y - 1), 11) : m - 1);
  const nextPickerMonth = () => setPickerMonth((m) => m === 11 ? (setPickerYear((y) => y + 1), 0) : m + 1);

  // 피커 날짜 그리드 계산
  const pickerFirstDow    = new Date(pickerYear, pickerMonth, 1).getDay();
  const pickerDaysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const pickerCells: (number | null)[] = [
    ...Array(pickerFirstDow).fill(null),
    ...Array.from({ length: pickerDaysInMonth }, (_, i) => i + 1),
  ];
  while (pickerCells.length % 7 !== 0) pickerCells.push(null);

  // 메모 변경 (debounce 500ms → Supabase 저장)
  const handleMemoChange = (value: string) => {
    setMemos((prev) => ({ ...prev, [memoTab]: value }));
    setSaveStatus("saving");
    if (debounceRef.current)   clearTimeout(debounceRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    debounceRef.current = setTimeout(() => {
      if (userId) upsertMemos(userId, { [MEMO_DB_KEYS[memoTab]]: value }).catch(() => {});
      setSaveStatus("saved");
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, 500);
  };

  const handleTabChange = (tab: MemoTab) => {
    setMemoTab(tab);
    setSaveStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const clearMemo = () => setConfirmAction("memo");
  const doClearMemo = () => {
    setMemos((prev) => ({ ...prev, [memoTab]: "" }));
    if (userId) upsertMemos(userId, { [MEMO_DB_KEYS[memoTab]]: "" }).catch(() => {});
    setSaveStatus("idle");
    if (debounceRef.current)   clearTimeout(debounceRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setConfirmAction(null);
  };

  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, completed: false, createdAt: Date.now() },
    ]);
    setInput("");
    inputRef.current?.focus();
  };

  const toggleTodo = (id: string) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const deleteTodo = (id: string) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));

  const total     = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const progress  = total === 0 ? 0 : Math.round((completed / total) * 100);
  const isToday   = selectedDate === todayKey();

  if (!hydrated) return null;

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full h-full flex flex-col">

      {confirmAction === "completed" && (
        <ConfirmModal
          message="오늘의 할 일을 모두 삭제하시겠습니까?"
          onConfirm={() => { setTodos((prev) => prev.filter((t) => !t.completed)); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "memo" && (
        <ConfirmModal
          message="메모를 모두 삭제하시겠습니까?"
          onConfirm={doClearMemo}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Bento 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">전체 할 일</p>
          <p className="text-3xl font-bold mt-2 text-slate-800 dark:text-slate-100">{total}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">완료</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "var(--primary)" }}>{completed}</p>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">진행률</p>
            <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{progress}%</span>
          </div>
          <div className="mt-3 h-2 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #6C63FF, #9C95FF)" }}
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">{total - completed}개 남음</p>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5 lg:gap-0">

        {/* 할 일 목록 */}
        <div
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm flex flex-col gap-4 h-full min-w-0 overflow-hidden"
          style={isLargeScreen ? { width: `calc(${leftRatio * 100}% - 6px)`, flexShrink: 0 } : undefined}
        >

          {/* 날짜 네비게이션 */}
          <div className="flex items-center justify-between relative" ref={pickerRef}>
            <button
              onClick={() => goToDate(shiftDate(selectedDate, -1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 transition-colors"
              aria-label="이전 날짜"
            >
              <IconChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={openPicker}
                className="text-sm font-semibold text-slate-700 dark:text-zinc-200 hover:text-[#6C63FF] dark:hover:text-[#8B85FF] transition-colors whitespace-nowrap"
              >
                {formatDateLabel(selectedDate)}
              </button>
              {!isToday && (
                <button
                  onClick={() => goToDate(todayKey())}
                  className="text-xs px-2 py-0.5 rounded-full bg-[#6C63FF]/10 text-[#6C63FF] hover:bg-[#6C63FF]/20 transition-colors font-medium whitespace-nowrap"
                >
                  오늘로
                </button>
              )}
            </div>

            <button
              onClick={() => goToDate(shiftDate(selectedDate, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 transition-colors"
              aria-label="다음 날짜"
            >
              <IconChevronRight className="w-4 h-4" />
            </button>

            {/* 커스텀 날짜 피커 드롭다운 */}
            {pickerOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl p-3 w-64">
                {/* 피커 헤더 */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <button
                    onClick={prevPickerMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 transition-colors"
                  >
                    <IconChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                    {pickerYear}년 {MONTH_NAMES[pickerMonth]}
                  </span>
                  <button
                    onClick={nextPickerMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 transition-colors"
                  >
                    <IconChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 mb-1">
                  {DAY_LABELS.map((d, i) => (
                    <div key={d} className={`text-center text-[10px] font-medium py-1 ${
                      i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400 dark:text-zinc-500"
                    }`}>{d}</div>
                  ))}
                </div>

                {/* 날짜 그리드 */}
                <div className="grid grid-cols-7 gap-0.5">
                  {pickerCells.map((day, idx) => {
                    if (day === null) return <div key={idx} />;
                    const key  = `${pickerYear}-${String(pickerMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isSel   = key === selectedDate;
                    const isToday = key === todayKey();
                    const dow     = (pickerFirstDow + day - 1) % 7;
                    return (
                      <button
                        key={idx}
                        onClick={() => goToDate(key)}
                        className={[
                          "h-7 w-full rounded-lg text-xs font-medium transition-all",
                          isSel
                            ? "text-white shadow-sm"
                            : isToday
                            ? "bg-[#6C63FF]/10 text-[#6C63FF]"
                            : "hover:bg-slate-100 dark:hover:bg-zinc-800",
                          !isSel && dow === 0 ? "text-red-400"
                          : !isSel && dow === 6 ? "text-blue-400"
                          : !isSel && !isToday ? "text-slate-700 dark:text-zinc-300"
                          : "",
                        ].join(" ")}
                        style={isSel ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 입력 */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              placeholder="새 할 일 추가..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
            <button
              onClick={addTodo}
              disabled={!input.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 whitespace-nowrap shrink-0 min-w-fit"
              style={{ background: "var(--primary)" }}
            >
              추가
            </button>
          </div>

          {/* 목록 */}
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {todos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-300 dark:text-zinc-600">
                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">할 일이 없습니다</p>
              </div>
            ) : (
              todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/60 group transition"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mt-0.5"
                    style={todo.completed
                      ? { background: "var(--primary)", borderColor: "var(--primary)" }
                      : { borderColor: "#cbd5e1" }}
                  >
                    {todo.completed && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${todo.completed ? "line-through text-slate-400 dark:text-zinc-500" : "text-slate-700 dark:text-zinc-200"}`}>
                      {todo.text}
                    </span>
                    {todo.carriedOver && todo.originalDate && (
                      <p className="text-[10px] text-[#6C63FF]/60 dark:text-[#8B85FF]/60 mt-0.5">
                        {formatOriginalDate(todo.originalDate)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 text-red-400 transition shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {todos.some((t) => t.completed) && (
            <button
              onClick={() => setConfirmAction("completed")}
              className="text-xs text-slate-400 hover:text-red-400 transition text-left whitespace-nowrap"
            >
              완료된 항목 모두 삭제
            </button>
          )}
        </div>

        {/* 리사이즈 핸들 */}
        <div
          onMouseDown={handleDragStart}
          className="hidden lg:block relative w-3 shrink-0 cursor-col-resize group"
        >
          <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-slate-200 dark:bg-zinc-800 group-hover:bg-[#6C63FF] transition-colors" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-600 group-hover:bg-[#6C63FF] transition-colors"
              />
            ))}
          </div>
        </div>

        {/* 메모 (날짜 무관) */}
        <div
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm flex flex-col gap-3 h-full min-w-0 overflow-hidden"
          style={isLargeScreen ? { width: `calc(${(1 - leftRatio) * 100}% - 6px)`, flexShrink: 0 } : undefined}
        >

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">메모</h2>
            <div className="flex items-center gap-2">
              {saveStatus === "saving" && (
                <span className="text-xs text-slate-400 dark:text-zinc-500">저장 중...</span>
              )}
              {saveStatus === "saved" && (
                <span className="text-xs text-emerald-500 font-medium">방금 저장됨 ✓</span>
              )}
              <button
                onClick={clearMemo}
                aria-label="메모 전체 삭제"
                className="p-1 rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-400 transition-colors"
              >
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 grid grid-cols-3 gap-1">
            {MEMO_TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={[
                  "py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap min-w-0",
                  memoTab === id
                    ? "bg-[#6C63FF] text-white shadow-sm"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          <textarea
            value={memos[memoTab]}
            onChange={(e) => handleMemoChange(e.target.value)}
            placeholder="자유롭게 메모를 입력하세요..."
            className="flex-1 min-h-[200px] px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
          />

          <p className="text-xs text-slate-400 dark:text-zinc-500 text-right">
            {memos[memoTab].length}자
          </p>
        </div>
      </div>
      <HelpButton
        title="할 일 / 메모 사용법"
        steps={[
          { step: "날짜 선택", desc: "상단 날짜 버튼으로 원하는 날짜로 이동하세요." },
          { step: "할 일 추가", desc: "입력란에 작업을 입력하고 Enter를 누르세요." },
          { step: "완료 체크", desc: "체크박스 클릭으로 완료/미완료를 전환합니다." },
          { step: "자동 이월", desc: "미완료 항목은 다음 날 자동으로 이월됩니다." },
        ]}
      />
    </div>
  );
}
