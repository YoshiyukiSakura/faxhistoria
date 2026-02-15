import { defineConfig } from '@playwright/test';
import { resolve } from 'path';

export default defineConfig({
  testDir: './src/__tests__/e2e',
  testMatch: '**/*.e2e.test.ts',
  timeout: 300_000, // AI calls on self-hosted instance can take 2-3 min
  retries: 0,
  workers: 1, // sequential — tests share DB state
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${process.env.PORT || 40010}`,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  webServer: {
    command: `tsx ${resolve(__dirname, 'src/index.ts')}`,
    port: Number(process.env.PORT) || 40010,
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      NODE_ENV: 'test',
    },
  },
});
