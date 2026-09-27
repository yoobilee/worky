import { ALWAYS_VISIBLE_ITEMS, isRouteEnabled, OPTIONAL_MENU_ITEMS, type MenuSettings } from "./menuSettings";

/** Keep the existing fixed routes, and preserve the user's optional route order. */
export function workspaceRoutes(settings: MenuSettings, order: string[]): string[] {
  const optional = OPTIONAL_MENU_ITEMS.map(item => item.href) as string[];
  const ordered = [...new Set([...order, ...optional])]
    .filter(route => optional.includes(route) && isRouteEnabled(settings, route));
  return [...ALWAYS_VISIBLE_ITEMS.map(item => item.href), ...ordered];
}
