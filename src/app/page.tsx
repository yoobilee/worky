"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  IconArrowRight, IconSun, IconCloud, IconCloudRain,
  IconCloudSnow, IconCloudStorm, IconMist,
  IconCircle, IconAdjustments, IconClock,
} from "@tabler/icons-react";
import { isRouteEnabled, MENU_LOCALE_MAP } from "@/lib/menuSettings";
import { workspaceRoutes } from "@/lib/workspaceNavigation";
import { getThisWeekStats, type FeatureKey } from "@/lib/usageStats";
import { type CalendarEvent } from "@/lib/calendarStorage";
import { createClient } from "@/lib/supabase/client";
import { getStats } from "@/lib/db/usage_stats";
import { getEvents } from "@/lib/db/calendar";
import { getTodos } from "@/lib/db/todos";
import { getSettings, type CustomGreeting } from "@/lib/db/settings";
import { calcAnnualLeave, type LeaveStandard, type EmploymentType, type LeaveResult } from "@/lib/leave";
import { runDailyNotificationChecks, addBusinessDays, calcDday } from "@/lib/notifications";
import { getClients } from "@/lib/db/clients";
import OnboardingModal from "@/components/OnboardingModal";
import ExternalShortcuts from "@/components/ExternalShortcuts";
import WorkBrief from "@/components/WorkBrief";
import WorkspaceIcon from "@/components/WorkspaceIcon";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat, type TranslationKey } from "@/lib/i18n/translations";

/* ───────── 상수 ───────── */

interface Todo { id: string; text: string; completed: boolean }

const DAY_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Tip { text: string; category: string }

const TIPS: Tip[] = [
  { text: "첫 보고서는 '결론 → 이유 → 근거' 순서로 작성하면 가독성이 높아집니다.", category: "문서작성" },
  { text: "업무 요청을 받으면 기한·우선순위·담당자를 반드시 확인하고 시작하세요.", category: "업무관리" },
  { text: "회의가 끝나면 24시간 안에 액션 아이템을 정리해 공유하면 신뢰를 얻을 수 있습니다.", category: "커뮤니케이션" },
  { text: "이메일은 보내기 전 수신자·참조·제목·첨부파일을 한 번 더 확인하는 습관을 들이세요.", category: "커뮤니케이션" },
  { text: "업무 중 막히는 부분은 30분 이상 혼자 고민하기 전에 선배에게 질문하세요.", category: "학습" },
  { text: "To-Do는 구체적인 액션 단위로 쪼개야 실행이 쉽습니다. '기획안 작성' 대신 '목차 초안 만들기'처럼요.", category: "시간관리" },
  { text: "상사에게 중간 보고를 자주 하면 방향이 틀렸을 때 수정 비용이 줄어듭니다.", category: "업무관리" },
  { text: "일주일 단위로 이번 주 배운 것 3가지를 기록하면 성장이 눈에 보입니다.", category: "학습" },
  { text: "슬랙·메일 알림은 집중 시간대에는 끄고, 정해진 시간에 일괄 확인하는 것이 효율적입니다.", category: "시간관리" },
  { text: "문서 저장 시 파일명에 날짜를 포함하면 나중에 찾기 훨씬 쉽습니다.", category: "문서작성" },
  { text: "모르는 용어나 프로세스는 그 자리에서 바로 메모하고 업무 후 정리하세요.", category: "학습" },
  { text: "동료의 업무 성과를 공개적으로 칭찬하는 습관은 팀 협업을 강화합니다.", category: "팀워크" },
];

type AiSuggestion =
  | { type: "client"; name: string; dday: number }
  | { type: "event"; title: string }
  | { type: "todos"; count: number };

/* ───────── 인사말 ───────── */

type Period = "오전" | "오후" | "저녁" | "심야";

function getPeriod(hour: number): Period {
  if (hour >= 6  && hour < 12) return "오전";
  if (hour >= 12 && hour < 18) return "오후";
  if (hour >= 18 && hour < 21) return "저녁";
  return "심야";
}

