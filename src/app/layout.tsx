import type { Metadata } from "next";
import { DM_Mono, Nunito } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/contexts/ToastContext";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";

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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6C63FF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Worky" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="h-full text-slate-900 dark:text-slate-100">
        <ThemeProvider>
          <LocaleProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
