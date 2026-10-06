import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4174', channel: 'chrome', headless: true },
  webServer: {
    command: 'npm run dev -- --port 4174 --strictPort', port: 4174, reuseExistingServer: false,
    env: { VITE_LEADS_ENDPOINT: '/api/leads', VITE_RESOLVE_ENDPOINT: '/api/resolve', VITE_PRIVACY_URL: 'https://example.com/privacy', VITE_LEGAL_VERSION: 'test-v1' },
  },
});
