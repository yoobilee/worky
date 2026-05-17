import type { Metadata } from "next";
import { DM_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Worky — AI 업무 보조",
  description: "신입사원을 위한 AI 기반 업무 보조 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`h-full ${dmMono.variable}`}>
      <body className="h-full text-slate-900 dark:text-slate-100">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
