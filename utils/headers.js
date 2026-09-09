require('dotenv').config();

/**
 * Builds request headers for sanity calls.
 * Secrets come from env — never commit real keys.
 */
function buildRequestHeaders(apiHeaders = {}) {
  const headers = { ...apiHeaders };

  const apiKey = process.env.X_API_KEY;
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const auth = process.env.AUTHORIZATION || 'Bearer null';
  headers.authorization = auth;

  if (!headers.accept) {
    headers.accept = 'application/json, text/plain, */*';
  }

  return headers;
}

function getBaseURL(fallback) {
  return process.env.BASE_URL || fallback || 'https://uat-api.vstv.videoready.tv';
}

module.exports = {
  buildRequestHeaders,
  getBaseURL,
};
