"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { MENU_LOCALE_MAP } from "@/lib/menuSettings";
import type { TranslationKey } from "@/lib/i18n/translations";

const ROUTE_DESC_MAP: Record<string, TranslationKey> = {
  "/":          "desc_home",
  "/data":      "desc_data",
  "/todo":      "desc_todo",
  "/template":  "desc_template",
  "/qa":        "desc_qa",
  "/email":     "desc_email",
  "/summary":   "desc_summary",
  "/schedule":  "desc_schedule",
  "/translate": "desc_translate",
  "/calendar":  "desc_calendar",
  "/insight":   "desc_insight",
  "/glossary":  "desc_glossary",
  "/feedback":  "desc_feedback",
  "/content":   "desc_content",
  "/document":  "desc_document",
  "/clients":   "desc_clients",
  "/members":   "desc_members",
  "/settings":  "desc_settings",
};

const ROUTE_AI_CHIP: Record<string, boolean> = {
  "/":          false,
  "/data":      true,
  "/todo":      false,
  "/template":  true,
  "/qa":        true,
  "/email":     true,
  "/summary":   true,
  "/schedule":  true,
  "/translate": true,
  "/calendar":  false,
  "/insight":   true,
  "/glossary":  true,
  "/feedback":  true,
  "/content":   true,
  "/document":  true,
  "/clients":   false,
  "/members":   false,
  "/settings":  false,
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<"checking" | "connected" | "error">("checking");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // 스크롤바 드래그 중 강조 표시
  useEffect(() => {
    const onGrab = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const rect = el.getBoundingClientRect();
      const isScrollbarX = e.clientY > rect.bottom - 12 && e.clientY <= rect.bottom;
      const isScrollbarY = e.clientX > rect.right - 12 && e.clientX <= rect.right;
      if (isScrollbarX || isScrollbarY) {
        document.documentElement.setAttribute("data-scrolling", "true");
      }
    };
    const onRelease = () => {
      document.documentElement.removeAttribute("data-scrolling");
    };
    document.addEventListener("mousedown", onGrab);
    document.addEventListener("mouseup", onRelease);
    return () => {
      document.removeEventListener("mousedown", onGrab);
      document.removeEventListener("mouseup", onRelease);
    };
  }, []);

  // 라우트 변경 시 모바일 사이드바 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Groq API 연결 상태 확인 (최초 1회)
  useEffect(() => {
    fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "안녕" }],
        systemPrompt: "한 단어로만 대답하세요.",
      }),
    })
      .then((res) => setAiStatus(res.ok ? "connected" : "error"))
      .catch(() => setAiStatus("error"));
  }, []);

  const titleKey = MENU_LOCALE_MAP[pathname];
  const title    = titleKey ? t(titleKey) : pathname === "/settings" ? t("sidebar_settings") : "Worky";
  const desc     = ROUTE_DESC_MAP[pathname] ? t(ROUTE_DESC_MAP[pathname]) : "";
  const aiChip   = ROUTE_AI_CHIP[pathname] ?? false;

  // 로그인 페이지는 레이아웃 없이 children만 렌더링
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        aiStatus={aiStatus}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* 모바일 햄버거 헤더 */}
        <header className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="메뉴 열기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-base flex-1 text-[#4D44CC] dark:text-[#8B85FF]">Worky</span>
          <NotificationBell userId={userId} />
        </header>

        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{title}</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{desc}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {aiChip && (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
                AI 처리
              </span>
            )}
            <div className="hidden lg:block"><NotificationBell userId={userId} /></div>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-6 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
