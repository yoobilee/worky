"use client";

import { useState, useEffect } from "react";
import HelpButton from "@/components/HelpButton";
import {
  IconUser, IconDeviceFloppy, IconCheck, IconChevronDown, IconChevronUp, IconApps,
  IconBriefcase, IconCode, IconBuildingSkyscraper, IconFileText, IconPalette, IconX,
  IconGripVertical, IconHelp,
} from "@tabler/icons-react";
import {
  OPTIONAL_MENU_ITEMS, ALWAYS_VISIBLE_ITEMS,
  loadMenuSettings, saveMenuSettings, isRouteEnabled,
  MENU_SETTINGS_EVENT, type MenuSettings,
  loadMenuOrder, saveMenuOrder,
  loadHelpButtonEnabled, saveHelpButtonEnabled,
} from "@/lib/menuSettings";
import { createClient } from "@/lib/supabase/client";
import { getSettings, upsertSettings } from "@/lib/db/settings";

const SENDER_KEY  = "worky_sender_info";
const JOB_KEY     = "worky_job_preset";

interface SenderInfo {
  org:   string;
  name:  string;
  title: string;
}

const ALL_OPTIONAL_HREFS = OPTIONAL_MENU_ITEMS.map((i) => i.href);

interface JobPreset {
  id:    string;
  label: string;
  icon:  React.ElementType;
  desc:  string;
  on:    string[] | null; // null = 전체
}

const JOB_PRESETS: JobPreset[] = [
  {
    id: "marketing", label: "마케팅/영업",      icon: IconBriefcase,
    desc: "영업·고객 관리 중심",
    on: ["/content", "/clients", "/template", "/summary", "/feedback"],
  },
  {
    id: "it",        label: "IT직군",            icon: IconCode,
    desc: "개발자, QA, 기획자 등",
    on: ["/data", "/insight", "/translate", "/summary", "/template", "/glossary"],
  },
  {
    id: "admin",     label: "경영지원/총무",      icon: IconBuildingSkyscraper,
    desc: "문서·일정 관리 중심",
    on: ["/summary", "/template", "/translate", "/data", "/document", "/feedback"],
  },
  {
    id: "office",    label: "사무직",             icon: IconFileText,
    desc: "일반 사무 업무",
    on: ["/summary", "/template", "/translate", "/glossary", "/data"],
  },
  {
    id: "designer",  label: "디자이너",           icon: IconPalette,
    desc: "크리에이티브 직군",
    on: ["/translate", "/glossary", "/template", "/summary", "/feedback"],
  },
  {
    id: "other",     label: "기타",               icon: IconApps,
    desc: "전체 기능 사용",
    on: null,
  },
];

