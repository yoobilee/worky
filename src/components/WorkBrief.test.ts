import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translations, type Locale, type TranslationKey } from "../lib/i18n/translations";
import WorkBrief from "./WorkBrief";

const state = vi.hoisted(() => ({ locale: "ko" as Locale }));
vi.mock("@/lib/i18n/LocaleContext", () => ({
  useLocale: () => ({ t: (key: TranslationKey) => translations[state.locale][key] }),
}));
vi.mock("@/lib/i18n/translations", () => import("../lib/i18n/translations"));

const empty = { weekTotal: 0, leaveRemaining: null, features: [], tip: "" };

describe("WorkBrief rendering", () => {
  it("omits the entire section when no information exists", () => {
    expect(renderToStaticMarkup(createElement(WorkBrief, empty))).toBe("");
  });
  it("renders a compact single group for a tip only, without empty metric labels", () => {
    const html = renderToStaticMarkup(createElement(WorkBrief, { ...empty, tip: "수신자를 확인하세요." }));
    expect(html).toContain('data-columns="1"');
    expect(html).toContain("수신자를 확인하세요.");
    expect(html).not.toContain("잔여 연차");
    expect(html).not.toContain("이번 주 활동");
    expect(html).not.toContain("자주 사용한 기능");
    expect(html).toContain('aria-expanded="false"');
    const target = html.match(/aria-controls="([^"]+)"/)![1];
    expect(html).toContain(`id="${target}"`);
    expect(html).toContain('hidden=""');
  });
  it("keeps zero days and summarizes real metrics in priority order", () => {
    const html = renderToStaticMarkup(createElement(WorkBrief, { ...empty, weekTotal: 12, leaveRemaining: 0, tip: "오늘의 팁", features: [{ href: "/data", label: "데이터 정리" }] }));
    expect(html).toContain("이번 주 활동 12회 · 남은 연차 0일");
    expect(html).toContain('data-columns="3"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('href="/data"');
  });
  it("omits unavailable numbers and whitespace-only tips", () => {
    expect(renderToStaticMarkup(createElement(WorkBrief, { ...empty, weekTotal: NaN, leaveRemaining: NaN, tip: "  " }))).toBe("");
  });
  it("uses available features when neither metric exists", () => {
    const html = renderToStaticMarkup(createElement(WorkBrief, { ...empty, features: [{ href: "/summary", label: "문서 요약" }] }));
    expect(html).toContain("자주 사용한 기능 · 문서 요약");
    expect(html).toContain('data-columns="1"');
  });
  it("renders the English title and summaries", () => {
    state.locale = "en";
    try {
      const html = renderToStaticMarkup(createElement(WorkBrief, { ...empty, weekTotal: 12, leaveRemaining: 4 }));
      expect(html).toContain("Work brief");
      expect(html).toContain("12 activities this week · 4 days of leave left");
      expect(html).not.toContain("업무 브리핑");
    } finally { state.locale = "ko"; }
  });
});
