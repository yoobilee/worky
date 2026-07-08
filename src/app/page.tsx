"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  IconTable, IconMail, IconFileDescription, IconCalendarEvent,
  IconListCheck, IconBulb, IconWifi, IconWifiOff, IconArrowRight,
  IconMessageDots, IconNotes, IconPlus,
  IconSun, IconCloud, IconCloudRain, IconCloudSnow, IconCloudStorm, IconMist, IconMapPin,
  IconTemperature, IconClock, IconLanguage, IconChartBar, IconBook, IconCalendar,
  IconBuilding, IconAddressBook, IconSparkles, IconX, IconMessageCheck,
  IconBrandOpenai, IconBrandGoogle, IconBrandGmail, IconBrandGoogleDrive, IconBrandNotion, IconSearch,
  IconBrandGithub, IconBrandYoutube, IconBrandInstagram, IconBrandX, IconBrandFigma,
  IconBrandLinkedin, IconBrandSlack, IconBrandDiscord, IconMessageCircle, IconBrandFacebook,
  IconBrandTiktok, IconBrandTrello, IconBrandDropbox,
} from "@tabler/icons-react";
import {
  loadMenuSettings, isRouteEnabled, MENU_SETTINGS_EVENT, type MenuSettings,
  MENU_LOCALE_MAP,
} from "@/lib/menuSettings";
import { getThisWeekStats, type FeatureKey } from "@/lib/usageStats";
import { type CalendarEvent } from "@/lib/calendarStorage";
import { createClient } from "@/lib/supabase/client";
import { getStats, getTopFeatures } from "@/lib/db/usage_stats";
import { getEvents } from "@/lib/db/calendar";
import { getTodos } from "@/lib/db/todos";
import { getSettings, type CustomGreeting } from "@/lib/db/settings";
import { calcAnnualLeave, type LeaveStandard, type EmploymentType, type LeaveResult } from "@/lib/leave";
import { runDailyNotificationChecks, addBusinessDays, calcDday } from "@/lib/notifications";
import { getClients } from "@/lib/db/clients";
import OnboardingModal from "@/components/OnboardingModal";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";
import type { TranslationKey } from "@/lib/i18n/translations";

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

const QUICK_LINKS = [
  { href: "/data",      label: "데이터 정리",    Icon: IconTable,          desc: "텍스트 → 표" },
  { href: "/todo",      label: "할 일 / 메모",   Icon: IconListCheck,      desc: "할 일 관리" },
  { href: "/template",  label: "템플릿 생성",    Icon: IconNotes,          desc: "문서 자동 작성" },
  { href: "/qa",        label: "Q&A",            Icon: IconMessageDots,    desc: "AI 업무 상담" },
  { href: "/email",     label: "이메일 작성",    Icon: IconMail,           desc: "답장 초안 생성" },
  { href: "/summary",   label: "문서 요약",      Icon: IconFileDescription, desc: "AI 핵심 요약" },
  { href: "/schedule",  label: "일정 추출",      Icon: IconCalendarEvent,  desc: "날짜·장소 추출" },
  { href: "/translate", label: "번역·다듬기",    Icon: IconLanguage,       desc: "번역 / 톤 조정" },
  { href: "/insight",   label: "데이터 분석", Icon: IconChartBar,       desc: "수치 분석" },
  { href: "/glossary",  label: "용어집",         Icon: IconBook,           desc: "사내 용어 관리" },
  { href: "/calendar",  label: "일정 관리",      Icon: IconCalendar,       desc: "월별 일정 관리" },
  { href: "/clients",   label: "거래처 관리",    Icon: IconBuilding,       desc: "거래처 보고 관리" },
  { href: "/members",   label: "구성원 관리",    Icon: IconAddressBook,    desc: "팀원 정보 관리" },
];

