"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSettings } from "@/lib/db/settings";
import {
  loadMenuSettings, loadMenuOrder, saveMenuSettings, saveMenuOrder,
  MENU_SETTINGS_EVENT, MENU_ORDER_EVENT, MENU_LOCALE_MAP, isRouteEnabled,
  type MenuSettings,
} from "@/lib/menuSettings";

const WorkspaceContext = createContext<{
  menuSettings: MenuSettings;
  menuOrder: string[];
  recentRoutes: string[];
}>({ menuSettings: {}, menuOrder: [], recentRoutes: [] });

export const useWorkspace = () => useContext(WorkspaceContext);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuSettings, setMenuSettings] = useState<MenuSettings>({});
  const [menuOrder, setMenuOrder] = useState<string[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    let edited = false;
    const refresh = () => {
      edited = true;
      setMenuSettings(loadMenuSettings());
      setMenuOrder(loadMenuOrder());
    };
    refresh();
    edited = false;
    window.addEventListener(MENU_SETTINGS_EVENT, refresh);
    window.addEventListener(MENU_ORDER_EVENT, refresh);
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const settings = await getSettings(data.user.id);
      // A settings edit made while the initial request was in flight wins.
      if (!active || edited || !settings) return;
      if (settings.menu_settings) saveMenuSettings(settings.menu_settings);
      if (settings.menu_order?.length) saveMenuOrder(settings.menu_order);
    }).catch(() => { /* Existing local settings remain usable when offline. */ });
    return () => {
      active = false;
      window.removeEventListener(MENU_SETTINGS_EVENT, refresh);
      window.removeEventListener(MENU_ORDER_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (pathname === "/login") {
      setRecentRoutes([]);
    } else if (pathname !== "/" && MENU_LOCALE_MAP[pathname]) {
      setRecentRoutes(previous => [pathname, ...previous.filter(route => route !== pathname)].slice(0, 4));
    }
  }, [pathname]);

  return <WorkspaceContext.Provider value={{
    menuSettings, menuOrder,
    recentRoutes: recentRoutes.filter(route => isRouteEnabled(menuSettings, route)),
  }}>{children}</WorkspaceContext.Provider>;
}
