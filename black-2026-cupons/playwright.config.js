import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: './tests/browser',
	fullyParallel: false,
	use: { baseURL: 'http://127.0.0.1:4175', channel: 'chrome', headless: true },
	webServer: {
		command: 'npm run dev -- --port 4175 --strictPort',
		port: 4175,
		reuseExistingServer: false,
		env: { VITE_LANDING_URL: 'https://example.com/black' },
	},
});
