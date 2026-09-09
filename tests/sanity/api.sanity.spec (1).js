// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { buildRequestHeaders } = require('../../utils/headers');

const fixturePath = path.join(__dirname, '../../data/apis.json');

if (!fs.existsSync(fixturePath)) {
  throw new Error(
    `Missing ${fixturePath}. Run: npm run parse:chlz`
  );
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const apis = fixture.apis || [];

/**
 * Sanity: for each unique SUT API from Charles,
 * - replay method/path/query/body
 * - assert status matches captured expectedStatus
 * - if JSON response expected, body must parse
 */
test.describe('Guest user API sanity suite', () => {
  test.beforeAll(() => {
    if (!process.env.X_API_KEY) {
      console.warn(
        '[warn] X_API_KEY is not set. Copy .env.example to .env and set X_API_KEY.'
      );
    }
  });

  for (const api of apis) {
    const title = `${api.method} ${api.path} [expect ${api.expectedStatus}]`;

    test(title, async ({ request }) => {
      const headers = buildRequestHeaders(api.headers);
      const urlPath = api.query ? `${api.path}?${api.query}` : api.path;

      const options = {
        headers,
        failOnStatusCode: false,
      };

      if (api.body != null && !['GET', 'HEAD'].includes(api.method)) {
        if (typeof api.body === 'object') {
          options.data = api.body;
        } else {
          options.data = api.body;
        }
      }

      const response = await request.fetch(urlPath, {
        method: api.method,
        ...options,
      });

      expect(
        response.status(),
        `Unexpected status for ${api.method} ${urlPath}`
      ).toBe(api.expectedStatus);

      const contentType = response.headers()['content-type'] || '';
      const expectsJson =
        (api.responseMime || '').includes('json') ||
        contentType.includes('application/json');

      if (expectsJson && response.status() < 500) {
        const text = await response.text();
        if (text && text.trim().length > 0) {
          expect(() => JSON.parse(text), 'Response should be valid JSON').not.toThrow();
        }
      }
    });
  }
});
