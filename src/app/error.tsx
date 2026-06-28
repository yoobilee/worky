"use client";
import { useEffect } from "react";
import Link from "next/link";
import { IconAlertTriangle, IconRefresh, IconArrowLeft } from "@tabler/icons-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Worky 에러]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-50 dark:bg-red-950/30">
        <IconAlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-1">문제가 발생했습니다</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">잠시 후 다시 시도해 주세요.</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => reset()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition"
          style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
          <IconRefresh className="w-4 h-4" />다시 시도
        </button>
        <Link href="/"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
          <IconArrowLeft className="w-4 h-4" />홈으로
        </Link>
      </div>
    </div>
  );
}
