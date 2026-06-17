import type { Metadata } from "next";
import { DM_Mono, Nunito } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/contexts/ToastContext";

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
});

const nunito = Nunito({
  weight: ["800"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Worky — AI 업무 보조",
  description: "신입사원을 위한 AI 기반 업무 보조 도구",
  icons: { icon: "/favicon.svg" },
};

// 페이지 렌더 전 다크모드 클래스 주입 — FOUC(깜빡임) 방지
const themeInitScript = `
(function(){
  var s=localStorage.getItem('worky-theme');
  if(s==='dark'||(s===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`h-full ${dmMono.variable} ${nunito.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full text-slate-900 dark:text-slate-100">
        <ThemeProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
