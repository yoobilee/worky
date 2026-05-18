"use client";

import { useState, useEffect, useRef } from "react";
import { IconTrash } from "@tabler/icons-react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

type MemoTab = "업무" | "회의" | "개인";
type SaveStatus = "idle" | "saving" | "saved";

const MEMO_TABS: { id: MemoTab; label: string }[] = [
  { id: "업무", label: "업무 메모" },
  { id: "회의", label: "회의 메모" },
  { id: "개인", label: "개인 메모" },
];

const STORAGE_KEYS = {
  todos:   "worky_todos",
  memo_업무: "worky_memo_work",
  memo_회의: "worky_memo_meeting",
  memo_개인: "worky_memo_personal",
};

export default function TodoMemo() {
  const [todos,    setTodos]    = useState<Todo[]>([]);
  const [input,    setInput]    = useState("");
  const [memoTab,  setMemoTab]  = useState<MemoTab>("업무");
  const [memos,    setMemos]    = useState<Record<MemoTab, string>>({ 업무: "", 회의: "", 개인: "" });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hydrated, setHydrated] = useState(false);

  const inputRef      = useRef<HTMLInputElement>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // localStorage 로드
  useEffect(() => {
    try {
      const savedTodos = localStorage.getItem(STORAGE_KEYS.todos);
      if (savedTodos) setTodos(JSON.parse(savedTodos));

      // 각 탭별 메모 로드 (레거시 worky_memo → 업무 메모로 마이그레이션)
      const legacy = localStorage.getItem("worky_memo");
      setMemos({
        업무: localStorage.getItem(STORAGE_KEYS.memo_업무) ?? legacy ?? "",
        회의: localStorage.getItem(STORAGE_KEYS.memo_회의) ?? "",
        개인: localStorage.getItem(STORAGE_KEYS.memo_개인) ?? "",
      });
    } catch {}
    setHydrated(true);
  }, []);

  // 할 일 저장
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(todos));
  }, [todos, hydrated]);

  // 메모 변경 핸들러 (debounce 500ms + 저장 상태 표시)
  const handleMemoChange = (value: string) => {
    setMemos((prev) => ({ ...prev, [memoTab]: value }));
    setSaveStatus("saving");

    if (debounceRef.current)   clearTimeout(debounceRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    debounceRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS[`memo_${memoTab}`], value);
      setSaveStatus("saved");
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, 500);
  };

  // 탭 전환
  const handleTabChange = (tab: MemoTab) => {
    setMemoTab(tab);
    setSaveStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // 메모 전체 삭제
  const clearMemo = () => {
    if (!confirm("메모를 전체 삭제할까요?")) return;
    setMemos((prev) => ({ ...prev, [memoTab]: "" }));
    localStorage.removeItem(STORAGE_KEYS[`memo_${memoTab}`]);
    setSaveStatus("idle");
    if (debounceRef.current)   clearTimeout(debounceRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  };

  // 할 일 CRUD
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

  if (!hydrated) return null;

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full">

      {/* Bento 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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

      <div className="grid lg:grid-cols-2 gap-5">

        {/* 할 일 목록 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">할 일 목록</h2>

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
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: "var(--primary)" }}
            >
              추가
            </button>
          </div>

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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/60 group transition"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
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
                  <span className={`flex-1 text-sm ${todo.completed ? "line-through text-slate-400 dark:text-zinc-500" : "text-slate-700 dark:text-zinc-200"}`}>
                    {todo.text}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 text-red-400 transition"
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
              onClick={() => setTodos((prev) => prev.filter((t) => !t.completed))}
              className="text-xs text-slate-400 hover:text-red-400 transition text-left"
            >
              완료된 항목 모두 삭제
            </button>
          )}
        </div>

        {/* 메모 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm flex flex-col gap-3">

          {/* 헤더 */}
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

          {/* 탭 — 번역·다듬기와 동일 스타일 */}
          <div className="bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 grid grid-cols-3 gap-1">
            {MEMO_TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={[
                  "py-1.5 rounded-lg text-xs font-medium transition-colors",
                  memoTab === id
                    ? "bg-[#6C63FF] text-white shadow-sm"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {/* textarea */}
          <textarea
            value={memos[memoTab]}
            onChange={(e) => handleMemoChange(e.target.value)}
            placeholder="자유롭게 메모를 입력하세요..."
            className="flex-1 min-h-[200px] px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
          />

          {/* 글자 수 */}
          <p className="text-xs text-slate-400 dark:text-zinc-500 text-right">
            {memos[memoTab].length}자
          </p>

        </div>
      </div>
    </div>
  );
}
