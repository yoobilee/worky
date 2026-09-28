"use client";

import { useState, useEffect, useCallback, createContext, useRef } from "react";
import { createPortal } from "react-dom";
import { IconMenu2 } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { MENU_LOCALE_MAP } from "@/lib/menuSettings";
import type { TranslationKey } from "@/lib/i18n/translations";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { containDialogFocus } from "@/lib/dialogFocus";

export const HelpSlotContext = createContext<HTMLDivElement | null>(null);

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
  "/issues":    "desc_issues",
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
  "/issues":    true,
  "/content":   true,
  "/document":  true,
  "/clients":   false,
  "/members":   false,
  "/settings":  false,
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider><ShellContent>{children}</ShellContent></WorkspaceProvider>;
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerPresent, setDrawerPresent] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [aiStatus, setAiStatus] = useState<"checking" | "connected" | "error">("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [slotNode, setSlotNode] = useState<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const slotRef = useCallback((node: HTMLDivElement | null) => {
    setSlotNode(node);
  }, []);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  // 라우트 변경 시 모바일 사이드바 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (sidebarOpen) {
      if (!drawerPresent) { setDrawerPresent(true); return; }
      dialog.showModal();
      // Paint the starting position first. Cleanup cancels stale opens/closes.
      let enterFrame = 0;
      const frame = requestAnimationFrame(() => {
        enterFrame = requestAnimationFrame(() => setDrawerEntered(true));
      });
      return () => { cancelAnimationFrame(frame); cancelAnimationFrame(enterFrame); };
    }
    setDrawerEntered(false);
    if (!drawerPresent) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      // Wait for the actual CSS exit (also the shorter reduced-motion fade).
      // A fixed timer can remove the rail before its last frame on a busy device.
      const transitions = Array.from(dialog.querySelectorAll(".wk-rail, .wk-drawer-scrim"))
        .flatMap(element => element.getAnimations());
      Promise.all(transitions.map(animation => animation.finished.catch(() => {}))).then(() => {
        if (cancelled) return;
        dialog.close();
        setDrawerPresent(false);
        if (menuTriggerRef.current?.getClientRects().length) menuTriggerRef.current.focus();
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [sidebarOpen, drawerPresent]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) setSidebarOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

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
  const isGuest  = userEmail === "guest@worky-demo.com";

  // 로그인 페이지는 레이아웃 없이 children만 렌더링
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <HelpSlotContext.Provider value={slotNode}>
      <div className="wk-shell">
        <a href="#worky-main" className="wk-skip">{t("wk_skip")}</a>
        <div className="wk-desktop-rail"><Sidebar onClose={() => setSidebarOpen(false)} aiStatus={aiStatus} /></div>
        {mounted && createPortal(
          <dialog ref={drawerRef} id="worky-navigation" className="wk-drawer"
            data-state={sidebarOpen && drawerEntered ? "open" : "closed"}
            onKeyDown={containDialogFocus}
            aria-label={t("wk_workspace")} onCancel={event => { event.preventDefault(); setSidebarOpen(false); }}
            onClick={event => { if (event.target === event.currentTarget) setSidebarOpen(false); }}>
            <div className="wk-drawer-scrim" aria-hidden="true" onClick={() => setSidebarOpen(false)} />
            {drawerPresent && <Sidebar mobile onClose={() => setSidebarOpen(false)} aiStatus={aiStatus} />}
          </dialog>, document.body
        )}
        <div className="wk-shell-body">
          <header className="wk-topbar">
            <div className="wk-topbar-title">
              <button ref={menuTriggerRef} type="button" onClick={() => setSidebarOpen(true)}
                className="wk-icon-button wk-mobile-trigger" aria-label={t("wk_menu_open")}
                aria-expanded={sidebarOpen} aria-controls="worky-navigation"><IconMenu2 size={20} /></button>
              <div><h1>{title}</h1><p>{pathname === "/" ? t("wk_workspace") : desc}</p></div>
            </div>
            <div className="wk-topbar-actions">
              {aiChip && <span className="wk-badge">{t("wk_ai_feature")}</span>}
              {isGuest && <span className="wk-badge wk-badge--warning">{t("guest_mode_badge")}</span>}
              <div ref={slotRef} className="flex items-center gap-3" />
              <NotificationBell userId={userId} />
            </div>
          </header>
          <main id="worky-main" tabIndex={-1} className="wk-main">{children}</main>
        </div>
      </div>
    </HelpSlotContext.Provider>
  );
}
