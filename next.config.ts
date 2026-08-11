import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
  outputFileTracingIncludes: {
    "/api/export-pdf": [
      "./.next/static/css/**/*.css",
      "./node_modules/pretendard/dist/web/static/woff2/*.woff2",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

module.exports = withPWA(nextConfig);
