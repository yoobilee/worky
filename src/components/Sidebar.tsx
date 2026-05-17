"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { useTheme } from "./ThemeProvider";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  aiStatus: "checking" | "connected" | "error";
}

const navItems = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    href: "/data",
    label: "데이터 정리",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h18M3 14h18M10 3v18M14 3v18" />
      </svg>
    ),
  },
  {
    href: "/todo",
    label: "할 일 / 메모",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/template",
    label: "템플릿 생성",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/qa",
    label: "Q&A",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: "/email",
    label: "이메일 작성",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/summary",
    label: "문서 요약",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/schedule",
    label: "일정 추출",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const aiStatusConfig = {
  checking:  { dot: "bg-amber-400 animate-pulse", text: "AI 연결 확인 중..." },
  connected: { dot: "bg-emerald-400",             text: "Groq AI 연결됨"    },
  error:     { dot: "bg-red-400",                 text: "AI 연결 실패"      },
};

export default function Sidebar({ isOpen, onClose, aiStatus }: SidebarProps) {
  const pathname = usePathname();
  const status = aiStatusConfig[aiStatus];
  const { theme, toggle } = useTheme();

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
      {/* 로고 + 다크모드 토글 */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm text-white font-bold text-sm shrink-0"
          style={{ background: "#6C63FF" }}
        >
          W
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold leading-none" style={{ color: "var(--primary)" }}>Worky</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">AI 업무 보조</p>
        </div>
        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-zinc-100 transition-colors shrink-0"
        >
          {theme === "dark" ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-5 pb-3 space-y-1 overflow-y-auto min-h-0">
        <p className="px-3 mb-3 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
          메뉴
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={[
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                "transition-all duration-150",
                isActive
                  ? "text-white shadow-md"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100",
              ].join(" ")}
              style={isActive ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
            >
              <span className={isActive ? "opacity-90" : "opacity-50"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* AI 연결 상태 */}
      <div className="shrink-0 px-4 py-4 border-t border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700">
          <span className="relative flex shrink-0">
            <span className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
            {aiStatus === "connected" && (
              <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-60" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{status.text}</p>
            {aiStatus === "connected" && (
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">llama-3.3-70b</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
