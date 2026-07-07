"use client";

import { useState, useEffect, useRef, useContext } from "react";
import { createPortal } from "react-dom";
import { IconQuestionMark, IconX } from "@tabler/icons-react";
import { loadHelpButtonEnabled, HELP_BUTTON_EVENT } from "@/lib/menuSettings";
import { HelpSlotContext } from "./AppShell";

export interface HelpStep { step: string; desc: string; }

interface Props { title: string; steps: HelpStep[]; }

export default function HelpButton({ title, steps }: Props) {
  const [open,    setOpen]    = useState(false);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const slotNode = useContext(HelpSlotContext);

  useEffect(() => {
    setVisible(loadHelpButtonEnabled());
    const handler = () => setVisible(loadHelpButtonEnabled());
    window.addEventListener(HELP_BUTTON_EVENT, handler);
    return () => window.removeEventListener(HELP_BUTTON_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!visible) return null;

  if (slotNode) {
    return createPortal(
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="도움말"
          className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm hover:scale-110 active:scale-95 transition-transform duration-150"
          style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
        >
          <IconQuestionMark className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl p-5 z-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{title}</h3>
              <button onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">{s.step}</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>,
      slotNode
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end" ref={ref}>
      {open && (
        <div className="mb-3 w-72 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{title}</h3>
            <button onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
              <IconX className="w-4 h-4" />
            </button>
          </div>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#6C63FF]/10 text-[#4D44CC] dark:text-[#8B85FF] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">{s.step}</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="도움말"
        className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-transform duration-150"
        style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
      >
        <IconQuestionMark className="w-5 h-5" />
      </button>
    </div>
  );
}
