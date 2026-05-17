"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconSun,
  IconMoon,
  IconLayoutSidebarLeftCollapse,
} from "@tabler/icons-react";
import { useTheme } from "./ThemeProvider";

/* ───────── 타입·상수 ───────── */

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
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    href: "/todo",
    label: "할 일 / 메모",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/qa",
    label: "Q&A",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: "/email",
    label: "이메일 작성",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/template",
    label: "템플릿 생성",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/translate",
    label: "번역·다듬기",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
  },
  {
    href: "/summary",
    label: "문서 요약",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/data",
    label: "데이터 정리",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h18M3 14h18M10 3v18M14 3v18" />
      </svg>
    ),
  },
  {
    href: "/schedule",
    label: "일정 추출",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/glossary",
    label: "용어집",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

const aiStatusConfig = {
  checking:  { dot: "bg-amber-400 animate-pulse", text: "AI 연결 확인 중..." },
  connected: { dot: "bg-emerald-400",             text: "Groq AI 연결됨"    },
  error:     { dot: "bg-red-400",                 text: "AI 연결 실패"      },
};

const COLLAPSED_KEY = "worky-sidebar-collapsed";

/* ───────── 컴포넌트 ───────── */

export default function Sidebar({ isOpen, onClose, aiStatus }: SidebarProps) {
  const pathname = usePathname();
  const status   = aiStatusConfig[aiStatus];
  const { theme, toggle: toggleTheme } = useTheme();

  const [collapsed, setCollapsed]   = useState(false);
  const [colMounted, setColMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved === "true") setCollapsed(true);
    setColMounted(true);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, String(next));
  };

  const isCollapsed = colMounted && collapsed;

  // 텍스트 공통 fade 클래스: 접힐 때 빠르게, 펼칠 때 지연 후 fade in
  const textFade = isCollapsed
    ? "max-w-0 opacity-0 duration-150"
    : "max-w-xs opacity-100 duration-200 delay-150";

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-30 flex flex-col shrink-0 overflow-hidden",
        "bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800",
        "transition-[width] duration-300 ease-in-out",
        "lg:static lg:translate-x-0",
        isCollapsed ? "w-16" : "w-64",
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
      ].join(" ")}
    >
      {/* ── 헤더 ── */}
      <div className="flex items-center gap-2 px-3 py-3.5 border-b border-slate-200 dark:border-zinc-800 shrink-0">
        {/* 로고 */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ background: "#6C63FF" }}
        >
          W
        </div>

        {/* Worky 텍스트 — fade + width 전환 */}
        <div className={`overflow-hidden transition-all whitespace-nowrap ${textFade}`}>
          <p className="font-bold text-sm leading-none" style={{ color: "var(--primary)" }}>Worky</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">AI 업무 보조</p>
        </div>

        {/* 다크모드 토글 — fade + width 전환 */}
        <div className={`overflow-hidden transition-all ${textFade}`}>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}
            className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === "dark" ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
          </button>
        </div>

        {/* 접기/펼치기 — 항상 표시, 아이콘 rotate */}
        <button
          onClick={toggleCollapse}
          aria-label={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
          className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0 ml-auto hidden lg:flex items-center"
        >
          <IconLayoutSidebarLeftCollapse
            className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? "rotate-180" : "rotate-0"}`}
          />
        </button>
      </div>

      {/* ── 네비게이션 ── */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto sidebar-nav-collapsed min-h-0">
        {/* "메뉴" 레이블 — fade + width */}
        <div className={`overflow-hidden transition-all ${textFade}`}>
          <p className="px-3 mb-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap">
            메뉴
          </p>
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "text-white shadow-md"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100",
              ].join(" ")}
              style={isActive ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
            >
              <span className={isActive ? "opacity-90" : "opacity-50"}>{item.icon}</span>
              {/* 레이블 — fade + max-width 전환 */}
              <span className={`overflow-hidden whitespace-nowrap transition-all ${textFade}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── 하단 ── */}
      <div className="shrink-0 px-3 py-3 border-t border-slate-200 dark:border-zinc-800">
        {/* 펼친 상태: full AI 상태 카드 */}
        <div className={`overflow-hidden transition-all ${textFade}`}>
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 whitespace-nowrap">
            <span className="relative flex shrink-0">
              <span className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
              {aiStatus === "connected" && (
                <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-60" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{status.text}</p>
              {aiStatus === "connected" && (
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">llama-3.3-70b</p>
              )}
            </div>
          </div>
        </div>

        {/* 접힌 상태: 다크모드 토글 + AI dot (역방향 fade) */}
        <div className={`overflow-hidden transition-all ${
          isCollapsed ? "max-w-xs opacity-100 duration-200 delay-150" : "max-w-0 opacity-0 duration-150"
        }`}>
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {theme === "dark" ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
            </button>
            <div className="relative flex">
              <span className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
              {aiStatus === "connected" && (
                <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-60" />
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
