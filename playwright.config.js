// @ts-check
const { defineConfig } = require('@playwright/test');
require('dotenv').config();

/**
 * API-focused Playwright config for the SpotV guest sanity suite.
 * Browser projects are omitted — tests use the built-in request fixture.
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.BASE_URL || 'https://uat-api.vstv.videoready.tv',
    extraHTTPHeaders: {
      'user-agent':
        process.env.USER_AGENT ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      origin: process.env.ORIGIN || 'https://uat.spotvnow.com',
      referer: process.env.REFERER || 'https://uat.spotvnow.com/',
    },
    ignoreHTTPSErrors: false,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api-sanity',
      testMatch: /sanity\/.*\.spec\.js/,
    },
  ],
});