export default function SettingsPage() {
  const [info,          setInfo]          = useState<SenderInfo>({ org: "", name: "", title: "" });
  const [collapsed,     setCollapsed]     = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [hydrated,      setHydrated]      = useState(false);
  const [userId,        setUserId]        = useState<string | null>(null);
  const [menuSettings,  setMenuSettings]  = useState<MenuSettings>({});
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [menuSaved,     setMenuSaved]     = useState(false);
  const [jobPreset,     setJobPreset]     = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [jobSaved,       setJobSaved]       = useState(false);
  const [jobCollapsed,   setJobCollapsed]   = useState(false);
  const [menuOrder,      setMenuOrder]      = useState<string[]>([]);
  const [orderSaved,     setOrderSaved]     = useState(false);
  const [dragIdx,        setDragIdx]        = useState<number | null>(null);
  const [dropIdx,        setDropIdx]        = useState<number | null>(null);
  const [helpOn,         setHelpOn]         = useState(true);
  const [helpSaved,      setHelpSaved]      = useState(false);
  const [helpCollapsed,  setHelpCollapsed]  = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);

      // Supabase에서 설정 로드 → localStorage에 반영 (캐시 동기화)
      if (uid) {
        const dbSettings = await getSettings(uid);
        if (dbSettings) {
          if (dbSettings.sender_info) {
            const si = dbSettings.sender_info as unknown as SenderInfo;
            setInfo(si);
            localStorage.setItem(SENDER_KEY, JSON.stringify(si));
            if (si.org || si.name || si.title) setCollapsed(true);
          }
          if (dbSettings.menu_settings) {
            saveMenuSettings(dbSettings.menu_settings as MenuSettings);
          }
          if (dbSettings.menu_order?.length) {
            saveMenuOrder(dbSettings.menu_order);
          }
          if (dbSettings.help_button !== undefined) {
            saveHelpButtonEnabled(dbSettings.help_button);
          }
          if (dbSettings.job_preset) {
            localStorage.setItem(JOB_KEY, dbSettings.job_preset);
            setJobPreset(dbSettings.job_preset);
          }
        }
      } else {
        // localStorage fallback
        try {
          const raw = localStorage.getItem(SENDER_KEY);
          if (raw) {
            const parsed: SenderInfo = JSON.parse(raw);
            setInfo(parsed);
            if (parsed.org || parsed.name || parsed.title) setCollapsed(true);
          }
        } catch {}
        setJobPreset(localStorage.getItem(JOB_KEY));
      }
      setMenuSettings(loadMenuSettings());
      setMenuOrder(loadMenuOrder());
      setHelpOn(loadHelpButtonEnabled());
      setHydrated(true);
    });
  }, []);

  const handleChange = (field: keyof SenderInfo, value: string) => {
    setInfo((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(SENDER_KEY, JSON.stringify(info));
    if (userId) upsertSettings(userId, { sender_info: info as unknown as Record<string, string> }).catch(() => {});
    setSaved(true);
    if (info.org || info.name || info.title) setCollapsed(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleMenuToggle = (href: string) => {
    const next = { ...menuSettings, [href]: !isRouteEnabled(menuSettings, href) };
    setMenuSettings(next);
    saveMenuSettings(next);
    if (userId) upsertSettings(userId, { menu_settings: next }).catch(() => {});
    setMenuSaved(true);
    setTimeout(() => setMenuSaved(false), 2500);
  };

  /* ── 드래그&드롭 순서 변경 ── */
  const handleDragStart = (i: number) => setDragIdx(i);
  const handleDragEnd   = () => { setDragIdx(null); setDropIdx(null); };
  const handleDragOver  = (e: React.DragEvent, i: number) => { e.preventDefault(); setDropIdx(i); };
  const handleDrop      = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDropIdx(null); return; }
    const next = [...menuOrder];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setMenuOrder(next);
    saveMenuOrder(next);
    if (userId) upsertSettings(userId, { menu_order: next }).catch(() => {});
    setOrderSaved(true);
    setTimeout(() => setOrderSaved(false), 2500);
    setDragIdx(null);
    setDropIdx(null);
  };

  /* ── 도움말 버튼 토글 ── */
  const handleHelpToggle = () => {
    const next = !helpOn;
    setHelpOn(next);
    saveHelpButtonEnabled(next);
    if (userId) upsertSettings(userId, { help_button: next }).catch(() => {});
    setHelpSaved(true);
    setTimeout(() => setHelpSaved(false), 2500);
  };

  const handlePresetConfirm = () => {
    if (!pendingPreset) return;
    const preset = JOB_PRESETS.find((p) => p.id === pendingPreset);
    if (!preset) return;

    const next: MenuSettings = Object.fromEntries(
      ALL_OPTIONAL_HREFS.map((href) => [
        href,
        preset.on === null ? true : preset.on.includes(href),
      ])
    );
    setMenuSettings(next);
    saveMenuSettings(next);
    localStorage.setItem(JOB_KEY, pendingPreset);
    if (userId) upsertSettings(userId, { menu_settings: next, job_preset: pendingPreset }).catch(() => {});
    setJobPreset(pendingPreset);
    setPendingPreset(null);
    setJobSaved(true);
    setTimeout(() => setJobSaved(false), 2500);
  };

  if (!hydrated) return null;

  const hasSender = info.org || info.name || info.title;
  const summary   = hasSender
    ? [info.org, info.name, info.title].filter(Boolean).join(" · ")
    : "미입력";

  const pendingPresetLabel = JOB_PRESETS.find((p) => p.id === pendingPreset)?.label ?? "";

  return (
    <div className="max-w-2xl mx-auto w-full space-y-4">

      {/* 저장 완료 배너 */}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">
          <IconCheck className="w-4 h-4 shrink-0" />
          내 정보가 저장됐습니다.
        </div>
      )}

      {/* 내 정보 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#6C63FF]/10 shrink-0">
              <IconUser className="w-4 h-4 text-[#6C63FF]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">내 정보</p>
              {collapsed && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{summary}</p>
              )}
              {!collapsed && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  이메일·템플릿 작성 시 발신자 서명에 자동으로 사용됩니다.
                </p>
              )}
            </div>
          </div>
          {collapsed
            ? <IconChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
            : <IconChevronUp   className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />}
        </button>

        {!collapsed && (
          <div className="px-5 pb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              {([
                { field: "org",   label: "소속",  placeholder: "예: 개발팀" },
                { field: "name",  label: "이름",  placeholder: "예: 홍길동" },
                { field: "title", label: "직급",  placeholder: "예: 사원" },
              ] as { field: keyof SenderInfo; label: string; placeholder: string }[]).map(({ field, label, placeholder }) => (
                <div key={field} className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">
                    {label}
                  </label>
                  <input
                    value={info[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                  />
                </div>
              ))}
            </div>

            {hasSender && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <p className="text-xs font-medium text-slate-400 dark:text-zinc-500 mb-1.5">서명 미리보기</p>
                <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                  {`감사합니다.\n${[info.org, info.name, info.title].filter(Boolean).join(" ")}`}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end mt-4">
              <button
                onClick={handleSave}
                className={[
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all",
                  saved ? "bg-emerald-500" : "",
                ].join(" ")}
                style={saved ? undefined : { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {saved ? (
                  <><IconCheck className="w-4 h-4" />저장됐습니다</>
                ) : (
                  <><IconDeviceFloppy className="w-4 h-4" />저장</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 직업군 설정 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <button
          onClick={() => setJobCollapsed((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#6C63FF]/10 shrink-0">
              <IconBriefcase className="w-4 h-4 text-[#6C63FF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">직업군 설정</p>
                {jobSaved && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                    <IconCheck className="w-3.5 h-3.5" />저장됨
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                {jobPreset
                  ? `현재: ${JOB_PRESETS.find((p) => p.id === jobPreset)?.label ?? ""}`
                  : "직업군에 맞는 메뉴를 자동으로 설정합니다"}
              </p>
            </div>
          </div>
          {jobCollapsed
            ? <IconChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
            : <IconChevronUp   className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />}
        </button>

        {!jobCollapsed && (
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {JOB_PRESETS.map((preset) => {
                const Icon   = preset.icon;
                const active = jobPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPendingPreset(preset.id)}
                    className={[
                      "flex flex-col gap-2 p-3.5 rounded-2xl border text-left transition-all",
                      active
                        ? "border-[#6C63FF] shadow-md"
                        : "border-slate-200 dark:border-zinc-700 hover:border-[#6C63FF]/40 hover:shadow-sm",
                    ].join(" ")}
                    style={active ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" } : undefined}
                  >
                    <div className={[
                      "w-7 h-7 rounded-xl flex items-center justify-center shrink-0",
                      active ? "bg-[#6C63FF]/15" : "bg-slate-100 dark:bg-zinc-800",
                    ].join(" ")}>
                      <Icon className={`w-4 h-4 ${active ? "text-[#6C63FF]" : "text-slate-500 dark:text-zinc-400"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold leading-tight ${active ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-200"}`}>
                        {preset.label}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 leading-snug">{preset.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-3">
              직업군을 선택하면 추천 메뉴가 자동으로 적용됩니다. 이후 메뉴 설정에서 개별 수정 가능합니다.
            </p>
          </div>
        )}
      </div>

      {/* 메뉴 설정 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <button
          onClick={() => setMenuCollapsed((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#6C63FF]/10 shrink-0">
              <IconApps className="w-4 h-4 text-[#6C63FF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">메뉴 설정</p>
                {menuSaved && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                    <IconCheck className="w-3.5 h-3.5" />저장됨
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                사이드바에 표시할 메뉴를 선택하세요
              </p>
            </div>
          </div>
          {menuCollapsed
            ? <IconChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
            : <IconChevronUp   className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />}
        </button>

        {!menuCollapsed && (
          <div className="px-5 pb-5">

            {/* 선택 메뉴 — 드래그&드롭 순서 변경 */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                선택 표시
              </p>
              {orderSaved && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                  <IconCheck className="w-3.5 h-3.5" />순서 저장됨
                </span>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800 mb-4">
              {menuOrder.map((href, idx) => {
                const item = OPTIONAL_MENU_ITEMS.find((m) => m.href === href);
                if (!item) return null;
                const enabled   = isRouteEnabled(menuSettings, href);
                const isDragging = dragIdx === idx;
                const isOver     = dropIdx === idx;
                return (
                  <div
                    key={href}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={[
                      "flex items-center justify-between px-3 py-3 transition-colors cursor-grab active:cursor-grabbing",
                      isDragging ? "opacity-40 bg-slate-50 dark:bg-zinc-800" : "",
                      isOver && !isDragging ? "bg-[#6C63FF]/5 border-t-2 border-t-[#6C63FF]/40" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <IconGripVertical className="w-4 h-4 text-slate-300 dark:text-zinc-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">{item.label}</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{href}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleMenuToggle(href)}
                      role="switch"
                      aria-checked={enabled}
                      className={[
                        "relative inline-flex w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ml-2",
                        enabled ? "bg-[#6C63FF]" : "bg-slate-200 dark:bg-zinc-700",
                      ].join(" ")}
                    >
                      <span className={[
                        "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                        enabled ? "translate-x-5" : "translate-x-1",
                      ].join(" ")} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 공통 메뉴 (항상 표시) */}
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
              항상 표시
            </p>
            <div className="rounded-xl border border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
              {ALWAYS_VISIBLE_ITEMS.map(({ href, label }) => (
                <div key={href} className="flex items-center justify-between px-4 py-3 opacity-60">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">{label}</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{href}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 font-medium shrink-0">
                    항상 표시
                  </span>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>

      {/* 확인 모달 */}
      {pendingPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">직업군 설정 변경</h3>
              <button
                onClick={() => setPendingPreset(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
              <span className="font-semibold text-[#6C63FF]">{pendingPresetLabel}</span> 직군으로 메뉴를 설정하시겠습니까?
              <br />
              <span className="text-slate-400 dark:text-zinc-500 text-xs">현재 메뉴 설정이 초기화됩니다.</span>
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setPendingPreset(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                취소
              </button>
              <button
                onClick={handlePresetConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 도움말 설정 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <button
          onClick={() => setHelpCollapsed((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#6C63FF]/10 shrink-0">
              <IconHelp className="w-4 h-4 text-[#6C63FF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">도움말 설정</p>
                {helpSaved && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                    <IconCheck className="w-3.5 h-3.5" />저장됨
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                페이지 도움말 버튼 표시 여부
              </p>
            </div>
          </div>
          {helpCollapsed
            ? <IconChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
            : <IconChevronUp   className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />}
        </button>

        {!helpCollapsed && (
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 dark:border-zinc-800">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">페이지 도움말 버튼 표시</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  각 페이지 우측 하단의 ? 버튼 (홈 AI 바로가기는 영향 없음)
                </p>
              </div>
              <button
                onClick={handleHelpToggle}
                role="switch"
                aria-checked={helpOn}
                className={[
                  "relative inline-flex w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ml-4",
                  helpOn ? "bg-[#6C63FF]" : "bg-slate-200 dark:bg-zinc-700",
                ].join(" ")}
              >
                <span className={[
                  "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                  helpOn ? "translate-x-5" : "translate-x-1",
                ].join(" ")} />
              </button>
            </div>
          </div>
        )}
      </div>

      <HelpButton
        title="설정 사용법"
        steps={[
          { step: "내 정보", desc: "소속·이름·직급을 입력하면 이메일·템플릿 서명에 자동 사용됩니다." },
          { step: "직업군 프리셋", desc: "직업군을 선택하면 추천 메뉴가 자동으로 설정됩니다." },
          { step: "메뉴 설정", desc: "사이드바에 표시할 메뉴를 개별적으로 켜고 끌 수 있습니다." },
        ]}
      />
    </div>
  );
}
