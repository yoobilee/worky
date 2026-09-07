import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

if (process.env.WORKY_LOCAL_SECURITY_E2E !== '1' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:55321') {
  throw new Error('Run through the isolated local security E2E runner.');
}

export default defineConfig({
  ...baseConfig,
  testIgnore: undefined,
  testMatch: ['**/guest-smoke.spec.ts', '**/*-crud.spec.ts'],
  workers: 1,
  timeout: 120_000,
  reporter: './supabase/tests/e2e-stack/safe-reporter.cjs',
  use: { ...baseConfig.use, trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    ...baseConfig.webServer,
    command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000',
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
