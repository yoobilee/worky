"use client";
import Link from "next/link";
import { IconMapPinOff, IconArrowLeft } from "@tabler/icons-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
        <IconMapPinOff className="w-8 h-8 text-white" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-1">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-slate-400 dark:text-zinc-500">주소가 변경되었거나 삭제된 페이지일 수 있어요.</p>
      </div>
      <Link href="/"
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition"
        style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
        <IconArrowLeft className="w-4 h-4" />홈으로 가기
      </Link>
    </div>
  );
}
