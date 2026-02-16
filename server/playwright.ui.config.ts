import { defineConfig } from '@playwright/test';
import { resolve } from 'path';

const serverPort = Number(process.env.PORT) || 40010;
const clientPort = Number(process.env.CLIENT_PORT) || 40011;

export default defineConfig({
  testDir: './src/__tests__/ui',
  testMatch: '**/*.ui.e2e.test.ts',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${clientPort}`,
    viewport: {
      width: 1536,
      height: 960,
    },
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `tsx ${resolve(__dirname, 'src/index.ts')}`,
      port: serverPort,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      command: 'npm run dev --prefix ../client -- --strictPort --port 40011',
      port: clientPort,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
