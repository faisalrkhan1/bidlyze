// UI end-to-end tests for the Submission Check beta.
// Runs a local production build in real Chrome; Supabase is mocked inside the
// browser (tests/ui/mocks.mjs), so no production data is read or written.
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key npx next build
//   npx playwright test -c tests/ui/playwright.config.mjs
const config = {
  testDir: ".",
  testMatch: /.*\.spec\.mjs/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
    colorScheme: "dark",
  },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
};

export default config;