/* 자주 쓰는 기능 칩에 쓰이는 FeatureKey → 목적지 매핑 (홈 화면 링크가 없는 report 등은 제외) */
const FEATURE_CHIP_META: Partial<Record<FeatureKey, { href: string; Icon: typeof IconTable; labelKey: TranslationKey }>> = {
  data:      { href: "/data",      Icon: IconTable,          labelKey: "menu_data" },
  email:     { href: "/email",     Icon: IconMail,           labelKey: "sidebar_email" },
  template:  { href: "/template",  Icon: IconNotes,          labelKey: "menu_template" },
  translate: { href: "/translate", Icon: IconLanguage,       labelKey: "menu_translate" },
  summary:   { href: "/summary",   Icon: IconFileDescription, labelKey: "menu_summary" },
  schedule:  { href: "/schedule",  Icon: IconCalendarEvent,  labelKey: "sidebar_schedule" },
  insight:   { href: "/insight",   Icon: IconChartBar,       labelKey: "menu_insight" },
  qa:        { href: "/qa",        Icon: IconMessageDots,    labelKey: "sidebar_qa" },
  feedback:  { href: "/feedback",  Icon: IconMessageCheck,   labelKey: "menu_feedback" },
};

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
  const [aiStatus, setAiStatus] = useState<"checking" | "connected" | "error">("checking");
  const [weather, setWeather]   = useState<WeatherInfo | null>(null);
  const [locationName, setLocationName] = useState("");
  const [geoStatus, setGeoStatus] = useState<"waiting" | "ok" | "denied">("waiting");
  const [weekStats, setWeekStats]         = useState<Partial<Record<FeatureKey, number>>>({});
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [menuSettings,   setMenuSettings]   = useState<MenuSettings>({});
  const [showMore,       setShowMore]       = useState(false);
  const [leaveData,      setLeaveData]      = useState<(LeaveResult & { used: number }) | null>(null);
  const [dataLoaded,     setDataLoaded]     = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingUid,  setOnboardingUid]  = useState<string | null>(null);
  const [topFeatures,    setTopFeatures]    = useState<Array<{ feature: FeatureKey; count: number }>>([]);
  const [todayEventCount, setTodayEventCount] = useState(0);
  const [nearestTodayEvent, setNearestTodayEvent] = useState<{ title: string; time: string; dt: Date } | null>(null);
  const [hadEventsToday, setHadEventsToday] = useState(false);
  const [aiSuggestion,   setAiSuggestion]   = useState<AiSuggestion | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const customGreetingRef = useRef<CustomGreeting | null>(null);

  // 실시간 시계 + 시간대별 인사말
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setTime(`${hh}:${mm}:${ss}`);
      setGreeting(getGreetingText(now, customGreetingRef.current));
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
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
      if (!uid) return;
      const [dbStats, dbEvents, todayTodos, dbSettings, dbClients, topFeaturesData] = await Promise.all([
        getStats(uid),
        getEvents(uid),
        getTodos(uid, todayStr),
        getSettings(uid),
        getClients(uid),
        getTopFeatures(uid, 10),
      ]);
      setTopFeatures(topFeaturesData);
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
      setTodayEventCount(todaysEvents.length);
      setHadEventsToday(todaysEvents.length > 0);
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

    });

    // 메뉴 설정
    setMenuSettings(loadMenuSettings());
    const onMenuChange = () => setMenuSettings(loadMenuSettings());
    window.addEventListener(MENU_SETTINGS_EVENT, onMenuChange);
    return () => window.removeEventListener(MENU_SETTINGS_EVENT, onMenuChange);
  }, []);

  // 더보기 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node))
        setShowMore(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMore]);

  // AI 연결 확인
  useEffect(() => {
    fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "안녕" }],
        systemPrompt: "한 단어로만 대답하세요.",
      }),
    })
      .then((res) => setAiStatus(res.ok ? "connected" : "error"))
      .catch(() => setAiStatus("error"));
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

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-2 flex-1 min-h-0 h-full w-full">

      {showOnboarding && onboardingUid && (
        <OnboardingModal
          userId={onboardingUid}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {/* ── 오늘 요약 헤더 ── */}
      {(() => {
        const remainingToday = total - completed;
        const summaryText = total === 0
          ? t("home_todos_empty")
          : remainingToday === 0
            ? t("home_todos_all_done")
            : tFormat(t("home_todos_left"), { n: String(remainingToday) });

        const eventBlurb = nearestTodayEvent
          ? (() => {
              const diffMin = Math.max(0, Math.round((nearestTodayEvent.dt.getTime() - Date.now()) / 60000));
              return diffMin >= 60
                ? tFormat(t("home_event_hours_left"), { time: nearestTodayEvent.time, n: String(Math.round(diffMin / 60)) })
                : tFormat(t("home_event_minutes_left"), { time: nearestTodayEvent.time, n: String(diffMin) });
            })()
          : !hadEventsToday
            ? t("home_no_events_today")
            : null;

        const WeatherIcon = weather?.Icon ?? null;
        return (
          <div className="px-3 py-2 shrink-0">
            <div className="flex items-center justify-between gap-4">
              {/* 왼쪽: 날짜·인사·오늘 요약 */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 tracking-wide shrink-0">{dateStr}</p>
                  <span className="text-xs text-slate-400 dark:text-zinc-500 truncate">{greeting}</span>
                </div>
                {!dataLoaded ? (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-6 w-48" />
                    <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-2.5 w-32" />
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug truncate">
                      {summaryText}
                    </h2>
                    {eventBlurb && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{eventBlurb}</p>
                    )}
                  </>
                )}
              </div>

              {/* 오른쪽: 날씨 + 구분선 + 시계 */}
              <div className="flex items-center gap-3 shrink-0">
                {/* 날씨 */}
                <div className="flex flex-col items-center gap-1 min-w-[60px] min-h-[64px] justify-center">
                  {(geoStatus === "waiting" || (geoStatus === "ok" && !weather)) && (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full w-10 h-10" />
                      <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-2.5 w-10" />
                    </div>
                  )}
                  {geoStatus === "denied" && (
                    <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                      <IconMapPin className="w-3 h-3" /> {t("weather_none")}
                    </span>
                  )}
                  {geoStatus === "ok" && weather && WeatherIcon && (
                    <>
                      <WeatherIcon className="w-10 h-10 text-[#4D44CC] dark:text-[#8B85FF]" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 leading-none">{t(weather.labelKey)}</span>
                      <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-0.5">
                        <IconTemperature className="w-3 h-3" />{weather.temp}°C
                      </span>
                    </>
                  )}
                </div>

                {/* 구분선 */}
                <div className="w-px h-10 bg-slate-200 dark:bg-zinc-700 shrink-0" />

                {/* 실시간 시계 */}
                <div className="flex flex-col items-center gap-1 min-w-[56px]">
                  <IconClock className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF]" />
                  <span className="text-lg font-semibold text-slate-800 dark:text-slate-100 tracking-wide tabular-nums leading-none">
                    {time}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── AI 제안 카드 ── */}
      {dataLoaded && aiSuggestion && (
        <div
          className="px-4 py-3 rounded-2xl flex items-center justify-between gap-3 shrink-0"
          style={{ background: "#6C63FF1A" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <IconSparkles className="w-4 h-4 shrink-0" style={{ color: "#6C63FF" }} />
            <p className="text-sm font-semibold truncate" style={{ color: "#6C63FF" }}>
              {aiSuggestion.type === "client" && (
                aiSuggestion.dday === 0
                  ? tFormat(t("ai_suggestion_client_expiry_today"), { name: aiSuggestion.name })
                  : tFormat(t("ai_suggestion_client_expiry"), { name: aiSuggestion.name, n: String(aiSuggestion.dday) })
              )}
              {aiSuggestion.type === "event" && tFormat(t("ai_suggestion_event_soon"), { title: aiSuggestion.title })}
              {aiSuggestion.type === "todos" && t("ai_suggestion_busy_todos")}
            </p>
          </div>
          <Link
            href={aiSuggestion.type === "client" ? "/clients" : aiSuggestion.type === "event" ? "/calendar" : "/todo"}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-transform hover:scale-105"
            style={{ background: "#6C63FF" }}
          >
            {aiSuggestion.type === "client" && t("ai_suggestion_goto_clients")}
            {aiSuggestion.type === "event" && t("ai_suggestion_goto_calendar")}
            {aiSuggestion.type === "todos" && t("ai_suggestion_goto_todos")}
          </Link>
        </div>
      )}

      {/* ── 핵심 지표 3개 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
        <Link
          href="/todo"
          className="card-hover min-w-0 rounded-2xl p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col gap-1 hover:border-[#6C63FF]/50 transition-colors"
        >
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 min-w-0">
            <IconListCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate min-w-0">{t("home_metric_todos_left")}</span>
          </span>
          {!dataLoaded ? (
            <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-7 w-10" />
          ) : (
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{total - completed}</span>
          )}
        </Link>

        <Link
          href="/calendar"
          className="card-hover min-w-0 rounded-2xl p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col gap-1 hover:border-[#6C63FF]/50 transition-colors"
        >
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 min-w-0">
            <IconCalendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate min-w-0">{t("home_metric_events_today")}</span>
          </span>
          {!dataLoaded ? (
            <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-7 w-10" />
          ) : (
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{todayEventCount}</span>
          )}
        </Link>

        <Link
          href="/settings"
          className="card-hover min-w-0 rounded-2xl p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col gap-1 hover:border-[#6C63FF]/50 transition-colors"
        >
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 min-w-0">
            <span className="truncate min-w-0">{t("home_metric_leave_left")}</span>
          </span>
          {!dataLoaded ? (
            <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-7 w-10" />
          ) : leaveData ? (
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {Math.max(0, leaveData.total - leaveData.used)}
            </span>
          ) : (
            <span className="text-2xl font-bold text-slate-300 dark:text-zinc-700">–</span>
          )}
        </Link>
      </div>

      {/* ── 자주 쓰는 기능 ── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-3 shadow-sm shrink-0 overflow-hidden min-h-0">
        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3">{t("quick_access")}</p>
        {(() => {
          const validTop = topFeatures
            .filter(({ feature }) => FEATURE_CHIP_META[feature])
            .slice(0, 5);

          if (dataLoaded && validTop.length > 0) {
            return (
              <div className="flex flex-wrap gap-2">
                {validTop.map(({ feature }) => {
                  const meta = FEATURE_CHIP_META[feature]!;
                  const Icon = meta.Icon;
                  return (
                    <Link
                      key={feature}
                      href={meta.href}
                      className="card-hover flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-full border border-slate-200 dark:border-zinc-700 hover:border-[#6C63FF]/50 hover:bg-[#6C63FF]/5 transition-all"
                    >
                      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF]">
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                        {t(meta.labelKey)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          }

          const active = QUICK_LINKS.filter(({ href }) => isRouteEnabled(menuSettings, href));
          const hasMore = active.length > 11;
          const displayed = hasMore ? active.slice(0, 11) : active;
          const rest      = hasMore ? active.slice(11) : [];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {displayed.map(({ href, label, Icon, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-[#6C63FF]/50 hover:bg-[#6C63FF]/5 transition-all group"
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF]">
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate">{MENU_LOCALE_MAP[href] ? t(MENU_LOCALE_MAP[href]) : label}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{desc}</p>
                  </div>
                </Link>
              ))}

              {hasMore && (
                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => setShowMore((v) => !v)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-[#6C63FF]/50 hover:bg-[#6C63FF]/5 transition-all"
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 dark:bg-zinc-800">
                      <IconArrowRight className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                    </span>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{t("home_more")}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{tFormat(t("home_count_n"), { n: String(rest.length) })}</p>
                    </div>
                  </button>

                  {showMore && (
                    <div className="absolute right-0 bottom-full mb-1 z-50 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden min-w-[200px]">
                      {rest.map(({ href, label, Icon, desc }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setShowMore(false)}
                          className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b border-slate-100 dark:border-zinc-800 last:border-0"
                        >
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF]">
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{MENU_LOCALE_MAP[href] ? t(MENU_LOCALE_MAP[href]) : label}</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{desc}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── 하단 그리드 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-stretch sm:flex-1 sm:min-h-0">

        {/* 이번 주 활동 */}
        {(() => {
          const FEATURES: { key: FeatureKey; labelKey: TranslationKey }[] = [
            { key: "data",      labelKey: "menu_data"      },
            { key: "email",     labelKey: "sidebar_email"  },
            { key: "template",  labelKey: "menu_template"  },
            { key: "translate", labelKey: "menu_translate" },
            { key: "summary",   labelKey: "menu_summary"   },
            { key: "schedule",  labelKey: "sidebar_schedule" },
            { key: "insight",   labelKey: "menu_insight"   },
            { key: "qa",        labelKey: "sidebar_qa"     },
            { key: "feedback",  labelKey: "menu_feedback"  },
          ];
          const counts = FEATURES.map((f) => weekStats[f.key] ?? 0);
          const maxCount = Math.max(...counts, 1);
          const totalUsed = counts.reduce((a, b) => a + b, 0);

          return (
            <div className="bg-white dark:bg-zinc-800/50 rounded-2xl p-3 flex flex-col gap-2 sm:min-h-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconChartBar className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF]" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{t("weekly_activity")}</span>
                </div>
                {totalUsed > 0 && (
                  <span className="text-xs text-slate-500 dark:text-zinc-400">{tFormat(t("home_total_n"), { n: String(totalUsed) })}</span>
                )}
              </div>

              {!dataLoaded ? (
                <div className="space-y-2 py-1">
                  {[72, 55, 88, 40].map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-2.5 w-[88px] shrink-0" />
                      <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-2 flex-1" style={{ maxWidth: `${w}%` }} />
                    </div>
                  ))}
                </div>
              ) : totalUsed === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                  <p className="text-sm text-slate-500 dark:text-zinc-400">{t("home_no_activity")}</p>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                  <div className="space-y-2">
                    {FEATURES.map(({ key, labelKey }, i) => {
                      const count  = counts[i];
                      const isMax  = count === maxCount && count > 0;
                      const pct    = Math.round((count / maxCount) * 100);
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className={`text-xs w-[88px] shrink-0 truncate ${isMax ? "font-semibold text-[#4D44CC] dark:text-[#8B85FF]" : "text-slate-500 dark:text-zinc-400"}`}>
                            {t(labelKey)}
                          </span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: count > 0 ? (isMax ? "linear-gradient(90deg,#6C63FF,#8B85FF)" : "#6C63FF80") : "transparent",
                              }}
                            />
                          </div>
                          <span className={`text-xs w-6 text-right shrink-0 ${count > 0 ? "text-slate-600 dark:text-zinc-300" : "text-slate-300 dark:text-zinc-700"}`}>
                            {count > 0 ? count : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 다가오는 일정 — 3티어 */}
        <div className="bg-white dark:bg-zinc-800/50 rounded-2xl p-3 flex flex-col gap-2 sm:min-h-0 sm:overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconCalendar className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF]" />
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{t("upcoming_events")}</span>
            </div>
            <Link href="/calendar"
              className="flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-[#4D44CC] dark:text-[#8B85FF] transition-colors">
              {t("view_all")} <IconArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {!dataLoaded ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 space-y-1.5">
                  <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-2.5 w-3/4" />
                  <div className="animate-pulse bg-slate-200 dark:bg-zinc-700 rounded-full h-2 w-1/3" />
                </div>
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
              <p className="text-sm text-slate-500 dark:text-zinc-400">{t("no_events")}</p>
              <Link href="/calendar"
                className="mt-2 text-xs text-[#4D44CC] dark:text-[#8B85FF] hover:underline">
                {t("add_event")}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map(ev => (
                <div key={ev.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{ev.title}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{ev.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) => `${Number(m)}/${Number(d)}`)}</span>
                      {ev.time && <><span className="opacity-40">·</span><span>{ev.time}</span></>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오늘의 팁 — 3티어 */}
        <div className="bg-white dark:bg-zinc-800/50 rounded-2xl p-4 flex flex-col sm:overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <IconBulb className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF]" />
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{t("daily_tip")}</span>
          </div>
          <p className="text-sm leading-6 text-slate-700 dark:text-zinc-300 flex-1 line-clamp-3">
            {tip || t("home_tip_fallback")}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700">
            {tipCategory && (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: "#6C63FF22", color: "#6C63FF" }}
              >
                {tipCategory}
              </span>
            )}
            <p className="text-xs text-slate-500 dark:text-zinc-400 ml-auto">{t("home_tip_daily")}</p>
          </div>
        </div>

      </div>

      {/* ── AI 스피드 다이얼 ── */}
      <SpeedDial />

    </div>
  );
}

interface CustomLink { url: string; name: string }

type IconComp = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const DEFAULT_SPEED_LINKS: Array<{ name: string; href: string; Icon: IconComp | null; letter: string | null }> = [
  { name: "Claude",       href: "https://claude.ai",         Icon: null,                 letter: "C" },
  { name: "ChatGPT",      href: "https://chatgpt.com",        Icon: IconBrandOpenai,      letter: null },
  { name: "Gemini",       href: "https://gemini.google.com",  Icon: IconBrandGoogle,      letter: null },
  { name: "구글",         href: "https://google.com",         Icon: IconSearch,           letter: null },
  { name: "노션",         href: "https://notion.so",          Icon: IconBrandNotion,      letter: null },
  { name: "Gmail",        href: "https://mail.google.com",    Icon: IconBrandGmail,       letter: null },
  { name: "네이버",       href: "https://naver.com",          Icon: null,                 letter: "N" },
  { name: "Google Drive", href: "https://drive.google.com",   Icon: IconBrandGoogleDrive, letter: null },
];

const BRAND_ICON_MAP: Record<string, IconComp> = {
  "github.com":      IconBrandGithub,
  "youtube.com":     IconBrandYoutube,
  "instagram.com":   IconBrandInstagram,
  "twitter.com":     IconBrandX,
  "x.com":           IconBrandX,
  "figma.com":       IconBrandFigma,
  "linkedin.com":    IconBrandLinkedin,
  "slack.com":       IconBrandSlack,
  "discord.com":     IconBrandDiscord,
  "notion.so":       IconBrandNotion,
  "kakao.com":       IconMessageCircle,
  "kakaowork.com":   IconMessageCircle,
  "facebook.com":    IconBrandFacebook,
  "tiktok.com":      IconBrandTiktok,
  "trello.com":      IconBrandTrello,
  "dropbox.com":     IconBrandDropbox,
};

function getBrandIcon(domain: string): IconComp | null {
  const host = domain.replace(/^www\./, "");
  for (const [key, Icon] of Object.entries(BRAND_ICON_MAP)) {
    if (host === key || host.endsWith(`.${key}`)) return Icon;
  }
  return null;
}

function FaviconImg({ domain, name, size }: { domain: string; name: string; size: number }) {
  const [err, setErr] = useState(false);
  const isLocal =
    !domain ||
    domain.startsWith("file://") ||
    domain === "localhost" ||
    domain.startsWith("localhost:") ||
    domain === "127.0.0.1" ||
    domain.startsWith("127.0.0.1:");

  const BrandIcon = !isLocal ? getBrandIcon(domain) : null;
  if (BrandIcon) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, #6C63FF, #8B85FF)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BrandIcon style={{ width: size * 0.45, height: size * 0.45, color: "white" }} />
      </div>
    );
  }

  if (err || isLocal) {
    return (
      <div
        className="w-full h-full rounded-full flex items-center justify-center text-white font-bold leading-none shrink-0"
        style={{
          background: "#6C63FF",
          fontSize: Math.round(size * 0.38),
          letterSpacing: "-0.02em",
          fontFamily: "var(--font-nunito), 'Varela Round', 'Noto Sans KR', sans-serif",
          fontWeight: 800,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={name}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setErr(true)}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth <= 16 && img.naturalHeight <= 16) setErr(true);
      }}
    />
  );
}

function SpeedDial() {
  const { t } = useLocale();
  const [open, setOpen]               = useState(false);
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [showModal, setShowModal]     = useState(false);
  const [newUrl, setNewUrl]           = useState("");
  const [newName, setNewName]         = useState("");
  const [userId, setUserId]           = useState<string | null>(null);
  const [atTop, setAtTop]             = useState(true);
  const [atBottom, setAtBottom]       = useState(false);
  const [isDark, setIsDark]           = useState(false);
  const ref       = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      setUserId(uid);
      try {
        const { data: settings } = await supabase
          .from("user_settings")
          .select("speed_dial_custom")
          .eq("user_id", uid)
          .maybeSingle();
        if (settings?.speed_dial_custom?.length) {
          setCustomLinks(settings.speed_dial_custom as CustomLink[]);
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 다크모드 감지
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // 패널 열릴 때 초기 스크롤 상태 계산
  useEffect(() => {
    if (!open) { setAtTop(true); setAtBottom(false); return; }
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      setAtTop(el.scrollTop <= 0);
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    });
  }, [open, customLinks]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtTop(el.scrollTop <= 0);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  };

  const getDomain = (url: string) => {
    try { return new URL(url.startsWith("http") ? url : "https://" + url).hostname; }
    catch { return url; }
  };

  const saveCustomLinks = async (updated: CustomLink[]) => {
    if (!userId) return;
    try {
      const supabase = createClient();
      await supabase
        .from("user_settings")
        .upsert({ user_id: userId, speed_dial_custom: updated }, { onConflict: "user_id" });
    } catch {}
  };

  const addLink = async () => {
    const trimUrl  = newUrl.trim();
    const trimName = newName.trim();
    if (!trimUrl || !trimName) return;
    const finalUrl = trimUrl.startsWith("http") ? trimUrl : "https://" + trimUrl;
    const updated  = [...customLinks, { url: finalUrl, name: trimName }];
    setCustomLinks(updated);
    setShowModal(false);
    setNewUrl("");
    setNewName("");
    await saveCustomLinks(updated);
  };

  const removeLink = async (idx: number) => {
    const updated = customLinks.filter((_, i) => i !== idx);
    setCustomLinks(updated);
    await saveCustomLinks(updated);
  };

  const previewDomain = (() => {
    const t = newUrl.trim();
    return t ? getDomain(t) : "";
  })();

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 overflow-visible" ref={ref}>

      {/* 바로가기 목록 */}
      {open && (
        <div
          className="relative overflow-hidden rounded-2xl px-2"
          style={{
            background: isDark ? "rgba(15,15,19,0.6)" : "rgba(248,248,250,0.6)",
          }}
        >
          {/* 상단 fade */}
          {!atTop && (
            <div
              className="absolute top-0 inset-x-0 h-10 pointer-events-none z-10"
              style={{ background: `linear-gradient(to bottom, ${isDark ? "#0F0F13" : "#F8F8FA"}, transparent)` }}
            />
          )}
          {/* 하단 fade */}
          {!atBottom && (
            <div
              className="absolute bottom-0 inset-x-0 h-10 pointer-events-none z-10"
              style={{ background: `linear-gradient(to top, ${isDark ? "#0F0F13" : "#F8F8FA"}, transparent)` }}
            />
          )}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex flex-col items-end gap-1.5 overflow-y-auto overflow-x-visible [&::-webkit-scrollbar]:hidden pt-2 pb-0.5 pl-2 pr-1.5 -mr-1.5"
            style={{ maxHeight: "260px", scrollbarWidth: "none" }}
          >
          {DEFAULT_SPEED_LINKS.map(({ name, href, Icon, letter }, index) => (
            <div
              key={href}
              className="flex items-center gap-2 animate-result-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <span className="bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-200 px-2.5 py-1 rounded-full shadow border border-slate-200 dark:border-zinc-700 whitespace-nowrap">
                {name}
              </span>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md hover:scale-110 active:scale-95 transition-transform duration-150 shrink-0"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {Icon ? <Icon className="w-[18px] h-[18px]" /> : <span className="text-sm font-bold leading-none">{letter}</span>}
              </a>
            </div>
          ))}
          {customLinks.map((link, i) => (
            <div
              key={link.url + i}
              className="group flex items-center gap-2 animate-result-in"
              style={{ animationDelay: `${(DEFAULT_SPEED_LINKS.length + i) * 30}ms` }}
            >
              <button
                onClick={() => removeLink(i)}
                className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] shadow opacity-0 group-hover:opacity-100 transition-opacity leading-none shrink-0"
              >
                ×
              </button>
              <span className="bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-200 px-2.5 py-1 rounded-full shadow border border-slate-200 dark:border-zinc-700 whitespace-nowrap">
                {link.name}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md hover:scale-110 active:scale-95 transition-transform duration-150 shrink-0"
                style={{ background: "transparent" }}
              >
                <FaviconImg domain={getDomain(link.url)} name={link.name} size={40} />
              </a>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* 추가 버튼 (스크롤 영역 밖) */}
      {open && (
        <div className="flex items-center gap-2">
          <span className="bg-white dark:bg-zinc-900 text-xs font-medium text-slate-500 dark:text-zinc-400 px-2.5 py-1 rounded-full shadow border border-slate-200 dark:border-zinc-700 whitespace-nowrap">
            {t("speeddial_add_label")}
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-zinc-600 hover:border-[#6C63FF] hover:bg-[#6C63FF]/5 bg-white/80 dark:bg-zinc-900/80 transition-all shadow-sm shrink-0"
          >
            <IconPlus className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
          </button>
        </div>
      )}

      {/* 커스텀 추가 모달 */}
      {showModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => { setShowModal(false); setNewUrl(""); setNewName(""); }}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">{t("speeddial_modal_title")}</h3>
            <div className="space-y-3">
              <input
                type="url"
                placeholder="https://example.com"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-500 focus:outline-none focus:border-[#6C63FF] transition-colors"
              />
              <input
                type="text"
                placeholder="내 회사 인트라넷"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addLink(); }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-500 focus:outline-none focus:border-[#6C63FF] transition-colors"
              />
            </div>
            {previewDomain && (
              <div className="mt-3 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800">
                <div className="shrink-0" style={{ width: 28, height: 28 }}>
                  <FaviconImg domain={previewDomain} name={newName || newUrl} size={28} />
                </div>
                <span className="text-xs text-slate-500 dark:text-zinc-400">{t("speeddial_icon_preview")}</span>
              </div>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowModal(false); setNewUrl(""); setNewName(""); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={addLink}
                disabled={!newUrl.trim() || !newName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {t("speeddial_add_label")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 메인 토글 버튼 */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={t("speeddial_ai_shortcut")}
        className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-all duration-150"
        style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
      >
        {open ? <IconX className="w-5 h-5" /> : <IconSparkles className="w-5 h-5" />}
      </button>
    </div>
  );
}
