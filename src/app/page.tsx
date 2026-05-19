"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  IconTable, IconMail, IconFileDescription, IconCalendarEvent,
  IconListCheck, IconBulb, IconWifi, IconWifiOff, IconArrowRight,
  IconCircleCheck, IconMessageDots, IconNotes, IconPlus,
  IconSun, IconCloud, IconCloudRain, IconCloudSnow, IconCloudStorm, IconMist, IconMapPin,
  IconTemperature, IconClock, IconLanguage, IconChartBar, IconBook, IconCalendar,
  IconBuilding,
} from "@tabler/icons-react";
import {
  loadMenuSettings, isRouteEnabled, MENU_SETTINGS_EVENT, type MenuSettings,
} from "@/lib/menuSettings";
import { getThisWeekStats, type FeatureKey } from "@/lib/usageStats";
import { loadCalendarEvents, type CalendarEvent } from "@/lib/calendarStorage";

/* ───────── 상수 ───────── */

interface Todo { id: string; text: string; completed: boolean }

const DAY_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

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
  { href: "/insight",   label: "데이터 인사이트", Icon: IconChartBar,       desc: "수치 분석" },
  { href: "/glossary",  label: "용어집",         Icon: IconBook,           desc: "사내 용어 관리" },
  { href: "/calendar",  label: "일정 관리",      Icon: IconCalendar,       desc: "월별 일정 관리" },
  { href: "/clients",   label: "거래처 관리",    Icon: IconBuilding,       desc: "거래처 보고 관리" },
];

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

/* ───────── 날씨 ───────── */

