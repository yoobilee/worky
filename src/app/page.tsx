"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  IconTable, IconMail, IconFileDescription, IconCalendarEvent,
  IconListCheck, IconBulb, IconWifi, IconWifiOff, IconArrowRight,
  IconCircleCheck, IconMessageDots, IconNotes, IconPlus, IconHistory,
  IconSun, IconCloud, IconCloudRain, IconCloudSnow, IconCloudStorm, IconMist, IconMapPin,
  IconTemperature, IconClock,
} from "@tabler/icons-react";

/* ───────── 상수 ───────── */

interface Todo { id: string; text: string; completed: boolean }

const DAY_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const TIPS = [
  "첫 보고서는 '결론 → 이유 → 근거' 순서로 작성하면 가독성이 높아집니다.",
  "업무 요청을 받으면 기한·우선순위·담당자를 반드시 확인하고 시작하세요.",
  "회의가 끝나면 24시간 안에 액션 아이템을 정리해 공유하면 신뢰를 얻을 수 있습니다.",
  "이메일은 보내기 전 수신자·참조·제목·첨부파일을 한 번 더 확인하는 습관을 들이세요.",
  "업무 중 막히는 부분은 30분 이상 혼자 고민하기 전에 선배에게 질문하세요.",
  "To-Do는 구체적인 액션 단위로 쪼개야 실행이 쉽습니다. '기획안 작성' 대신 '목차 초안 만들기'처럼요.",
  "상사에게 중간 보고를 자주 하면 방향이 틀렸을 때 수정 비용이 줄어듭니다.",
  "일주일 단위로 이번 주 배운 것 3가지를 기록하면 성장이 눈에 보입니다.",
  "슬랙·메일 알림은 집중 시간대에는 끄고, 정해진 시간에 일괄 확인하는 것이 효율적입니다.",
  "문서 저장 시 파일명에 날짜를 포함하면 나중에 찾기 훨씬 쉽습니다.",
  "모르는 용어나 프로세스는 그 자리에서 바로 메모하고 업무 후 정리하세요.",
  "동료의 업무 성과를 공개적으로 칭찬하는 습관은 팀 협업을 강화합니다.",
];

const QUICK_LINKS = [
  { href: "/data",     label: "데이터 정리", Icon: IconTable,          desc: "텍스트 → 표" },
  { href: "/todo",     label: "할 일 / 메모", Icon: IconListCheck,      desc: "할 일 관리" },
  { href: "/template", label: "템플릿 생성",  Icon: IconNotes,          desc: "문서 자동 작성" },
  { href: "/qa",       label: "Q&A",          Icon: IconMessageDots,    desc: "AI 업무 상담" },
  { href: "/email",    label: "이메일 작성",  Icon: IconMail,           desc: "답장 초안 생성" },
  { href: "/summary",  label: "문서 요약",    Icon: IconFileDescription, desc: "AI 핵심 요약" },
  { href: "/schedule", label: "일정 추출",    Icon: IconCalendarEvent,  desc: "날짜·장소 추출" },
];

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
  const [dateStr, setDateStr]   = useState("");
  const [todos, setTodos]       = useState<Todo[]>([]);
  const [tip, setTip]           = useState("");
  const [aiStatus, setAiStatus] = useState<"checking" | "connected" | "error">("checking");
  const [weather, setWeather]   = useState<WeatherInfo | null>(null);
  const [locationName, setLocationName] = useState("");
  const [geoStatus, setGeoStatus] = useState<"waiting" | "ok" | "denied">("waiting");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 실시간 시계
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setTime(`${hh}:${mm}:${ss}`);
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
    setTip(TIPS[date % TIPS.length]);

    // localStorage 할 일
    try {
      const saved = localStorage.getItem("worky_todos");
      if (saved) setTodos(JSON.parse(saved));
    } catch {}
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
    <div className="max-w-5xl mx-auto space-y-3">

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
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">{dateStr}</p>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              안녕하세요, 오늘도 잘 부탁드립니다.
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
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
            {QUICK_LINKS.map(({ href, label, Icon, desc }) => (
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

      {/* ── 하단 그리드 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* 최근 활동 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <IconHistory className="w-4 h-4 text-[#6C63FF]" />
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">최근 활동</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
              <IconHistory className="w-5 h-5 text-slate-300 dark:text-zinc-600" />
            </div>
            <p className="text-sm text-slate-400 dark:text-zinc-500">아직 활동 내역이 없습니다.</p>
            <p className="text-xs text-slate-300 dark:text-zinc-600 mt-1">기능을 사용하면 여기에 표시됩니다.</p>
          </div>
        </div>

        {/* 오늘의 팁 */}
        <div
          className="rounded-2xl p-4 shadow-sm flex flex-col gap-3"
          style={{ background: "linear-gradient(135deg, #6C63FF18, #8B85FF10)", border: "1px solid #6C63FF30" }}
        >
          <div className="flex items-center gap-2">
            <IconBulb className="w-4 h-4 text-[#6C63FF]" />
            <span className="text-sm font-semibold text-[#6C63FF]">오늘의 팁</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed flex-1">
            {tip || "오늘 하루도 차근차근 해나가면 됩니다."}
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">매일 새로운 팁이 표시됩니다.</p>
        </div>

      </div>
    </div>
  );
}
