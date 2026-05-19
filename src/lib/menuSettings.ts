export const OPTIONAL_MENU_ITEMS = [
  { href: "/template", label: "템플릿 생성" },
  { href: "/translate", label: "번역·다듬기" },
  { href: "/summary",   label: "문서 요약" },
  { href: "/data",      label: "데이터 정리" },
  { href: "/insight",   label: "데이터 인사이트" },
  { href: "/glossary",  label: "용어집" },
  { href: "/clients",   label: "거래처 관리" },
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

export type MenuSettings = Record<string, boolean>;

export function loadMenuSettings(): MenuSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(MENU_SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as MenuSettings;
  } catch {}
  // 기본값: 모두 활성화
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
