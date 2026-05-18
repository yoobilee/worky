"use client";

import { useState, useEffect } from "react";
import {
  IconUser, IconDeviceFloppy, IconCheck, IconChevronDown, IconChevronUp,
} from "@tabler/icons-react";

const SENDER_KEY = "worky_sender_info";

interface SenderInfo {
  org:   string;
  name:  string;
  title: string;
}

export default function SettingsPage() {
  const [info, setInfo]         = useState<SenderInfo>({ org: "", name: "", title: "" });
  const [collapsed, setCollapsed] = useState(false);
  const [saved, setSaved]       = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SENDER_KEY);
      if (raw) {
        const parsed: SenderInfo = JSON.parse(raw);
        setInfo(parsed);
        // 저장된 정보가 있으면 접힌 상태로 시작
        if (parsed.org || parsed.name || parsed.title) setCollapsed(true);
      }
    } catch {}
    setHydrated(true);
  }, []);

  const handleChange = (field: keyof SenderInfo, value: string) => {
    setInfo((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(SENDER_KEY, JSON.stringify(info));
    setSaved(true);
    if (info.org || info.name || info.title) setCollapsed(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!hydrated) return null;

  const hasSender = info.org || info.name || info.title;
  const summary = hasSender
    ? [info.org, info.name, info.title].filter(Boolean).join(" · ")
    : "미입력";

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

        {/* 헤더 (항상 표시) */}
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

        {/* 입력 영역 */}
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

            {/* 서명 미리보기 */}
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

    </div>
  );
}
