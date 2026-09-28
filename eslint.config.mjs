import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: [".next/**", "node_modules/**", "public/sw.js", "public/workbox-*.js", "test-results/**", "playwright-report/**"] },
  ...compat.extends("next/core-web-vitals"),
];
