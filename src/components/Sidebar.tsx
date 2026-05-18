"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSun, IconMoon, IconLayoutSidebarLeftCollapse, IconChartBar } from "@tabler/icons-react";
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
    href: "/translate",
    label: "번역·다듬기",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
  },
  {
    href: "/summary",
    label: "문서 요약",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h10" />
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
    href: "/schedule",
    label: "일정 추출",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/insight",
    label: "데이터 인사이트",
    icon: <IconChartBar className="w-4 h-4" />,
  },
  {
    href: "/glossary",
    label: "용어집",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

const statusConfig = {
  checking:  { dot: "bg-amber-400 animate-pulse", label: "AI 연결 확인 중..." },
  connected: { dot: "bg-emerald-400",             label: "Groq AI 연결됨"    },
  error:     { dot: "bg-red-400",                 label: "AI 연결 실패"      },
};

const COLLAPSED_KEY = "worky-sidebar-collapsed";

export default function Sidebar({ isOpen, onClose, aiStatus }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggle: toggleTheme } = useTheme();
  const st = statusConfig[aiStatus];

  const [collapsed, setCollapsed] = useState(false);
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, String(next));
  };

  const isCollapsed = mounted && collapsed;

  // 텍스트 표시 전략:
  //   접힐 때 → 즉시 사라짐 (w-0 overflow-hidden, transition 없음)
  //   펼칠 때 → 너비 transition(300ms) 완료 후 fade in (delay-[260ms] duration-150)
  const labelCls = isCollapsed
    ? "w-0 overflow-hidden opacity-0 whitespace-nowrap pointer-events-none"
    : "opacity-100 whitespace-nowrap transition-opacity duration-150 delay-[260ms]";

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-30 flex flex-col shrink-0 overflow-hidden",
        "bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800",
        "transition-[width] duration-300 ease-in-out",
        "lg:static lg:translate-x-0",
        isCollapsed ? "w-14" : "w-56",
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
      ].join(" ")}
    >

      {/* ── 헤더 ── */}
      {isCollapsed ? (
        /* 접힌 상태: 토글 버튼만 중앙 정렬 */
        <div className="flex justify-center items-center h-14 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <button
            onClick={toggleCollapse}
            aria-label="사이드바 펼치기"
            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors hidden lg:flex"
          >
            <IconLayoutSidebarLeftCollapse className="w-4 h-4 rotate-180" />
          </button>
        </div>
      ) : (
        /* 펼친 상태: 로고 + 텍스트 + 토글 */
        <div className="flex items-center h-14 px-3 gap-2 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <img src="/favicon.svg" alt="Worky" width={28} height={28} className="shrink-0" />
          <div className="flex-1 overflow-hidden">
            <p
              className="font-bold text-sm leading-none whitespace-nowrap opacity-100 transition-opacity duration-150 delay-[260ms]"
              style={{ color: "var(--primary)" }}
            >
              Worky
            </p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 whitespace-nowrap opacity-100 transition-opacity duration-150 delay-[260ms]">
              AI 업무 보조
            </p>
          </div>
          <button
            onClick={toggleCollapse}
            aria-label="사이드바 접기"
            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors shrink-0 hidden lg:flex"
          >
            <IconLayoutSidebarLeftCollapse className="w-4 h-4 transition-transform duration-300" />
          </button>
        </div>
      )}

      {/* ── 네비게이션 ── */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={isCollapsed ? item.label : undefined}
              className={[
                "flex items-center px-2.5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isCollapsed ? "justify-center" : "gap-3",
                active
                  ? "text-white shadow-sm"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100",
              ].join(" ")}
              style={active ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
            >
              <span className={`shrink-0 ${active ? "opacity-90" : "opacity-60"}`}>
                {item.icon}
              </span>
              {/* inline-block으로 w-0 적용 가능하게 */}
              <span className={`inline-block ${labelCls}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── 하단 푸터 ── */}
      <div className="shrink-0 border-t border-slate-200 dark:border-zinc-800 px-2 py-2 space-y-1">

        {/* 다크모드 토글 */}
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}
          title={isCollapsed ? (theme === "dark" ? "라이트 모드" : "다크 모드") : undefined}
          className={[
            "w-full flex items-center px-2.5 py-2 rounded-xl text-sm",
            "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800",
            "hover:text-slate-700 dark:hover:text-zinc-200 transition-colors",
            isCollapsed ? "justify-center" : "gap-3",
          ].join(" ")}
        >
          <span className="shrink-0">
            {theme === "dark" ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
          </span>
          <span className={`inline-block ${labelCls}`}>
            {theme === "dark" ? "라이트 모드" : "다크 모드"}
          </span>
        </button>

        {/* AI 연결 상태 */}
        <div
          title={isCollapsed ? st.label : undefined}
          className={[
            "flex items-center rounded-xl",
            isCollapsed
              ? "justify-center px-2 py-2"
              : "gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700",
          ].join(" ")}
        >
          <span className="relative flex shrink-0">
            <span className={`w-2 h-2 rounded-full ${st.dot}`} />
            {aiStatus === "connected" && (
              <span className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-60" />
            )}
          </span>
          <div className={`min-w-0 inline-block ${labelCls}`}>
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">
              {st.label}
            </p>
            {aiStatus === "connected" && (
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 whitespace-nowrap">
                llama-3.3-70b
              </p>
            )}
          </div>
        </div>

      </div>
    </aside>
  );
}
