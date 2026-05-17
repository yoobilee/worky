import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Worky — AI 업무 보조",
  description: "신입사원을 위한 AI 기반 업무 보조 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
