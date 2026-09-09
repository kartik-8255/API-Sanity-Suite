/**
 * Parses a Charles .chlz export into sanitized API fixtures for the sanity suite.
 *
 * Usage:
 *   node scripts/parse-chlz.js [path-to.chlz]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CHLZ = path.join(ROOT, 'data', 'Guest_user_spotv_filtered.chlz');
const OUT_FILE = path.join(ROOT, 'data', 'apis.json');

const SKIP_HEADER_NAMES = new Set([
  'content-length',
  'accept-encoding',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'priority',
]);

const SECRET_HEADER_NAMES = new Set(['x-api-key', 'authorization', 'cookie', 'set-cookie']);

function extractZip(chlzPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  // PowerShell Expand-Archive rejects .chlz; use .NET ZipFile
  const ps = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem;
    [System.IO.Compression.ZipFile]::ExtractToDirectory('${chlzPath.replace(/'/g, "''")}', '${destDir.replace(/'/g, "''")}')
  `;
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
}

function getHeader(headers, name) {
  const found = (headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : null;
}

function buildHeaders(rawHeaders) {
  const headers = {};
  for (const h of rawHeaders || []) {
    if (!h.name || h.name.startsWith(':')) continue;
    const lower = h.name.toLowerCase();
    if (SKIP_HEADER_NAMES.has(lower)) continue;
    if (SECRET_HEADER_NAMES.has(lower)) continue;
    headers[h.name] = h.value;
  }
  return headers;
}

function parseMeta(dir, metaFile) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, metaFile), 'utf8'));
  if (!meta.method || meta.method === 'OPTIONS') return null;
  if (meta.status && meta.status !== 'COMPLETE') return null;

  const scheme = meta.scheme || 'https';
  const host = meta.host;
  const reqHeaders = meta.request?.header?.headers || [];
  const fullPath = getHeader(reqHeaders, ':path') || meta.path || '/';
  const pathOnly = fullPath.split('?')[0];
  const query = fullPath.includes('?') ? fullPath.slice(fullPath.indexOf('?') + 1) : null;

  let body = null;
  if (meta.request?.bodyFile) {
    const bodyPath = path.join(dir, meta.request.bodyFile);
    if (fs.existsSync(bodyPath)) {
      const raw = fs.readFileSync(bodyPath, 'utf8');
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
  }

  return {
    id: metaFile.replace('-meta.json', ''),
    name: `${meta.method} ${pathOnly}`,
    method: meta.method,
    host,
    path: pathOnly,
    query,
    url: `${scheme}://${host}${fullPath}`,
    expectedStatus: meta.response?.status ?? null,
    headers: buildHeaders(reqHeaders),
    body,
    requestMime: meta.request?.mimeType || null,
    responseMime: meta.response?.mimeType || null,
  };
}

function main() {
  const chlzPath = path.resolve(process.argv[2] || DEFAULT_CHLZ);
  if (!fs.existsSync(chlzPath)) {
    console.error(`Charles export not found: ${chlzPath}`);
    process.exit(1);
  }

  const extractDir = path.join(ROOT, 'data', '_chlz_extract');
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }

  console.log(`Extracting ${chlzPath} ...`);
  extractZip(chlzPath, extractDir);

  const metaFiles = fs
    .readdirSync(extractDir)
    .filter((f) => f.endsWith('-meta.json'))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const seen = new Set();
  const apis = [];

  for (const metaFile of metaFiles) {
    const api = parseMeta(extractDir, metaFile);
    if (!api) continue;
    const dedupeKey = `${api.method} ${api.host}${api.path}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    apis.push(api);
  }

  const payload = {
    source: path.basename(chlzPath),
    generatedAt: new Date().toISOString(),
    baseURL: apis[0] ? `https://${apis[0].host}` : null,
    count: apis.length,
    apis,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${apis.length} unique APIs -> ${OUT_FILE}`);

  // Cleanup extract (keep only fixtures)
  fs.rmSync(extractDir, { recursive: true, force: true });
}

main();