interface WeatherInfo {
  temp: number;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function getWeatherFromCode(code: number): { label: string; Icon: React.ComponentType<{ className?: string }> } {
  if (code === 0 || code === 1) return { label: "맑음",    Icon: IconSun };
  if (code <= 3)                 return { label: "구름",    Icon: IconCloud };
  if (code <= 48)                return { label: "안개",    Icon: IconMist };
  if (code <= 55)                return { label: "이슬비",  Icon: IconCloudRain };
  if (code <= 67)                return { label: "비",      Icon: IconCloudRain };
  if (code <= 77)                return { label: "눈",      Icon: IconCloudSnow };
  if (code <= 82)                return { label: "소나기",  Icon: IconCloudRain };
  if (code <= 86)                return { label: "눈 소나기", Icon: IconCloudSnow };
  return                                { label: "뇌우",    Icon: IconCloudStorm };
}

/* ───────── 컴포넌트 ───────── */

export default function HomePage() {
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 실시간 시계 + 시간대별 인사말
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setTime(`${hh}:${mm}:${ss}`);
      setGreeting(getGreeting(now));
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
    const day   = DAY_KO[now.getDay()];
    setDateStr(`${now.getFullYear()}년 ${month}월 ${date}일 ${day}`);

    // 날짜 기반 팁 (하루 동안 고정)
    const todayTip = TIPS[date % TIPS.length];
    setTip(todayTip.text);
    setTipCategory(todayTip.category);

    // 이번 주 사용 통계
    setWeekStats(getThisWeekStats());

    // 다가오는 일정
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = loadCalendarEvents()
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
    setUpcomingEvents(upcoming);

    // localStorage 할 일
    try {
      const saved = localStorage.getItem("worky_todos");
      if (saved) setTodos(JSON.parse(saved));
    } catch {}

    // 메뉴 설정
    setMenuSettings(loadMenuSettings());
    const onMenuChange = () => setMenuSettings(loadMenuSettings());
    window.addEventListener(MENU_SETTINGS_EVENT, onMenuChange);
    return () => window.removeEventListener(MENU_SETTINGS_EVENT, onMenuChange);
  }, []);

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
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
            ),
            fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
              { headers: { "Accept-Language": "ko", "User-Agent": "Worky-App/1.0" } }
            ),
          ]);
          const [weatherData, geoData] = await Promise.all([weatherRes.json(), geoRes.json()]);

          // 날씨
          const cw = weatherData.current_weather;
          const { label, Icon } = getWeatherFromCode(cw.weathercode);
          setWeather({ temp: Math.round(cw.temperature), label, Icon });

          // 위치명: city → town → county → state 순 우선순위
          const addr = geoData.address ?? {};
          const city = addr.city || addr.town || addr.county || addr.state || "";
          setLocationName(city);
        } catch {}
      },
      () => setGeoStatus("denied")
    );
  }, []);

  // 할 일 통계
  const total     = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const progress  = total === 0 ? 0 : Math.round((completed / total) * 100);
  const preview   = todos.filter((t) => !t.completed).slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-3 flex-1 min-h-0 w-full">

      {/* ── 환영 카드 ── */}
      <div
        className="rounded-2xl border shadow-sm px-6 py-5"
        style={{
          background: "linear-gradient(135deg, #6C63FF18, #8B85FF08)",
          borderColor: "#6C63FF28",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* 왼쪽: 날짜·인사·현황 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-400 dark:text-zinc-500 tracking-wide">{dateStr}</p>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
              {greeting}
            </h2>
            <p className="text-base text-slate-500 dark:text-zinc-400">
              {total === 0
                ? "오늘의 할 일을 추가해보세요."
                : `할 일 ${total}개 중 ${completed}개 완료${completed === total ? " — 모두 완료!" : ""}`}
            </p>
          </div>

          {/* 오른쪽: 시계 + 날씨 */}
          <div className="flex items-center gap-5 shrink-0">
            {/* 날씨 */}
            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
              {geoStatus === "waiting" && (
                <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                  <IconMapPin className="w-3.5 h-3.5" /> 위치 확인 중...
                </span>
              )}
              {geoStatus === "denied" && (
                <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                  <IconMapPin className="w-3.5 h-3.5" /> 위치 정보 없음
                </span>
              )}
              {geoStatus === "ok" && weather && (
                <div className="flex flex-col items-center gap-1">
                  <weather.Icon className="w-6 h-6 text-[#6C63FF]" />
                  <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">{weather.label}</span>
                  <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                    {locationName && <><span>{locationName}</span><span className="opacity-40">·</span></>}
                    <span className="flex items-center gap-0.5">
                      <IconTemperature className="w-3 h-3" />{weather.temp}°C
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* 실시간 시계 */}
            <div className="flex flex-col items-center gap-1">
              <IconClock className="w-4 h-4 text-[#6C63FF]" />
              <span
                className="text-3xl text-slate-800 dark:text-slate-100 tracking-wider"
                style={{ fontFamily: "var(--font-dm-mono)", fontWeight: 500 }}
              >
                {time}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 메인 그리드 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* 할 일 진행률 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconListCheck className="w-4 h-4 text-[#6C63FF]" />
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">할 일 진행률</span>
            </div>
            <Link
              href="/todo"
              className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-[#6C63FF] transition-colors"
            >
              관리 <IconArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {total === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
              <p className="text-sm text-slate-400 dark:text-zinc-500">등록된 할 일이 없습니다.</p>
              <Link
                href="/todo"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                <IconPlus className="w-3.5 h-3.5" /> 할 일 추가하러 가기
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{progress}%</span>
                <span className="text-xs text-slate-400 dark:text-zinc-500 mb-1">{completed}/{total}건</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg, #6C63FF, #9C95FF)" }}
                />
              </div>

              {/* 미완료 미리보기 */}
              {preview.length > 0 && (
                <div className="mt-1 space-y-1.5">
                  {preview.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-600 shrink-0" />
                      <span className="truncate">{t.text}</span>
                    </div>
                  ))}
                  {todos.filter((t) => !t.completed).length > 3 && (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 pl-3.5">
                      외 {todos.filter((t) => !t.completed).length - 3}개 더
                    </p>
                  )}
                </div>
              )}
              {completed === total && total > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                  <IconCircleCheck className="w-3.5 h-3.5" /> 모든 할 일 완료!
                </div>
              )}
            </div>
          )}
        </div>

        {/* 빠른 접근 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm lg:col-span-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3">빠른 접근</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {QUICK_LINKS.filter(({ href }) => isRouteEnabled(menuSettings, href)).map(({ href, label, Icon, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-[#6C63FF]/50 hover:bg-[#6C63FF]/5 transition-all group"
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white"
                  style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate">{label}</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── 하단 그리드 (flex-1로 나머지 공간 채움) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 min-h-0">

        {/* 이번 주 활동 */}
        {(() => {
          const FEATURES: { key: FeatureKey; label: string }[] = [
            { key: "data",      label: "데이터 정리"   },
            { key: "email",     label: "이메일 작성"   },
            { key: "template",  label: "템플릿 생성"   },
            { key: "translate", label: "번역·다듬기"   },
            { key: "summary",   label: "문서 요약"     },
            { key: "schedule",  label: "일정 추출"     },
            { key: "insight",   label: "데이터 인사이트" },
            { key: "qa",        label: "Q&A"          },
          ];
          const counts = FEATURES.map((f) => weekStats[f.key] ?? 0);
          const maxCount = Math.max(...counts, 1);
          const totalUsed = counts.reduce((a, b) => a + b, 0);

          return (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconChartBar className="w-4 h-4 text-[#6C63FF]" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">이번 주 활동</span>
                </div>
                {totalUsed > 0 && (
                  <span className="text-xs text-slate-400 dark:text-zinc-500">총 {totalUsed}회</span>
                )}
              </div>

              {totalUsed === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                  <p className="text-sm text-slate-400 dark:text-zinc-500">이번 주 아직 사용 기록이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {FEATURES.map(({ key, label }, i) => {
                    const count  = counts[i];
                    const isMax  = count === maxCount && count > 0;
                    const pct    = Math.round((count / maxCount) * 100);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className={`text-xs w-[88px] shrink-0 truncate ${isMax ? "font-semibold text-[#6C63FF]" : "text-slate-500 dark:text-zinc-400"}`}>
                          {label}
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
              )}
            </div>
          );
        })()}

        {/* 다가오는 일정 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconCalendar className="w-4 h-4 text-[#6C63FF]" />
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">다가오는 일정</span>
            </div>
            <Link href="/calendar"
              className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-[#6C63FF] transition-colors">
              전체 <IconArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
              <p className="text-sm text-slate-400 dark:text-zinc-500">예정된 일정이 없습니다.</p>
              <Link href="/calendar"
                className="mt-2 text-xs text-[#6C63FF] hover:underline">
                일정 추가하러 가기
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map(ev => (
                <div key={ev.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{ev.title}</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{ev.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) => `${Number(m)}/${Number(d)}`)}</span>
                      {ev.time && <><span className="opacity-40">·</span><span>{ev.time}</span></>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오늘의 팁 */}
        <div
          className="rounded-2xl p-5 shadow-sm flex flex-col"
          style={{ background: "linear-gradient(135deg, #6C63FF18, #8B85FF10)", border: "1px solid #6C63FF30" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <IconBulb className="w-4 h-4 text-[#6C63FF]" />
            <span className="text-sm font-semibold text-[#6C63FF]">오늘의 팁</span>
          </div>
          <p className="text-base leading-7 text-slate-700 dark:text-zinc-300 flex-1">
            {tip || "오늘 하루도 차근차근 해나가면 됩니다."}
          </p>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#6C63FF20]">
            {tipCategory && (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: "#6C63FF22", color: "#6C63FF" }}
              >
                {tipCategory}
              </span>
            )}
            <p className="text-xs text-slate-400 dark:text-zinc-500 ml-auto">매일 새로운 팁</p>
          </div>
        </div>

      </div>
    </div>
  );
}
