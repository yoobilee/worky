import fs from "fs/promises";
import path from "path";
import type { Browser } from "puppeteer-core";

const FONT_WEIGHTS: { file: string; weight: number }[] = [
  { file: "Pretendard-Regular.woff2", weight: 400 },
  { file: "Pretendard-Bold.woff2", weight: 700 },
];

async function readBuiltCss(): Promise<string> {
  try {
    const cssDir = path.join(process.cwd(), ".next", "static", "css");
    const files = await fs.readdir(cssDir);
    const cssFiles = files.filter((f) => f.endsWith(".css"));
    const contents = await Promise.all(
      cssFiles.map((f) => fs.readFile(path.join(cssDir, f), "utf-8"))
    );
    return contents.join("\n");
  } catch (e) {
    console.warn("[renderHtmlToPdf] 빌드된 CSS를 찾지 못했습니다:", e);
    return "";
  }
}

async function readFontFaceCss(): Promise<string> {
  const fontDir = path.join(
    process.cwd(),
    "node_modules",
    "pretendard",
    "dist",
    "web",
    "static",
    "woff2"
  );

  try {
    const faces = await Promise.all(
      FONT_WEIGHTS.map(async ({ file, weight }) => {
        const buf = await fs.readFile(path.join(fontDir, file));
        const base64 = buf.toString("base64");
        return `@font-face {
  font-family: 'Pretendard';
  font-weight: ${weight};
  font-style: normal;
  font-display: block;
  src: url(data:font/woff2;base64,${base64}) format('woff2');
}`;
      })
    );
    return faces.join("\n");
  } catch (e) {
    console.warn("[renderHtmlToPdf] Pretendard 폰트를 찾지 못했습니다:", e);
    return "";
  }
}

function buildFullHtml(contentHtml: string, css: string, fontFace: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<style>${fontFace}</style>
<style>${css}</style>
<style>
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { padding: 24px; font-family: 'Pretendard', -apple-system, sans-serif; background: #ffffff; }
</style>
</head>
<body>${contentHtml}</body>
</html>`;
}

export async function renderHtmlToPdf(contentHtml: string): Promise<Buffer> {
  const isDev = process.env.NODE_ENV === "development";

  const [css, fontFace] = await Promise.all([readBuiltCss(), readFontFaceCss()]);
  const fullHtml = buildFullHtml(contentHtml, css, fontFace);

  let browser: Browser | undefined;
  try {
    if (isDev) {
      const { default: puppeteer } = await import("puppeteer");
      browser = (await puppeteer.launch()) as unknown as Browser;
    } else {
      const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
        import("@sparticuz/chromium"),
        import("puppeteer-core"),
      ]);

      browser = await puppeteerCore.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
      });
    }

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);

    const pdfUint8 = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });

    return Buffer.from(pdfUint8);
  } catch (error) {
    console.error("[renderHtmlToPdf] PDF 생성 오류:", error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}
