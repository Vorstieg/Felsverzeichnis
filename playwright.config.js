import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:4174',
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1 --port 4174',
		url: 'http://127.0.0.1:4174',
		reuseExistingServer: true,
		timeout: 120000
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
