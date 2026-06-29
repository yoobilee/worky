"use client";

import { useState } from "react";
import {
  IconX, IconArrowRight, IconCheck,
  IconBriefcase, IconCode, IconBuildingSkyscraper,
  IconFileText, IconPalette, IconApps,
} from "@tabler/icons-react";
import DatePickerInput from "./DatePickerInput";
import { upsertSettings } from "@/lib/db/settings";
import { saveMenuSettings, OPTIONAL_MENU_ITEMS, type MenuSettings } from "@/lib/menuSettings";
import { useToast } from "@/contexts/ToastContext";

const DISMISSED_KEY = "worky_onboarding_dismissed";
const ALL_OPTIONAL_HREFS = OPTIONAL_MENU_ITEMS.map((i) => i.href);

interface SenderInfo { org: string; name: string; title: string }

const JOB_PRESETS = [
  { id: "marketing", label: "마케팅/영업",   icon: IconBriefcase,        desc: "영업·고객 관리 중심",    on: ["/content", "/clients", "/template", "/summary", "/feedback"] },
  { id: "it",        label: "IT직군",        icon: IconCode,             desc: "개발자, QA, 기획자 등",  on: ["/data", "/insight", "/translate", "/summary", "/template", "/glossary"] },
  { id: "admin",     label: "경영지원/총무", icon: IconBuildingSkyscraper, desc: "문서·일정 관리 중심",    on: ["/summary", "/template", "/translate", "/data", "/document", "/feedback"] },
  { id: "office",    label: "사무직",        icon: IconFileText,         desc: "일반 사무 업무",          on: ["/summary", "/template", "/translate", "/glossary", "/data"] },
  { id: "designer",  label: "디자이너",      icon: IconPalette,          desc: "크리에이티브 직군",       on: ["/translate", "/glossary", "/template", "/summary", "/feedback"] },
  { id: "other",     label: "기타",          icon: IconApps,             desc: "전체 기능 사용",          on: null as string[] | null },
] as const;

interface Props {
  userId: string;
  onClose: () => void;
}

export default function OnboardingModal({ userId, onClose }: Props) {
  const toast = useToast();
  const [step, setStep]           = useState(0); // 0,1,2
  const [info, setInfo]           = useState<SenderInfo>({ org: "", name: "", title: "" });
  const [jobPresetId, setJobPresetId] = useState<string | null>(null);
  const [joinDate, setJoinDate]   = useState("");

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    onClose();
  };

  const handleComplete = async () => {
    const payload: Record<string, unknown> = {};

    // sender_info: 하나라도 입력된 경우만
    if (info.org.trim() || info.name.trim() || info.title.trim()) {
      payload.sender_info = {
        org:   info.org.trim(),
        name:  info.name.trim(),
        title: info.title.trim(),
      };
    }

    // job_preset + menu_settings
    if (jobPresetId) {
      const preset = JOB_PRESETS.find((p) => p.id === jobPresetId);
      if (preset) {
        const menuSettings: MenuSettings = Object.fromEntries(
          ALL_OPTIONAL_HREFS.map((href) => [
            href,
            preset.on === null ? true : (preset.on as string[]).includes(href),
          ])
        );
        saveMenuSettings(menuSettings);
        payload.job_preset    = jobPresetId;
        payload.menu_settings = menuSettings;
      }
    }

    // join_date: 입력된 경우만
    if (joinDate) {
      payload.join_date = joinDate;
    }

    // 하나라도 있을 때만 저장
    if (Object.keys(payload).length > 0) {
      await upsertSettings(userId, payload as Parameters<typeof upsertSettings>[1])
        .catch(() => toast.error("저장에 실패했습니다. 설정 페이지에서 다시 입력해 주세요."));
    }

    localStorage.setItem(DISMISSED_KEY, "true");
    onClose();
  };

  const TOTAL = 3;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/25 px-4">
      <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 shadow-2xl w-full max-w-md overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <p className="text-xs font-medium text-[#4D44CC] dark:text-[#8B85FF] mb-0.5">Worky 시작하기</p>
            <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100">
              {step === 0 && "내 정보를 입력해 주세요"}
              {step === 1 && "직업군을 선택해 주세요"}
              {step === 2 && "입사일을 입력해 주세요"}
            </h2>
          </div>
          <button onClick={dismiss} aria-label="닫기" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* 진행 dot */}
        <div className="flex items-center gap-1.5 px-6 pb-4">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div
              key={i}
              className={[
                "h-1.5 rounded-full transition-all duration-300",
                i === step
                  ? "w-6 bg-[#6C63FF]"
                  : i < step
                  ? "w-3 bg-[#6C63FF]/40"
                  : "w-3 bg-slate-200 dark:bg-zinc-700",
              ].join(" ")}
            />
          ))}
        </div>

        {/* 본문 */}
        <div className="px-6 pb-2 min-h-[220px]">

          {/* 1단계: 내 정보 */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-zinc-400">이메일·템플릿 서명에 자동으로 사용됩니다. 선택 사항입니다.</p>
              {(["org", "name", "title"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                    {field === "org" ? "소속 (회사/부서)" : field === "name" ? "이름" : "직급"}
                  </label>
                  <input
                    value={info[field]}
                    onChange={(e) => setInfo((prev) => ({ ...prev, [field]: e.target.value }))}
                    placeholder={field === "org" ? "(주)워키" : field === "name" ? "홍길동" : "사원"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 2단계: 직업군 */}
          {step === 1 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">직업군에 맞는 메뉴가 자동으로 설정됩니다. 선택 사항입니다.</p>
              <div className="grid grid-cols-2 gap-2">
                {JOB_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const active = jobPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setJobPresetId(active ? null : preset.id)}
                      className={[
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                        active
                          ? "border-[#6C63FF] bg-[#6C63FF]/8 dark:bg-[#6C63FF]/15"
                          : "border-slate-200 dark:border-zinc-700 hover:border-[#6C63FF]/40",
                      ].join(" ")}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#4D44CC] dark:text-[#8B85FF]" : "text-slate-500 dark:text-zinc-400"}`} />
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${active ? "text-[#4D44CC] dark:text-[#8B85FF]" : "text-slate-700 dark:text-zinc-300"}`}>{preset.label}</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">{preset.desc}</p>
                      </div>
                      {active && <IconCheck className="w-3.5 h-3.5 text-[#4D44CC] dark:text-[#8B85FF] shrink-0 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3단계: 입사일 */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-zinc-400">입사일을 입력하면 잔여 연차를 자동으로 계산합니다. 선택 사항입니다.</p>
              <DatePickerInput value={joinDate} onChange={setJoinDate} />
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex items-center justify-between px-6 py-5">
          <button
            onClick={dismiss}
            className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
          >
            건너뛰기
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                이전
              </button>
            )}
            {step < TOTAL - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                다음 <IconArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                <IconCheck className="w-3.5 h-3.5" /> 완료
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
