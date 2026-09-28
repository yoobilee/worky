"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HelpButton from "@/components/HelpButton";
import {
  IconUser, IconDeviceFloppy, IconCheck, IconChevronLeft, IconChevronRight, IconArrowUp, IconArrowDown, IconApps,
  IconBriefcase, IconCode, IconBuildingSkyscraper, IconFileText, IconPalette,
  IconGripVertical, IconHelp, IconMessageCircle, IconCalendarEvent,
  IconBell, IconWorld, IconBrandGithub, IconAlertTriangle,
} from "@tabler/icons-react";
import {
  loadNotificationSettings, saveNotificationSettings,
  getPermissionStatus, requestPermission,
  type NotificationSettings,
} from "@/lib/notifications";
import {
  OPTIONAL_MENU_ITEMS, ALWAYS_VISIBLE_ITEMS,
  loadMenuSettings, saveMenuSettings, isRouteEnabled,
  type MenuSettings,
  loadMenuOrder, saveMenuOrder,
  loadHelpButtonEnabled, saveHelpButtonEnabled,
  MENU_LOCALE_MAP,
} from "@/lib/menuSettings";
import { createClient } from "@/lib/supabase/client";
import { getSettings, upsertSettings, type CustomGreeting } from "@/lib/db/settings";
import WorkyFlow from "@/components/WorkyFlow";
import { SettingsField, SettingsSwitch, SettingsStepper, SettingsConfirm } from "@/components/settings/SettingsControls";
import "./settings.css";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat, type TranslationKey } from "@/lib/i18n/translations";

const SENDER_KEY  = "worky_sender_info";
const JOB_KEY     = "worky_job_preset";

type GreetingMode = "basic" | "time" | "day";
type SettingsSection = "info" | "leave" | "greeting" | "job" | "menu" | "help" | "notif" | "language" | "github";
const SETTINGS_SECTIONS: SettingsSection[] = ["info", "leave", "greeting", "job", "menu", "help", "notif", "language", "github"];

function isSettingsSection(value: string | null): value is SettingsSection {
  return value !== null && SETTINGS_SECTIONS.some(section => section === value);
}

const GREETING_TIME_PERIODS: { id: string; label: string }[] = [
  { id: "오전", label: "오전" },
  { id: "오후", label: "오후" },
  { id: "저녁", label: "저녁" },
  { id: "심야", label: "심야" },
];

const GREETING_DAY_LABELS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const GREETING_PLACEHOLDERS = {
  default: "오늘도 좋은 하루 보내세요!",
  time: {
    오전: "좋은 아침이에요! 오늘 하루도 힘차게 시작해봐요.",
    오후: "오후도 활기차게 보내고 계신가요?",
    저녁: "오늘 하루도 수고 많으셨어요.",
    심야: "늦은 시간까지 고생 많으세요. 푹 쉬세요.",
  } as Record<string, string>,
  day: [
    "일요일이에요. 편안한 하루 보내세요.",
    "월요일이에요! 한 주를 힘차게 시작해봐요.",
    "화요일이에요. 오늘도 좋은 하루 되세요.",
    "수요일, 한 주의 절반을 지나고 있어요.",
    "목요일이에요. 조금만 더 힘내봐요!",
    "금요일이에요! 이번 주도 수고하셨어요.",
    "토요일이에요. 즐거운 주말 보내세요.",
  ],
};

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
  on:    string[] | null;
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

function SettingsLoading() {
  return <div className="st-loading" role="status" aria-label="Loading"><div /><div /><div /></div>;
}

