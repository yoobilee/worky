import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translations, type Locale, type TranslationKey } from "../lib/i18n/translations";
import HomeAccountStatus from "./HomeAccountStatus";

const state = vi.hoisted(() => ({ locale: "ko" as Locale }));
vi.mock("@/lib/i18n/LocaleContext", () => ({
  useLocale: () => ({ t: (key: TranslationKey) => translations[state.locale][key] }),
}));
vi.mock("@/lib/i18n/translations", () => import("../lib/i18n/translations"));

const empty = { weekTotal: 0, leaveRemaining: null };

describe("HomeAccountStatus rendering", () => {
  it("omits the entire section when no information exists", () => {
    expect(renderToStaticMarkup(createElement(HomeAccountStatus, empty))).toBe("");
  });
  it("shows activity alone without a disclosure, tip, separator or empty leave link", () => {
    const html = renderToStaticMarkup(createElement(HomeAccountStatus, { ...empty, weekTotal: 12 }));
    expect(html).toContain("이번 주 활동 12회");
    expect(html).not.toContain("연차");
    expect(html).not.toContain("오늘의 팁");
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("·");
  });
  it("keeps zero days and summarizes real metrics in priority order", () => {
    const html = renderToStaticMarkup(createElement(HomeAccountStatus, { weekTotal: 12, leaveRemaining: 0 }));
    expect(html).toContain("이번 주 활동 12회");
    expect(html).toContain("남은 연차 0일");
    expect(html.match(/이번 주 활동/g)).toHaveLength(1);
    expect(html.match(/남은 연차/g)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true">·');
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain('href="/data"');
  });
  it("omits non-finite or invalid numbers", () => {
    for (const invalid of [NaN, Infinity, -1]) {
      expect(renderToStaticMarkup(createElement(HomeAccountStatus, { weekTotal: invalid, leaveRemaining: invalid }))).toBe("");
    }
  });
  it("keeps zero remaining days even without activity", () => {
    const html = renderToStaticMarkup(createElement(HomeAccountStatus, { ...empty, leaveRemaining: 0 }));
    expect(html).toContain("남은 연차 0일");
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain("이번 주 활동");
    expect(html).not.toContain("·");
  });
  it("renders the English title and summaries", () => {
    state.locale = "en";
    try {
      const html = renderToStaticMarkup(createElement(HomeAccountStatus, { weekTotal: 12, leaveRemaining: 4 }));
      expect(html).toContain("Work status");
      expect(html).toContain("12 activities this week");
      expect(html).toContain("4 days of leave left");
      expect(html).not.toContain("업무 브리핑");
    } finally { state.locale = "ko"; }
  });
});
