export const OPTIONAL_MENU_ITEMS = [
  { href: "/content",   label: "메시지 작성" },
  { href: "/clients",   label: "거래처 관리" },
  { href: "/contacts",  label: "연락처 관리" },
  { href: "/template",  label: "템플릿 생성" },
  { href: "/document",  label: "공문서 작성" },
  { href: "/translate", label: "번역·다듬기" },
  { href: "/summary",   label: "문서 요약" },
  { href: "/data",      label: "데이터 정리" },
  { href: "/insight",   label: "데이터 분석" },
  { href: "/glossary",  label: "용어집" },
  { href: "/feedback",  label: "피드백 정리" },
] as const;

export const ALWAYS_VISIBLE_ITEMS = [
  { href: "/",         label: "Home" },
  { href: "/todo",     label: "할 일 / 메모" },
  { href: "/qa",       label: "Q&A" },
  { href: "/email",    label: "이메일 작성" },
  { href: "/schedule", label: "일정 추출" },
  { href: "/calendar", label: "일정 관리" },
] as const;

const OPTIONAL_HREF_SET = new Set<string>(OPTIONAL_MENU_ITEMS.map((i) => i.href));

export const MENU_SETTINGS_KEY   = "worky_menu_settings";
export const MENU_SETTINGS_EVENT = "workyMenuSettingsChanged";

export const MENU_ORDER_KEY   = "worky_menu_order";
export const MENU_ORDER_EVENT = "workyMenuOrderChanged";

export const HELP_BUTTON_KEY   = "worky_help_button";
export const HELP_BUTTON_EVENT = "workyHelpButtonChanged";

export type MenuSettings = Record<string, boolean>;

export function loadMenuSettings(): MenuSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(MENU_SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as MenuSettings;
  } catch {}
  return Object.fromEntries(OPTIONAL_MENU_ITEMS.map((i) => [i.href, true]));
}

export function saveMenuSettings(settings: MenuSettings): void {
  localStorage.setItem(MENU_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(MENU_SETTINGS_EVENT));
}

export function isRouteEnabled(settings: MenuSettings, href: string): boolean {
  if (!OPTIONAL_HREF_SET.has(href)) return true;
  return settings[href] !== false;
}

export function loadMenuOrder(): string[] {
  if (typeof window === "undefined") return OPTIONAL_MENU_ITEMS.map((i) => i.href);
  try {
    const raw = localStorage.getItem(MENU_ORDER_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as string[];
      // merge: add any new items not yet in stored order
      const merged = [
        ...stored.filter((h) => OPTIONAL_HREF_SET.has(h)),
        ...OPTIONAL_MENU_ITEMS.map((i) => i.href).filter((h) => !stored.includes(h)),
      ];
      return merged;
    }
  } catch {}
  return OPTIONAL_MENU_ITEMS.map((i) => i.href);
}

export function saveMenuOrder(order: string[]): void {
  localStorage.setItem(MENU_ORDER_KEY, JSON.stringify(order));
  window.dispatchEvent(new CustomEvent(MENU_ORDER_EVENT));
}

export function loadHelpButtonEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(HELP_BUTTON_KEY) !== "false";
}

export function saveHelpButtonEnabled(enabled: boolean): void {
  localStorage.setItem(HELP_BUTTON_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(HELP_BUTTON_EVENT));
}