function SettingsContent() {

  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const requestedSection = useSearchParams().get("section");
  const activeSection = isSettingsSection(requestedSection) ? requestedSection : "info";
  const mobileShowDetail = isSettingsSection(requestedSection);
  const [info,          setInfo]          = useState<SenderInfo>({ org: "", name: "", title: "" });
  const [hydrated,      setHydrated]      = useState(false);
  const [userId,        setUserId]        = useState<string | null>(null);
  const [menuSettings,  setMenuSettings]  = useState<MenuSettings>({});
  const [jobPreset,     setJobPreset]     = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [menuOrder,      setMenuOrder]      = useState<string[]>([]);
  const [dragIdx,        setDragIdx]        = useState<number | null>(null);
  const [dropIdx,        setDropIdx]        = useState<number | null>(null);
  const [helpOn,         setHelpOn]         = useState(true);
  const [greetingEnabled,  setGreetingEnabled]  = useState(false);
  const [greetingMode,     setGreetingMode]     = useState<GreetingMode>("basic");
  const [greetingValues,   setGreetingValues]   = useState<Record<string, string>>({});
  const [joinDate,         setJoinDate]         = useState("");
  const [leaveStandard,    setLeaveStandard]    = useState<"join_date" | "fiscal_year">("fiscal_year");
  const [usedLeaves,       setUsedLeaves]       = useState(0);
  const [employmentType,   setEmploymentType]   = useState<"new" | "career">("new");
  const [grantedLeaves,    setGrantedLeaves]    = useState(15);
  const [notifPermission,  setNotifPermission]  = useState<NotificationPermission | "unsupported">("default");
  const [notifSettings,    setNotifSettings]    = useState<NotificationSettings>({ eventNotif: true, ddayNotif: true });
  const [githubConnected,     setGithubConnected]     = useState(false);
  const [githubRepoStatus,    setGithubRepoStatus]    = useState<string | null>(null);
  const [githubStatusLoading, setGithubStatusLoading] = useState(true);
  const [githubStatusError, setGithubStatusError] = useState(false);
  const [githubWarnings, setGithubWarnings] = useState<TranslationKey[]>([]);
  const [states, setStates] = useState<Partial<Record<SettingsSection, "dirty" | "saving" | "saved" | "error">>>({});
  const pending = useRef(new Set<SettingsSection>());
  const retries = useRef<Partial<Record<SettingsSection, () => Promise<void>>>>({});
  const detailRef = useRef<HTMLHeadingElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const lastSection = useRef<SettingsSection>("info");
  const [githubPatInput,      setGithubPatInput]      = useState("");
  const [githubRepoInput,     setGithubRepoInput]     = useState("");

  useEffect(() => {
    if (requestedSection !== null && !isSettingsSection(requestedSection)) router.replace("/settings");
  }, [requestedSection, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);

      if (uid) {
        const dbSettings = await getSettings(uid);
        if (dbSettings) {
          if (dbSettings.sender_info) {
            const si = dbSettings.sender_info as unknown as SenderInfo;
            setInfo(si);
            localStorage.setItem(SENDER_KEY, JSON.stringify(si));
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
          if (dbSettings.custom_greeting) {
            const cg = dbSettings.custom_greeting;
            setGreetingEnabled(cg.enabled ?? false);
            setGreetingMode(cg.mode ?? "basic");
            setGreetingValues(cg.values ?? {});
          }
          if (dbSettings.join_date) setJoinDate(dbSettings.join_date);
          if (dbSettings.leave_standard) setLeaveStandard(dbSettings.leave_standard as "join_date" | "fiscal_year");
          if (dbSettings.used_leaves !== undefined) setUsedLeaves(dbSettings.used_leaves);
          if (dbSettings.employment_type) setEmploymentType(dbSettings.employment_type as "new" | "career");
          if (dbSettings.granted_leaves !== undefined) setGrantedLeaves(dbSettings.granted_leaves);
        }
      } else {
        try {
          const raw = localStorage.getItem(SENDER_KEY);
          if (raw) {
            const parsed: SenderInfo = JSON.parse(raw);
            setInfo(parsed);
          }
        } catch {}
        setJobPreset(localStorage.getItem(JOB_KEY));
      }
      setMenuSettings(loadMenuSettings());
      setMenuOrder(loadMenuOrder());
      setHelpOn(loadHelpButtonEnabled());
      setNotifPermission(getPermissionStatus());
      setNotifSettings(loadNotificationSettings());
      setHydrated(true);
    });
  }, []);


  useEffect(() => {
    if (!hydrated || !window.matchMedia("(max-width: 767px)").matches) return;
    if (mobileShowDetail) {
      lastSection.current = activeSection;
      detailRef.current?.focus();
      detailRef.current?.closest("main")?.scrollTo(0, 0);
    } else {
      navRef.current?.querySelector<HTMLButtonElement>(`[data-section="${lastSection.current}"]`)?.focus();
    }
  }, [requestedSection, activeSection, mobileShowDetail, hydrated]);

  const dirty = (section: SettingsSection) => setStates(prev => ({ ...prev, [section]: "dirty" }));
  const runSave = async (section: SettingsSection, operation: () => Promise<void>) => {
    if (pending.current.has(section)) return;
    pending.current.add(section);
    retries.current[section] = operation;
    setStates(prev => ({ ...prev, [section]: "saving" }));
    try {
      await operation();
      delete retries.current[section];
      setStates(prev => ({ ...prev, [section]: "saved" }));
    } catch {
      setStates(prev => ({ ...prev, [section]: "error" }));
    } finally { pending.current.delete(section); }
  };
  const persist = async (patch: Parameters<typeof upsertSettings>[1]) => {
    if (!userId) throw new Error("No settings user");
    await upsertSettings(userId, patch);
  };
  const fetchGithubStatus = async () => {
    setGithubStatusLoading(true); setGithubStatusError(false);
    try {
      const res = await fetch("/api/settings/github");
      if (!res.ok) throw new Error("GitHub status unavailable");
      const data = await res.json() as { connected?: boolean; repo?: string | null };
      setGithubConnected(Boolean(data.connected)); setGithubRepoStatus(data.repo ?? null);
    } catch { setGithubStatusError(true); }
    finally { setGithubStatusLoading(false); }
  };
  useEffect(() => { void fetchGithubStatus(); }, []);

  const handleGithubSave = () => {
    if (!githubPatInput.trim() || !githubRepoInput.trim()) return;
    setGithubWarnings([]);
    void runSave("github", async () => {
      const res = await fetch("/api/settings/github", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: githubPatInput.trim(), repo: githubRepoInput.trim() }),
      });
      const data = await res.json() as { warnings?: TranslationKey[] };
      if (!res.ok) throw new Error("GitHub save failed");
      setGithubWarnings(data.warnings ?? []);
      setGithubPatInput(""); setGithubRepoInput("");
      await fetchGithubStatus();
    });
  };
  const handleChange = (field: keyof SenderInfo, value: string) => { setInfo(prev => ({ ...prev, [field]: value })); dirty("info"); };
  const handleSave = () => {
    localStorage.setItem(SENDER_KEY, JSON.stringify(info));
    void runSave("info", () => persist({ sender_info: info as unknown as Record<string, string> }));
  };
  const handleMenuToggle = (href: string) => {
    const next = { ...menuSettings, [href]: !isRouteEnabled(menuSettings, href) };
    const previous = menuSettings;
    void runSave("menu", async () => {
      setMenuSettings(next); saveMenuSettings(next);
      try { await persist({ menu_settings: next }); }
      catch (error) { setMenuSettings(previous); saveMenuSettings(previous); throw error; }
    });
  };
  const moveMenu = (from: number, to: number) => {
    if (pending.current.has("menu") || from === to || to < 0 || to >= menuOrder.length) return;
    const next = [...menuOrder];
    const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
    const previous = menuOrder;
    void runSave("menu", async () => {
      setMenuOrder(next); saveMenuOrder(next);
      try { await persist({ menu_order: next }); }
      catch (error) { setMenuOrder(previous); saveMenuOrder(previous); throw error; }
    });
  };
  const handleDrop = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    if (dragIdx !== null) moveMenu(dragIdx, index);
    setDragIdx(null); setDropIdx(null);
  };
  const handleHelpToggle = () => {
    const next = !helpOn;
    void runSave("help", async () => {
      setHelpOn(next); saveHelpButtonEnabled(next);
      try { await persist({ help_button: next }); }
      catch (error) { setHelpOn(!next); saveHelpButtonEnabled(!next); throw error; }
    });
  };
  const handleGreetingValueChange = (key: string, value: string) => { setGreetingValues(prev => ({ ...prev, [key]: value })); dirty("greeting"); };
  const handleLeaveSave = () => void runSave("leave", () => persist({
    join_date: joinDate || null, leave_standard: leaveStandard, used_leaves: usedLeaves,
    employment_type: employmentType, granted_leaves: grantedLeaves,
  }));
  const handleGreetingSave = () => {
    const payload: CustomGreeting = { enabled: greetingEnabled, mode: greetingMode, values: greetingValues };
    void runSave("greeting", () => persist({ custom_greeting: payload }));
  };
  const handlePresetConfirm = () => {
    const preset = JOB_PRESETS.find(p => p.id === pendingPreset);
    if (!preset) return;
    const next: MenuSettings = Object.fromEntries(ALL_OPTIONAL_HREFS.map(href => [href, preset.on === null || preset.on.includes(href)]));
    setPendingPreset(null);
    // Apply the confirmed preset only after the existing write succeeds.
    void runSave("job", async () => {
      await persist({ menu_settings: next, job_preset: preset.id });
      setMenuSettings(next); saveMenuSettings(next);
      localStorage.setItem(JOB_KEY, preset.id); setJobPreset(preset.id);
    });
  };
  const handleNotifToggle = (key: keyof NotificationSettings) => {
    const next = { ...notifSettings, [key]: !notifSettings[key] }; setNotifSettings(next);
    void runSave("notif", async () => { saveNotificationSettings(next); });
  };
  const handleRequestPermission = async () => { await requestPermission(); setNotifPermission(getPermissionStatus()); };

  if (!hydrated) return <SettingsLoading />;
  const sections: { key: SettingsSection; label: TranslationKey; hint: TranslationKey; icon: React.ElementType; group: TranslationKey }[] = [
    { key: "info", label: "settings_section_info", hint: "st_info_hint", icon: IconUser, group: "st_group_personal" },
    { key: "leave", label: "settings_section_leave", hint: "st_leave_hint", icon: IconCalendarEvent, group: "st_group_personal" },
    { key: "greeting", label: "settings_section_greeting", hint: "st_greeting_hint", icon: IconMessageCircle, group: "st_group_workspace" },
    { key: "job", label: "settings_section_job", hint: "st_job_hint", icon: IconBriefcase, group: "st_group_workspace" },
    { key: "menu", label: "settings_section_menu", hint: "st_menu_hint", icon: IconApps, group: "st_group_workspace" },
    { key: "help", label: "settings_section_help", hint: "st_help_hint", icon: IconHelp, group: "st_group_environment" },
    { key: "language", label: "settings_language", hint: "st_language_hint", icon: IconWorld, group: "st_group_environment" },
    { key: "github", label: "settings_section_github", hint: "st_github_hint", icon: IconBrandGithub, group: "st_group_environment" },
    { key: "notif", label: "settings_section_notif", hint: "st_notif_hint", icon: IconBell, group: "st_group_environment" },
  ];
  const current = sections.find(section => section.key === activeSection)!;
  const state = states[activeSection];
  const busy = state === "saving" || (activeSection === "menu" && states.job === "saving") || (activeSection === "job" && states.menu === "saving");
  const saveActions: Partial<Record<SettingsSection, () => void>> = { info: handleSave, leave: handleLeaveSave, greeting: handleGreetingSave, github: handleGithubSave };
  const manualSave = saveActions[activeSection];
  const presetLabel = (id: string) => t(("st_preset_" + id) as TranslationKey);
  const choices = <T extends string,>(label: string, value: T, options: { id: T; label: string }[], onChange: (value: T) => void) =>
    <div className="st-choices" role="group" aria-label={label}>{options.map(option =>
      <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>
    )}</div>;

  return <div className="st-settings" data-detail={mobileShowDetail}>
    <header className="st-intro"><h2>{t("st_title")}</h2><p>{t("st_intro")}</p></header>
    <div className="st-layout">
      <div ref={navRef} className="st-nav" role="navigation" aria-label={t("settings_mobile_back")}>
        {sections.map((section, index) => <div key={section.key}>
          {(index === 0 || sections[index - 1].group !== section.group) && <h3>{t(section.group)}</h3>}
          <button type="button" data-section={section.key} aria-label={t(section.label)} aria-current={activeSection === section.key ? "page" : undefined} onClick={() => router.push(`/settings?section=${section.key}`)}>
            <section.icon size={20} aria-hidden="true" /><span><strong>{t(section.label)}</strong><small>{t(section.hint)}</small></span>
            {activeSection === section.key ? <WorkyFlow compact /> : <IconChevronRight className="st-nav-arrow" size={16} aria-hidden="true" />}
          </button>
        </div>)}
      </div>
      <section className="st-detail" aria-labelledby="st-section-title">
        <button type="button" className="st-back" onClick={() => router.push("/settings")}><IconChevronLeft size={16} aria-hidden="true" />{t("settings_mobile_back")}</button>
        <header className="st-section-heading"><p className="st-eyebrow">{t(current.group)}</p><h2 id="st-section-title" ref={detailRef} tabIndex={-1}>{t(current.label)}</h2></header>
        <fieldset className="st-fields" disabled={busy} aria-label={t(current.label)}>
          {activeSection === "info" && <>
            <p className="st-description">{t("info_desc")}</p>
            <div className="st-form-grid">{(["org", "name", "title"] as const).map(field => <SettingsField key={field} id={`st-info-${field}`} label={t(("info_label_" + field) as TranslationKey)}>
              <input id={`st-info-${field}`} value={info[field]} onChange={event => handleChange(field, event.target.value)} placeholder={t(("info_placeholder_" + field) as TranslationKey)} autoComplete={field === "name" ? "name" : field === "org" ? "organization" : "organization-title"} />
            </SettingsField>)}</div>
            {(info.org || info.name || info.title) && <div className="st-preview"><h3>{t("info_signature_preview")}</h3><p>{t("info_signature_thanks")}<br />{[info.org, info.name, info.title].filter(Boolean).join(" ")}</p></div>}
          </>}
          {activeSection === "leave" && <>
            <p className="st-description">{t("leave_desc_empty")}</p>
            <div className="st-field"><span className="st-label">{t("leave_employment_type")}</span>
              {choices(t("leave_employment_type"), employmentType, [{ id: "new", label: t("leave_new") }, { id: "career", label: t("leave_career") }], value => { setEmploymentType(value); dirty("leave"); })}
            </div>
            {employmentType === "new" ? <>
              <SettingsField id="st-join-date" label={t("leave_join_date")}><input id="st-join-date" type="date" value={joinDate} onChange={event => { setJoinDate(event.target.value); dirty("leave"); }} /></SettingsField>
              <div className="st-field"><span className="st-label">{t("leave_standard")}</span>{choices(t("leave_standard"), leaveStandard, [{ id: "join_date", label: t("leave_standard_join") }, { id: "fiscal_year", label: t("leave_standard_fiscal") }], value => { setLeaveStandard(value); dirty("leave"); })}</div>
            </> : <SettingsStepper label={t("leave_granted")} value={grantedLeaves} onChange={value => { setGrantedLeaves(value); dirty("leave"); }} />}
            <SettingsStepper label={t("leave_used")} value={usedLeaves} onChange={value => { setUsedLeaves(value); dirty("leave"); }} />
          </>}
          {activeSection === "greeting" && <>
            <p className="st-description">{t("greeting_desc")}</p>
            <SettingsSwitch label={t("greeting_toggle")} description={t("greeting_toggle_desc")} checked={greetingEnabled} onChange={() => { setGreetingEnabled(value => !value); dirty("greeting"); }} />
            {greetingEnabled && <>
              {choices(t("st_greeting_mode"), greetingMode, [{ id: "basic", label: t("greeting_mode_basic") }, { id: "time", label: t("greeting_mode_time") }, { id: "day", label: t("greeting_mode_day") }], value => { setGreetingMode(value); dirty("greeting"); })}
              {greetingMode === "basic" && <SettingsField id="st-greeting-default" label={t("st_greeting_text")}><input id="st-greeting-default" value={greetingValues.default ?? ""} placeholder={t("st_greeting_placeholder")} onChange={event => handleGreetingValueChange("default", event.target.value)} /></SettingsField>}
              {greetingMode === "time" && GREETING_TIME_PERIODS.map(({ id }, index) => <SettingsField key={id} id={`st-greeting-time-${index}`} label={t((["st_morning", "st_afternoon", "st_evening", "st_night"] as const)[index])}><input id={`st-greeting-time-${index}`} value={greetingValues[id] ?? ""} placeholder={locale === "ko" ? GREETING_PLACEHOLDERS.time[id] : t("st_greeting_text")} onChange={event => handleGreetingValueChange(id, event.target.value)} /></SettingsField>)}
              {greetingMode === "day" && GREETING_DAY_LABELS.map((label, index) => <SettingsField key={index} id={`st-greeting-day-${index}`} label={new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2026, 8, 27 + index))}><input id={`st-greeting-day-${index}`} value={greetingValues[String(index)] ?? ""} placeholder={locale === "ko" ? GREETING_PLACEHOLDERS.day[index] : t("st_greeting_text")} onChange={event => handleGreetingValueChange(String(index), event.target.value)} /></SettingsField>)}
            </>}
          </>}
          {activeSection === "job" && <>
            <p className="st-description">{t("job_hint")}</p>
            <div className="st-presets">{JOB_PRESETS.map(preset => <button className="st-preset" type="button" key={preset.id} aria-pressed={jobPreset === preset.id} onClick={() => setPendingPreset(preset.id)}>
              <preset.icon size={20} aria-hidden="true" /><span><strong>{presetLabel(preset.id)}</strong><small>{t(("st_preset_" + preset.id + "_desc") as TranslationKey)}</small></span><IconCheck className="st-selected-check" size={18} aria-hidden="true" />
            </button>)}</div>
          </>}
          {activeSection === "menu" && <>
            <p className="st-description">{t("menu_desc")}</p><p className="st-hint">{t("st_menu_order_hint")}</p>
            <h3 className="st-subheading">{t("menu_optional")}</h3>
            <div className="st-menu-list">{menuOrder.map((href, index) => {
              const item = OPTIONAL_MENU_ITEMS.find(menu => menu.href === href);
              if (!item) return null;
              const label = MENU_LOCALE_MAP[href] ? t(MENU_LOCALE_MAP[href]) : item.label;
              return <div key={href} className="st-menu-row" data-route={href} draggable={!busy} data-dragging={dragIdx === index} data-over={dropIdx === index && dragIdx !== index}
                onDragStart={() => setDragIdx(index)} onDragEnd={() => { setDragIdx(null); setDropIdx(null); }} onDragOver={event => { event.preventDefault(); setDropIdx(index); }} onDrop={event => handleDrop(event, index)}>
                <IconGripVertical className="st-grip" size={18} aria-hidden="true" /><span className="st-menu-name">{label}</span>
                <div className="st-reorder"><button type="button" disabled={index === 0} className="st-icon-button" aria-label={tFormat(t("st_move_up"), { name: label })} onClick={() => moveMenu(index, index - 1)}><IconArrowUp size={16} /></button><button type="button" disabled={index === menuOrder.length - 1} className="st-icon-button" aria-label={tFormat(t("st_move_down"), { name: label })} onClick={() => moveMenu(index, index + 1)}><IconArrowDown size={16} /></button></div>
                <button type="button" className="st-switch" role="switch" aria-label={label} aria-checked={isRouteEnabled(menuSettings, href)} onClick={() => handleMenuToggle(href)}><span>{isRouteEnabled(menuSettings, href) && <IconCheck size={12} aria-hidden="true" />}</span></button>
              </div>;
            })}</div>
            <h3 className="st-subheading">{t("menu_always")}</h3><p className="st-hint">{ALWAYS_VISIBLE_ITEMS.map(item => MENU_LOCALE_MAP[item.href] ? t(MENU_LOCALE_MAP[item.href]) : item.label).join(" · ")}</p>
          </>}
          {activeSection === "help" && <>
            <p className="st-description">{t("help_desc")}</p><SettingsSwitch label={t("help_toggle")} description={t("help_toggle_desc")} checked={helpOn} onChange={handleHelpToggle} />
          </>}
          {activeSection === "language" && <>
            <p className="st-description">{t("settings_language_desc")}</p>{choices(t("settings_language"), locale, [{ id: "ko", label: "한국어" }, { id: "en", label: "English" }], value => void runSave("language", async () => { await setLocale(value); }))}
          </>}
          {activeSection === "github" && <>
            <p className="st-description">{t("github_desc")}</p>
            <div className="st-connection" role="status" data-state={githubConnected ? "connected" : "idle"}>
              {githubStatusLoading ? t("st_checking") : githubStatusError ? t("st_connection_error") : githubConnected ? <><IconCheck size={18} aria-hidden="true" />{tFormat(t("github_connected_msg"), { repo: githubRepoStatus ?? "" })}</> : <><IconAlertTriangle size={18} aria-hidden="true" />{t("github_not_connected")}</>}
            </div>
            {githubStatusError && <button type="button" className="st-button" onClick={() => void fetchGithubStatus()}>{t("st_retry")}</button>}
            <SettingsField id="st-github-pat" label={t("github_pat_label")}><input id="st-github-pat" type="password" autoComplete="off" value={githubPatInput} placeholder={t("github_pat_placeholder")} onChange={event => { setGithubPatInput(event.target.value); dirty("github"); }} /></SettingsField>
            <SettingsField id="st-github-repo" label={t("github_repo_label")}><input id="st-github-repo" value={githubRepoInput} placeholder={t("github_repo_placeholder")} onChange={event => { setGithubRepoInput(event.target.value); dirty("github"); }} /></SettingsField>
            <p className="st-hint">{t("st_github_private")}</p>
            {githubWarnings.map(warning => <p key={warning} className="st-warning" role="alert">{t(warning)}</p>)}
          </>}
          {activeSection === "notif" && <>
            <p className="st-description">{t("notif_setup")}</p>
            <div className="st-connection" role="status" data-state={notifPermission === "granted" ? "connected" : "idle"}>{notifPermission === "granted" ? <><IconCheck size={18} aria-hidden="true" />{t("notif_granted_msg")}</> : notifPermission === "unsupported" ? t("st_notif_unsupported") : notifPermission === "denied" ? t("notif_denied_desc") : t("notif_default_desc")}</div>
            {notifPermission === "default" && <button type="button" className="st-button st-button--primary" onClick={() => void handleRequestPermission()}><IconBell size={18} aria-hidden="true" />{t("notif_allow_btn")}</button>}
            {notifPermission === "granted" && <p className="st-hint">{t("notif_off_hint")}</p>}
            <SettingsSwitch label={t("notif_event_toggle")} description={t("notif_event_desc")} checked={notifSettings.eventNotif} disabled={notifPermission !== "granted"} onChange={() => handleNotifToggle("eventNotif")} />
            <SettingsSwitch label={t("notif_dday_toggle")} description={t("notif_dday_desc")} checked={notifSettings.ddayNotif} disabled={notifPermission !== "granted"} onChange={() => handleNotifToggle("ddayNotif")} />
          </>}
        </fieldset>
        <footer className="st-savebar">
          <div className="st-save-state" data-state={state ?? "idle"} role={state === "error" ? "alert" : "status"}>
            {state === "saved" && <IconCheck size={18} aria-hidden="true" />}
            <span>{state === "saving" ? t("st_saving") : state === "error" ? t("st_save_error") : state === "saved" ? t(activeSection === "notif" ? "st_local_saved" : "save_done") : state === "dirty" ? t("st_unsaved") : t(manualSave ? "st_manual_hint" : activeSection === "notif" ? "st_local_hint" : "st_auto_hint")}</span>
          </div>
          {manualSave ? <button type="button" className="st-button st-button--primary" disabled={busy || (activeSection === "github" && (!githubPatInput.trim() || !githubRepoInput.trim()))} onClick={manualSave}><IconDeviceFloppy size={18} aria-hidden="true" />{t(busy ? "st_saving" : "save")}</button> :
            state === "error" && <button type="button" className="st-button" onClick={() => { const operation = retries.current[activeSection]; if (operation) void runSave(activeSection, operation); }}>{t("st_retry")}</button>}
        </footer>
      </section>
    </div>
    {pendingPreset && <SettingsConfirm title={t("job_change_modal_title")} onCancel={() => setPendingPreset(null)} onConfirm={handlePresetConfirm}><p>{tFormat(t("st_preset_confirm"), { name: presetLabel(pendingPreset) })}</p><p className="st-warning">{t("job_change_modal_warning")}</p></SettingsConfirm>}
    <HelpButton title={t("help_settings_title")} steps={Array.from({ length: 7 }, (_, i) => ({ step: t((`help_settings_${i + 1}_step`) as TranslationKey), desc: t((`help_settings_${i + 1}_desc`) as TranslationKey) }))} />
  </div>;
}

export default function SettingsPage() {
  return <Suspense fallback={<SettingsLoading />}><SettingsContent /></Suspense>;
}