const GREETINGS: Record<number, Record<Period, string>> = {
  0: {
    오전: "일요일 아침이에요! 느긋하게 시작해봐요.",
    오후: "일요일 오후, 내일을 위해 충전 중인가요?",
    저녁: "일요일 저녁, 내일 월요일 준비됐나요?",
    심야: "일요일 밤, 이번 주도 수고하셨어요. 푹 주무세요.",
  },
  1: {
    오전: "월요일 아침이에요! 한 주의 시작, 힘차게 달려봐요.",
    오후: "월요일 오후도 파이팅이에요!",
    저녁: "월요일 수고하셨어요. 내일도 잘 부탁드려요.",
    심야: "늦은 월요일 밤까지 수고가 많으세요.",
  },
  2: {
    오전: "화요일 아침이에요! 어제보다 더 나은 하루가 될 거예요.",
    오후: "화요일 오후, 오늘 목표 잘 되어가고 있나요?",
    저녁: "화요일도 수고하셨어요!",
    심야: "늦은 밤까지 열심이시네요. 푹 쉬세요.",
  },
  3: {
    오전: "벌써 수요일이에요! 이번 주 절반 왔어요.",
    오후: "수요일 오후, 주중 고비를 넘기고 있어요!",
    저녁: "수요일 저녁, 한 주의 반환점을 돌았어요.",
    심야: "수요일 밤까지 수고 많으세요.",
  },
  4: {
    오전: "목요일 아침이에요! 이제 주말이 보이기 시작해요.",
    오후: "목요일 오후, 조금만 더 힘내봐요!",
    저녁: "목요일 저녁, 내일이면 금요일이에요!",
    심야: "목요일 밤, 내일을 위해 푹 쉬세요.",
  },
  5: {
    오전: "드디어 금요일 아침이에요! 오늘 하루만 더 힘내요.",
    오후: "금요일 오후, 주말이 코앞이에요!",
    저녁: "금요일 저녁, 이번 주도 정말 수고하셨어요!",
    심야: "금요일 밤, 신나는 주말 즐기세요!",
  },
  6: {
    오전: "토요일 아침이에요! 여유로운 주말 시작해봐요.",
    오후: "토요일 오후, 푹 쉬고 계신가요?",
    저녁: "토요일 저녁, 즐거운 시간 보내세요!",
    심야: "토요일 밤, 주말 잘 보내고 계신가요?",
  },
};

function getGreeting(now: Date): string {
  return GREETINGS[now.getDay()][getPeriod(now.getHours())];
}

function getGreetingText(now: Date, customGreeting: CustomGreeting | null): string {
  if (customGreeting?.enabled) {
    const { mode, values } = customGreeting;
    if (mode === "basic" && values.default?.trim()) return values.default;
    if (mode === "time") {
      const value = values[getPeriod(now.getHours())];
      if (value?.trim()) return value;
    }
    if (mode === "day") {
      const value = values[String(now.getDay())];
      if (value?.trim()) return value;
    }
  }
  return getGreeting(now);
}

/* ───────── 날씨 ───────── */

interface WeatherInfo {
  temp: number;
  labelKey: TranslationKey;
  Icon: React.ComponentType<{ className?: string }>;
}

function getWeatherFromCode(code: number): { labelKey: TranslationKey; Icon: React.ComponentType<{ className?: string }> } {
  if (code === 0 || code === 1) return { labelKey: "weather_clear",        Icon: IconSun };
  if (code <= 3)                 return { labelKey: "weather_clouds",       Icon: IconCloud };
  if (code <= 48)                return { labelKey: "weather_fog",          Icon: IconMist };
  if (code <= 55)                return { labelKey: "weather_drizzle",      Icon: IconCloudRain };
  if (code <= 67)                return { labelKey: "weather_rain",         Icon: IconCloudRain };
  if (code <= 77)                return { labelKey: "weather_snow",         Icon: IconCloudSnow };
  if (code <= 82)                return { labelKey: "weather_shower",       Icon: IconCloudRain };
  if (code <= 86)                return { labelKey: "weather_snow_shower",  Icon: IconCloudSnow };
  return                                { labelKey: "weather_thunderstorm", Icon: IconCloudStorm };
}

