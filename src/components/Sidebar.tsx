"use client";

import type { Tab } from "@/types";

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  isOpen: boolean;
  aiStatus: "checking" | "connected" | "error";
}

const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "data",
    label: "데이터 정리",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h18M3 14h18M10 3v18M14 3v18" />
      </svg>
    ),
  },
  {
    id: "todo",
    label: "할 일 / 메모",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "template",
    label: "템플릿 생성",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "qna",
    label: "Q&A",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: "email",
    label: "이메일 작성",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const aiStatusConfig = {
  checking: { dot: "bg-amber-400 animate-pulse", text: "AI 연결 확인 중..." },
  connected: { dot: "bg-emerald-400", text: "Groq AI 연결됨" },
  error:     { dot: "bg-red-400", text: "AI 연결 실패" },
};

export default function Sidebar({ activeTab, onTabChange, isOpen, aiStatus }: SidebarProps) {
  const status = aiStatusConfig[aiStatus];

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-30 flex flex-col w-64 shrink-0",
        "bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800",
        "transition-transform duration-300 ease-in-out",
        "lg:static lg:translate-x-0",
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
      ].join(" ")}
    >
      {/* 로고 */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-zinc-800">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm text-white font-bold text-sm"
          style={{ background: "#6C63FF" }}
        >
          W
        </div>
        <div>
          <p className="font-bold leading-none" style={{ color: "var(--primary)" }}>Worky</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">AI 업무 보조</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 mb-3 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
          메뉴
        </p>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={[
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                "transition-all duration-150 text-left",
                isActive
                  ? "text-white shadow-md"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100",
              ].join(" ")}
              style={isActive ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
            >
              <span className={isActive ? "opacity-90" : "opacity-50"}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* AI 연결 상태 */}
      <div className="px-4 py-4 border-t border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800">
          <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} />
          <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">{status.text}</span>
        </div>
      </div>
    </aside>
  );
}
