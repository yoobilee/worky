"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconSun, IconMoon, IconLayoutSidebarLeftCollapse, IconSettings, IconLogout, IconX } from "@tabler/icons-react";
import { useTheme } from "./ThemeProvider";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { MENU_LOCALE_MAP, ALWAYS_VISIBLE_ITEMS } from "@/lib/menuSettings";
import { workspaceRoutes } from "@/lib/workspaceNavigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useWorkspace } from "./WorkspaceProvider";
import WorkspaceIcon from "./WorkspaceIcon";
import WorkyFlow from "./WorkyFlow";

interface SidebarProps {
  onClose: () => void;
  aiStatus: "checking" | "connected" | "error";
  mobile?: boolean;
}

export default function Sidebar({ onClose, aiStatus, mobile = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { t } = useLocale();
  const { menuSettings, menuOrder, recentRoutes } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("worky-sidebar-collapsed") === "true");
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const isCollapsed = !mobile && collapsed;
  const routes = workspaceRoutes(menuSettings, menuOrder);
  const fixed = ALWAYS_VISIBLE_ITEMS.map(item => item.href) as string[];
  const groups = [
    { label: t("wk_core"), routes: routes.filter(route => route !== "/" && fixed.includes(route)) },
    { label: t("wk_tools"), routes: routes.filter(route => !fixed.includes(route)) },
  ];
  const status = t(aiStatus === "connected" ? "ai_connected" : aiStatus === "error" ? "ai_error" : "ai_checking");
  const renderLink = (route: string) => <Link key={route} href={route} onClick={onClose}
    aria-label={t(MENU_LOCALE_MAP[route])} title={isCollapsed ? t(MENU_LOCALE_MAP[route]) : undefined}
    aria-current={pathname === route ? "page" : undefined} className="wk-nav-link">
    <WorkspaceIcon route={route} />
    <span className="wk-rail-label">{t(MENU_LOCALE_MAP[route])}</span>
    <WorkyFlow compact />
  </Link>;

  return <aside className={`wk-rail${isCollapsed ? " wk-rail--collapsed" : ""}`} aria-label={t("wk_workspace")}>
    <div className="wk-rail-brand">
      <Link href="/" onClick={onClose} className="wk-brand-link" aria-label="Worky">
        <img src="/favicon-48.png" width={30} height={30} alt="" />
        <span className="wk-brand-word">Worky</span>
      </Link>
      <button type="button" className="wk-icon-button wk-desktop-collapse"
        aria-label={t(isCollapsed ? "wk_menu_expand" : "wk_menu_collapse")}
        aria-expanded={!isCollapsed} onClick={() => {
          setCollapsed(!collapsed);
          localStorage.setItem("worky-sidebar-collapsed", String(!collapsed));
        }}><IconLayoutSidebarLeftCollapse size={18} style={isCollapsed ? { transform: "rotate(180deg)" } : undefined} /></button>
      {mobile && <button type="button" className="wk-icon-button wk-mobile-close" onClick={onClose} aria-label={t("wk_menu_close")}><IconX size={20} /></button>}
    </div>
    <div className="wk-rail-scroll">
    <nav className="wk-rail-nav" aria-label={t("wk_workspace")}>
      {renderLink("/")}
      {groups.map(group => group.routes.length > 0 && <div className="wk-nav-group" key={group.label}>
        <p className="wk-nav-label">{group.label}</p>
        {group.routes.map(renderLink)}
      </div>)}
    </nav>
      {recentRoutes.length > 0 && <section className="wk-nav-group" aria-label={t("wk_recent_hint")}>
        <p className="wk-nav-label">{t("wk_recent_hint")}</p>
        {recentRoutes.slice(0, 3).map(route => <Link key={route} href={route} onClick={onClose} className="wk-nav-link" title={t(MENU_LOCALE_MAP[route])}>
          <WorkspaceIcon route={route} /><span className="wk-rail-label">{t(MENU_LOCALE_MAP[route])}</span>
        </Link>)}
      </section>}
    </div>
    <div className="wk-rail-footer">
      <div className="wk-rail-status" data-state={aiStatus} role="status" title={status}>
        <span className="wk-status-dot" aria-hidden="true" /><span className={isCollapsed ? "sr-only" : "wk-rail-label"}>{status}</span>
      </div>
      <Link href="/settings" onClick={onClose} className="wk-nav-link" aria-label={t("sidebar_settings")} title={t("sidebar_settings")} aria-current={pathname === "/settings" ? "page" : undefined}>
        <IconSettings size={18} /><span className="wk-rail-label">{t("sidebar_settings")}</span><WorkyFlow compact />
      </Link>
      <button type="button" onClick={toggle} className="wk-nav-link w-full" aria-label={t(theme === "dark" ? "theme_light" : "theme_dark")} title={t(theme === "dark" ? "theme_light" : "theme_dark")}>
        {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}<span className="wk-rail-label">{t(theme === "dark" ? "theme_light" : "theme_dark")}</span>
      </button>
      {user && <div className="wk-account">
        <span className="wk-avatar" aria-hidden="true">{(user.user_metadata?.full_name ?? user.email ?? "W")[0].toUpperCase()}</span>
        <span className="wk-account-name" title={user.email}>{user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? t("wk_account")}</span>
        <button type="button" className="wk-icon-button" disabled={loggingOut} aria-label={t("wk_logout")} title={t("wk_logout")} onClick={async () => {
          setLoggingOut(true);
          await createClient().auth.signOut();
          router.push("/login");
        }}><IconLogout size={18} /></button>
      </div>}
    </div>
  </aside>;
}
