const { defineConfig } = await import('@playwright/test');

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    viewport: { width: 1440, height: 900 },
    headless: true
  },
  projects: [
    {
      name: 'Desktop',
      use: { viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'Tablet',
      use: { viewport: { width: 768, height: 1024 } }
    },
    {
      name: 'Mobile',
      use: { viewport: { width: 375, height: 812 } }
    }
  ],
  webServer: {
    command: process.platform === 'win32'
      ? 'python -m http.server 4173'
      : 'python3 -m http.server 4173',
    port: 4173,
    cwd: '.',
    reuseExistingServer: true
  }
});