function parseEventDateTime(date: string, time?: string | null): Date | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(date + "T00:00:00");
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

/* ───────── 컴포넌트 ───────── */

export default function HomePage() {
  const { t, locale } = useLocale();
  const [time, setTime]         = useState("");
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr]   = useState("");
  const [todos, setTodos]       = useState<Todo[]>([]);
  const [tip, setTip]           = useState("");
  const [tipCategory, setTipCategory] = useState("");
  const [weather, setWeather]   = useState<WeatherInfo | null>(null);
  const [locationName, setLocationName] = useState("");
  const [geoStatus, setGeoStatus] = useState<"waiting" | "ok" | "denied">("waiting");
  const [weekStats, setWeekStats]         = useState<Partial<Record<FeatureKey, number>>>({});
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const { menuSettings, menuOrder, recentRoutes } = useWorkspace();
  const [showMore, setShowMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [leaveData,      setLeaveData]      = useState<(LeaveResult & { used: number }) | null>(null);
  const [dataLoaded,     setDataLoaded]     = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingUid,  setOnboardingUid]  = useState<string | null>(null);
  const [nearestTodayEvent, setNearestTodayEvent] = useState<{ title: string; time: string; dt: Date } | null>(null);
  const [aiSuggestion,   setAiSuggestion]   = useState<AiSuggestion | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const customGreetingRef = useRef<CustomGreeting | null>(null);

  // 실시간 시계 + 시간대별 인사말
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setTime(`${hh}:${mm}`);
      setGreeting(getGreetingText(now, customGreetingRef.current));
    };
    tick();
    intervalRef.current = setInterval(tick, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // 날짜 + 팁 + localStorage
  useEffect(() => {
    const now   = new Date();
    const month = now.getMonth() + 1;
    const date  = now.getDate();
    const dayKo = DAY_KO[now.getDay()];
    const dayEn = DAY_EN[now.getDay()];
    setDateStr(
      locale === "en"
        ? `${dayEn}, ${now.toLocaleString("en-US", { month: "long" })} ${date}, ${now.getFullYear()}`
        : `${now.getFullYear()}년 ${month}월 ${date}일 ${dayKo}`
    );

  }, [locale]);

  useEffect(() => {
    const date = new Date().getDate();
    // 날짜 기반 팁 (하루 동안 고정)
    const todayTip = TIPS[date % TIPS.length];
    setTip(todayTip.text);
    setTipCategory(todayTip.category);

    setWeekStats(getThisWeekStats());
    const todayStr = new Date().toISOString().slice(0, 10);

    // Supabase에서 최신 데이터 비동기 로드
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) { setLoadError(true); return; }
      const [dbStats, dbEvents, todayTodos, dbSettings, dbClients] = await Promise.all([
        getStats(uid),
        getEvents(uid),
        getTodos(uid, todayStr),
        getSettings(uid),
        getClients(uid),
      ]);
      customGreetingRef.current = dbSettings?.custom_greeting ?? null;
      setGreeting(getGreetingText(new Date(), customGreetingRef.current));
      const empType = (dbSettings?.employment_type ?? 'new') as EmploymentType;
      if (empType === 'career' || dbSettings?.join_date) {
        const standard = (dbSettings?.leave_standard ?? 'fiscal_year') as LeaveStandard;
        const result = calcAnnualLeave(
          dbSettings?.join_date ?? '',
          standard,
          empType,
          dbSettings?.granted_leaves,
        );
        setLeaveData({ ...result, used: dbSettings?.used_leaves ?? 0 });
      }
      setWeekStats(dbStats as Partial<Record<FeatureKey, number>>);
      const upcoming = dbEvents
        .filter(e => e.date >= todayStr)
        .slice(0, 3)
        .map(e => ({ id: e.id, date: e.date, title: e.title, time: e.time, location: e.location } as CalendarEvent));
      setUpcomingEvents(upcoming);
      if (todayTodos.length > 0) setTodos(todayTodos.map(t => ({ id: t.id, text: t.text, completed: t.completed })));

      // 오늘 일정 요약 + 가장 가까운 임박 일정 계산
      const todaysEvents = dbEvents.filter(e => e.date === todayStr);
      const now = new Date();
      const upcomingTodayWithTime = todaysEvents
        .map(e => ({ title: e.title, time: e.time ?? "", dt: parseEventDateTime(e.date, e.time) }))
        .filter((e): e is { title: string; time: string; dt: Date } => e.dt !== null && e.dt.getTime() >= now.getTime())
        .sort((a, b) => a.dt.getTime() - b.dt.getTime());
      setNearestTodayEvent(upcomingTodayWithTime[0] ?? null);

      // AI 제안 카드: a) 거래처 계약 만료 임박 → b) 오늘 일정 임박 → c) 오늘 할 일 과다, 우선순위대로 하나만
      const expiringClients = dbClients
        .filter(c => c.contract_start && c.contract_days)
        .map(c => ({ name: c.name, dday: calcDday(addBusinessDays(c.contract_start!, c.contract_days!)) }))
        .filter(c => c.dday >= 0 && c.dday <= 7)
        .sort((a, b) => a.dday - b.dday);
      const imminentEvent = upcomingTodayWithTime.find(e => e.dt.getTime() - now.getTime() <= 30 * 60 * 1000);
      const remainingTodayTodos = todayTodos.filter(t => !t.completed).length;

      if (expiringClients.length > 0) {
        setAiSuggestion({ type: "client", name: expiringClients[0].name, dday: expiringClients[0].dday });
      } else if (imminentEvent) {
        setAiSuggestion({ type: "event", title: imminentEvent.title });
      } else if (remainingTodayTodos >= 5) {
        setAiSuggestion({ type: "todos", count: remainingTodayTodos });
      } else {
        setAiSuggestion(null);
      }

      // 하루 한 번 브라우저 알림 (일정 + 거래처 D-day)
      runDailyNotificationChecks(
        dbEvents.map(e => ({ date: e.date, title: e.title })),
        dbClients.map(c => ({ name: c.name, contract_start: c.contract_start, contract_days: c.contract_days })),
        uid
      );

      setDataLoaded(true);

      // 온보딩: 전부 비어있는 신규 사용자에게만 표시
      const isNew = !dbSettings?.sender_info && !dbSettings?.job_preset && !dbSettings?.join_date;
      if (isNew && localStorage.getItem("worky_onboarding_dismissed") !== "true") {
        setOnboardingUid(uid);
        setShowOnboarding(true);
      }

    }).catch(() => setLoadError(true));

  }, []);

  // 날씨 + 위치명 (geolocation + Open-Meteo + Nominatim)
  useEffect(() => {
    if (!navigator.geolocation) { setGeoStatus("denied"); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoStatus("ok");
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const [weatherRes, geoRes] = await Promise.all([
            fetch(`/api/weather?lat=${lat}&lon=${lon}`),
            fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
              { headers: { "Accept-Language": "ko", "User-Agent": "Worky-App/1.0" } }
            ),
          ]);
          const [weatherData, geoData] = await Promise.all([weatherRes.json(), geoRes.json()]);

          // 날씨
          const cw = weatherData.current_weather;
          const { labelKey, Icon } = getWeatherFromCode(cw.weathercode);
          setWeather({ temp: Math.round(cw.temperature), labelKey, Icon });

          // 위치명: city → town → county → state 순 우선순위
          const addr = geoData.address ?? {};
          const city = addr.city || addr.town || addr.county || addr.state || "";
          setLocationName(city);
        } catch (e) { console.error("[날씨] fetch 실패:", e); }
      },
      () => setGeoStatus("denied")
    );
  }, []);

  // 할 일 통계
  const total     = todos.length;
  const completed = todos.filter((t) => t.completed).length;

  const remaining = todos.filter(todo => !todo.completed);
  const activeRoutes = workspaceRoutes(menuSettings, menuOrder).filter(route => route !== "/");
  const suggestion = aiSuggestion?.type === "client" && !isRouteEnabled(menuSettings, "/clients") ? null : aiSuggestion;
  const focusTitle = suggestion?.type === "client"
    ? tFormat(t(suggestion.dday === 0 ? "ai_suggestion_client_expiry_today" : "ai_suggestion_client_expiry"), { name: suggestion.name, n: String(suggestion.dday) })
    : suggestion?.type === "event"
      ? tFormat(t("ai_suggestion_event_soon"), { title: suggestion.title })
      : remaining[0]?.text ?? nearestTodayEvent?.title ?? t("wk_start");
  const focusHref = suggestion?.type === "client" ? "/clients" : suggestion?.type === "event" ? "/calendar" : remaining.length ? "/todo" : nearestTodayEvent ? "/calendar" : "/todo";
  const hasFocus = Boolean(suggestion || remaining.length || nearestTodayEvent);
  const WeatherIcon = weather?.Icon;
  const weekTotal = Object.values(weekStats).reduce((sum, n) => sum + (n ?? 0), 0);

  return <div className="wk-home">
    {showOnboarding && onboardingUid && <OnboardingModal userId={onboardingUid} onClose={() => setShowOnboarding(false)} />}
    <section className="wk-home-intro" aria-labelledby="worky-greeting">
      <div className="wk-eyebrow"><span>{t("wk_today")}</span><span aria-hidden="true">/</span><span>{dateStr}</span></div>
      <h2 id="worky-greeting">{greeting || t("wk_start")}</h2>
      <div className="wk-home-meta">
        {dataLoaded && <span>{total === 0 ? t("home_todos_empty") : remaining.length === 0 ? t("home_todos_all_done") : tFormat(t("home_todos_left"), { n: remaining.length })}</span>}
        <span className="flex items-center gap-2"><IconClock size={14} aria-hidden="true" />{time}</span>
        {geoStatus === "ok" && weather && WeatherIcon && <span className="flex items-center gap-2"><WeatherIcon className="w-4 h-4" />{locationName} {weather.temp}°C · {t(weather.labelKey)}</span>}
      </div>
    </section>

    <section className="wk-focus" aria-labelledby="worky-focus">
      <div className="wk-focus-copy">
        <div className="wk-focus-label"><span>{t("wk_focus")}</span></div>
        {loadError ? <h3 id="worky-focus" role="alert" className="wk-error">{t("wk_load_error")}</h3> : !dataLoaded ? <h3 id="worky-focus" role="status">{t("wk_loading")}</h3> : <>
          <h3 id="worky-focus">{focusTitle}</h3>
          <p>{t(hasFocus ? "wk_focus_hint" : "wk_start_hint")}</p>
        </>}
      </div>
      {dataLoaded && <Link className="wk-action" href={focusHref}>{t(hasFocus ? "wk_open_task" : "wk_add_task")}<IconArrowRight size={16} aria-hidden="true" /></Link>}
    </section>

    {dataLoaded && <div className="wk-work-grid wk-section">
      <section className="wk-work-panel" aria-labelledby="worky-schedule">
        <div className="wk-section-heading"><h3 id="worky-schedule">{t("wk_schedule")}</h3><Link className="wk-text-link" href="/calendar">{t("view_all")}<IconArrowRight size={14} aria-hidden="true" /></Link></div>
        {upcomingEvents.length > 0 ? <ol className="wk-work-list">{upcomingEvents.map(event => <li key={event.id} className="wk-work-row">
          <span className="wk-work-time">{event.time || t("wk_all_day")}</span>
          <Link href="/calendar"><span>{event.title}</span><p>{event.date}{event.location ? " · " + event.location : ""}</p></Link>
        </li>)}</ol> : <div className="wk-empty"><p>{t("wk_no_events")}</p><Link href="/calendar" className="wk-text-link">{t("add_event")}<IconArrowRight size={14} aria-hidden="true" /></Link></div>}
      </section>
      <section className="wk-work-panel" aria-labelledby="worky-tasks">
        <div className="wk-section-heading"><h3 id="worky-tasks">{t("wk_tasks")}</h3><Link className="wk-text-link" href="/todo">{t("view_all")}<IconArrowRight size={14} aria-hidden="true" /></Link></div>
        {total > 0 && <div className="wk-progress"><progress max={total} value={completed} aria-label={t("todo_progress")} /><span>{tFormat(t("wk_task_summary"), { total, done: completed })}</span></div>}
        {remaining.length > 0 ? <ul className="wk-work-list">{remaining.slice(0, 3).map(todo => <li key={todo.id} className="wk-work-row">
          <IconCircle size={16} className="wk-task-icon" aria-hidden="true" /><Link href="/todo">{todo.text}</Link>
        </li>)}</ul> : <div className="wk-empty"><p>{t(total > 0 ? "wk_all_done" : "wk_no_tasks")}</p><Link href="/todo" className="wk-text-link">{t("wk_add_task")}<IconArrowRight size={14} aria-hidden="true" /></Link></div>}
      </section>
    </div>}

    <section className="wk-quick wk-section" aria-labelledby="worky-tools">
      <div className="wk-quick-main">
        <h3 id="worky-tools">{t(recentRoutes.length ? "wk_recent" : "wk_tools")}</h3>
        {recentRoutes.length > 0 && <div className="wk-recent">{recentRoutes.map(route => <Link href={route} key={route}><span className="wk-tool-icon"><WorkspaceIcon route={route} /></span>{t(MENU_LOCALE_MAP[route])}<IconArrowRight className="wk-link-arrow" size={14} aria-hidden="true" /></Link>)}</div>}
        {recentRoutes.length === 0 && <p className="wk-quick-hint">{t("wk_tools_hint")}</p>}
      </div>
      <button type="button" className="wk-text-link wk-tools-toggle" aria-expanded={showMore} aria-controls="worky-tool-list" onClick={() => setShowMore(value => !value)}>{t(showMore ? "wk_less_tools" : "wk_more_tools")}<IconArrowRight size={16} aria-hidden="true" /></button>
    </section>
    <div id="worky-tool-list" className="wk-tool-drawer" data-state={showMore ? "open" : "closed"} aria-hidden={!showMore} inert={!showMore}>
      <div className="wk-tool-drawer-inner"><nav className="wk-tools" aria-label={t("wk_tools")}>
        {activeRoutes.map(route => <Link className="wk-tool" href={route} key={route}><span className="wk-tool-icon"><WorkspaceIcon route={route} /></span><span>{t(MENU_LOCALE_MAP[route])}</span><IconArrowRight className="wk-link-arrow" size={14} aria-hidden="true" /></Link>)}
      </nav><Link className="wk-text-link wk-customize" href="/settings"><IconAdjustments size={16} aria-hidden="true" />{t("wk_customize")}</Link></div>
    </div>

    <WorkBrief weekTotal={weekTotal} leaveRemaining={leaveData ? Math.max(0, leaveData.total - leaveData.used) : null}
      tip={locale === "ko" ? tip : t("home_tip_fallback")} tipCategory={locale === "ko" ? tipCategory : undefined} />
    <ExternalShortcuts />
  </div>;
}
