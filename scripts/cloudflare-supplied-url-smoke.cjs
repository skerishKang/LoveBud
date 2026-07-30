const { chromium } = require('playwright');
const crypto = require('node:crypto');

const ROUTE_OPERATIONS = {
  '/': 'ROUTE_HOME',
  '/intro': 'ROUTE_INTRO',
  '/search': 'ROUTE_BROWSE',
  '/my-trees': 'ROUTE_MY_TREES',
  '/editor': 'ROUTE_EDITOR',
  '/settings': 'ROUTE_SETTINGS',
  '/tree': 'ROUTE_PUBLIC_VIEWER',
  '/detail': 'ROUTE_DETAIL',
  '/login': 'ROUTE_LOGIN',
};

const STATIC_OPERATIONS = {
  '/css/global.css': { code: 'STATIC_GLOBAL_CSS', expectedContentType: 'text/css' },
  '/js/index.js': { code: 'STATIC_HOME_ENTRY', expectedContentType: ['application/javascript', 'text/javascript'] },
  '/js/search/index.js': { code: 'STATIC_BROWSE_ENTRY', expectedContentType: ['application/javascript', 'text/javascript'] },
  '/js/editor.js': { code: 'STATIC_EDITOR_ENTRY', expectedContentType: ['application/javascript', 'text/javascript'] },
  '/js/viewer/tree-viewer.js': { code: 'STATIC_VIEWER_ENTRY', expectedContentType: ['application/javascript', 'text/javascript'] },
};

const BROWSER_ROUTES = ['/', '/intro', '/search'];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

const FORBIDDEN_MANIFEST_KEYS = [
  'timestamp', 'branch', 'actor', 'email', 'environment',
  'deployment_id', 'request_id', 'account_id', 'project_id',
  'provider_url', 'secret', 'token',
];

function bucketLatency(ms) {
  if (ms < 250) return 'LT_250_MS';
  if (ms < 1000) return '250_TO_999_MS';
  if (ms < 3000) return '1_TO_2_999_S';
  if (ms < 10000) return '3_TO_9_999_S';
  return 'GE_10_S';
}

function classifyContentType(contentType) {
  if (!contentType) return 'NOT_MEASURED';
  const lc = contentType.toLowerCase();
  if (lc.includes('application/json')) return 'JSON';
  if (lc.includes('text/css')) return 'CSS';
  if (lc.includes('javascript')) return 'JAVASCRIPT';
  if (lc.includes('text/html')) return 'HTML';
  return 'OTHER';
}

function makeOperation(operationCode, fields) {
  return {
    operation_code: operationCode,
    expectation_class: fields.expectationClass || 'EXPECTED_SUCCESS',
    status_class: fields.statusClass || 'UNKNOWN',
    sanitized_error_code: fields.errorCode || 'NONE',
    severity: fields.severity || 'INFO',
    latency_bucket: fields.latencyBucket || 'NOT_MEASURED',
    http_status: fields.httpStatus != null ? fields.httpStatus : null,
    content_type_class: fields.contentTypeClass || 'NOT_MEASURED',
    viewport: fields.viewport || 'NOT_APPLICABLE',
    body_present: fields.bodyPresent != null ? fields.bodyPresent : null,
    horizontal_overflow_px: fields.horizontalOverflow != null ? fields.horizontalOverflow : null,
    error_count: fields.errorCount != null ? fields.errorCount : null,
  };
}

function usage(message) {
  console.error(message || 'Usage: SMOKE_BASE_URL=<url> SMOKE_EXPECTED_SHA=<40-char-hex> npm run smoke:cloudflare');
}

function isIgnoredExternalError(text) {
  const value = String(text || '');
  return value.includes('ytimg.com') || value.includes('img.youtube.com');
}

function isNetworkBlocker(url, status) {
  if (status < 400) return false;
  if (/ytimg\.com|img\.youtube\.com/.test(url)) return false;
  if (/favicon\.(ico|png|svg)$/.test(url)) return false;
  return true;
}

function parseInputs() {
  const rawUrl = (process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
  if (!rawUrl) {
    usage('SMOKE_BASE_URL is required');
    return { error: 'SMOKE_BASE_URL_REQUIRED' };
  }

  let baseUrl;
  try {
    baseUrl = new URL(rawUrl);
    if (!['https:', 'http:'].includes(baseUrl.protocol)) throw new Error();
  } catch {
    usage('SMOKE_BASE_URL must be a valid http or https URL');
    return { error: 'SMOKE_BASE_URL_INVALID' };
  }

  const expectedSha = process.env.SMOKE_EXPECTED_SHA || '';
  if (!expectedSha) {
    console.error('SMOKE_EXPECTED_SHA is required (40-character lowercase hex SHA)');
    return { error: 'SMOKE_EXPECTED_SHA_REQUIRED' };
  }
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
    console.error('SMOKE_EXPECTED_SHA must be exactly 40 lowercase hexadecimal characters');
    return { error: 'SMOKE_EXPECTED_SHA_INVALID' };
  }

  let timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 30000);
  if (Number.isNaN(timeoutMs) || timeoutMs < 0) {
    console.error('SMOKE_TIMEOUT_MS must be a non-negative number');
    return { error: 'SMOKE_TIMEOUT_MS_INVALID' };
  }
  if (timeoutMs > 60000) {
    timeoutMs = 60000;
  }
  if (timeoutMs === 0) {
    timeoutMs = 30000;
  }

  return { baseUrl: baseUrl.origin, expectedSha, timeoutMs };
}

async function fetchWithTiming(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    const elapsed = Date.now() - start;
    clearTimeout(timer);
    return { response, latencyMs: elapsed };
  } catch (err) {
    const elapsed = Date.now() - start;
    clearTimeout(timer);
    return { error: err, latencyMs: elapsed };
  }
}

async function checkManifest(baseUrl, expectedSha, timeoutMs) {
  const manifestPath = '/.well-known/release.json';
  const nonce1 = crypto.randomUUID();
  const nonce2 = crypto.randomUUID();

  const url1 = baseUrl + manifestPath + '?_=' + nonce1;
  const url2 = baseUrl + manifestPath + '?_=' + nonce2;

  const [r1, r2] = await Promise.all([
    fetchWithTiming(url1, timeoutMs),
    fetchWithTiming(url2, timeoutMs),
  ]);

  async function extractResult(fetchResult) {
    if (fetchResult.error) {
      const errMsg = fetchResult.error.message || '';
      if (errMsg.includes('abort') || errMsg.includes('timeout')) {
        return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_TIMEOUT', severity: 'ERROR', httpStatus: null, contentTypeClass: null, latencyBucket: 'TIMEOUT_OR_UNKNOWN' };
      }
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_NETWORK_ERROR', severity: 'ERROR', httpStatus: null, contentTypeClass: null, latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }
    const res = fetchResult.response;
    if (res.status !== 200) {
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_HTTP_STATUS', severity: 'ERROR', httpStatus: res.status, contentTypeClass: classifyContentType(res.headers.get('content-type')), latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_CONTENT_TYPE', severity: 'ERROR', httpStatus: res.status, contentTypeClass: classifyContentType(ct), latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }
    const cc = res.headers.get('cache-control') || '';
    if (!cc.includes('no-store') && !cc.includes('no-cache')) {
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_CACHE_POLICY', severity: 'ERROR', httpStatus: res.status, contentTypeClass: 'JSON', latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }

    let body;
    try {
      body = await res.text();
    } catch {
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_BODY_READ_ERROR', severity: 'ERROR', httpStatus: res.status, contentTypeClass: 'JSON', latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_PARSE_ERROR', severity: 'ERROR', httpStatus: res.status, contentTypeClass: 'JSON', latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }

    const keys = Object.keys(parsed).sort();
    if (keys.length !== 2 || keys[0] !== 'contract_version' || keys[1] !== 'release_sha') {
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_SCHEMA_KEYS', severity: 'ERROR', httpStatus: res.status, contentTypeClass: 'JSON', latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }

    if (typeof parsed.contract_version !== 'string' || parsed.contract_version !== '1') {
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_CONTRACT_VERSION', severity: 'ERROR', httpStatus: res.status, contentTypeClass: 'JSON', latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }

    if (typeof parsed.release_sha !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.release_sha)) {
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_SHA_FORMAT', severity: 'ERROR', httpStatus: res.status, contentTypeClass: 'JSON', latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }

    const forbiddenKey = keys.find((k) => FORBIDDEN_MANIFEST_KEYS.includes(k));
    if (forbiddenKey) {
      return { statusClass: 'FAILED', errorCode: 'LB_MANIFEST_FORBIDDEN_KEY', severity: 'ERROR', httpStatus: res.status, contentTypeClass: 'JSON', latencyBucket: bucketLatency(fetchResult.latencyMs) };
    }

    return {
      statusClass: 'HEALTHY',
      errorCode: 'NONE',
      severity: 'INFO',
      httpStatus: res.status,
      contentTypeClass: 'JSON',
      latencyBucket: bucketLatency(fetchResult.latencyMs),
      parsed,
    };
  }

  const result1 = await extractResult(r1);
  const result2 = await extractResult(r2);

  const worstLatencyMs = Math.max(r1.latencyMs, r2.latencyMs);

  if (result1.statusClass === 'FAILED' || result2.statusClass === 'FAILED') {
    return {
      releaseMatchState: 'UNKNOWN',
      statusClass: 'FAILED',
      sanitizedErrorCode: result1.statusClass === 'FAILED' ? result1.errorCode : result2.errorCode,
      severity: 'ERROR',
      latencyBucket: bucketLatency(worstLatencyMs),
      observedSha: null,
      isHealthy: false,
    };
  }

  if (JSON.stringify(result1.parsed) !== JSON.stringify(result2.parsed)) {
    return {
      releaseMatchState: 'MISMATCH',
      statusClass: 'FAILED',
      sanitizedErrorCode: 'LB_MANIFEST_NONCE_INCONSISTENCY',
      severity: 'ERROR',
      latencyBucket: bucketLatency(worstLatencyMs),
      observedSha: result1.parsed.release_sha,
      isHealthy: false,
    };
  }

  const observedSha = result1.parsed.release_sha;
  if (observedSha !== expectedSha) {
    return {
      releaseMatchState: 'MISMATCH',
      statusClass: 'FAILED',
      sanitizedErrorCode: 'LB_MANIFEST_SHA_MISMATCH',
      severity: 'ERROR',
      latencyBucket: bucketLatency(worstLatencyMs),
      observedSha,
      isHealthy: false,
    };
  }

  return {
    releaseMatchState: 'MATCH',
    statusClass: 'HEALTHY',
    sanitizedErrorCode: 'NONE',
    severity: 'INFO',
    latencyBucket: bucketLatency(worstLatencyMs),
    observedSha,
    isHealthy: true,
  };
}

async function checkRoute(url, path, timeoutMs) {
  const fetchResult = await fetchWithTiming(url + path, timeoutMs);
  if (fetchResult.error) {
    const errMsg = fetchResult.error.message || '';
    const errorCode = errMsg.includes('abort') || errMsg.includes('timeout') ? 'LB_ROUTE_RESPONSE_TIMEOUT' : 'LB_ROUTE_RESPONSE_NETWORK';
    return makeOperation(ROUTE_OPERATIONS[path], {
      statusClass: 'FAILED', errorCode, severity: 'ERROR', latencyBucket: 'TIMEOUT_OR_UNKNOWN',
      bodyPresent: false, httpStatus: null,
    });
  }

  const res = fetchResult.response;
  const status = res.status;
  const ct = res.headers.get('content-type') || '';
  const latencyBucket = bucketLatency(fetchResult.latencyMs);

  let bodyText;
  try {
    bodyText = await res.text();
  } catch {
    return makeOperation(ROUTE_OPERATIONS[path], {
      statusClass: 'FAILED', errorCode: 'LB_ROUTE_RESPONSE_NETWORK', severity: 'ERROR',
      latencyBucket, httpStatus: status, contentTypeClass: classifyContentType(ct),
      bodyPresent: false,
    });
  }

  const bodyPresent = bodyText.length > 0;
  const hasBodyElement = bodyPresent;
  const is2xx = status >= 200 && status < 300;

  if (!is2xx) {
    const errorCode = status >= 500 ? 'LB_ROUTE_RESPONSE_HTTP_5XX' : 'LB_ROUTE_RESPONSE_HTTP_4XX';
    return makeOperation(ROUTE_OPERATIONS[path], {
      statusClass: 'FAILED', errorCode, severity: 'ERROR',
      latencyBucket, httpStatus: status, contentTypeClass: classifyContentType(ct),
      bodyPresent: hasBodyElement,
    });
  }

  return makeOperation(ROUTE_OPERATIONS[path], {
    statusClass: 'HEALTHY', errorCode: 'NONE', severity: 'INFO',
    latencyBucket, httpStatus: status, contentTypeClass: classifyContentType(ct),
    bodyPresent: hasBodyElement,
  });
}

async function checkStaticAsset(url, path, assetConfig, timeoutMs) {
  const fetchResult = await fetchWithTiming(url + path, timeoutMs);
  if (fetchResult.error) {
    const errMsg = fetchResult.error.message || '';
    const errorCode = errMsg.includes('abort') || errMsg.includes('timeout') ? 'LB_STATIC_ASSET_TIMEOUT' : 'LB_STATIC_ASSET_NETWORK';
    return makeOperation(assetConfig.code, {
      statusClass: 'FAILED', errorCode, severity: 'ERROR', latencyBucket: 'TIMEOUT_OR_UNKNOWN',
      bodyPresent: false, httpStatus: null,
    });
  }

  const res = fetchResult.response;
  const status = res.status;
  const ct = res.headers.get('content-type') || '';
  const latencyBucket = bucketLatency(fetchResult.latencyMs);
  const ctClass = classifyContentType(ct);

  const is2xx = status >= 200 && status < 300;

  if (!is2xx) {
    return makeOperation(assetConfig.code, {
      statusClass: 'FAILED', errorCode: 'LB_STATIC_ASSET_MISSING_ASSET', severity: 'ERROR',
      latencyBucket, httpStatus: status, contentTypeClass: ctClass,
      bodyPresent: false,
    });
  }

  const expectedCts = Array.isArray(assetConfig.expectedContentType)
    ? assetConfig.expectedContentType
    : [assetConfig.expectedContentType];

  const ctMatch = expectedCts.some((ect) => ct.includes(ect));
  if (!ctMatch) {
    return makeOperation(assetConfig.code, {
      statusClass: 'FAILED', errorCode: 'LB_STATIC_ASSET_CONTENT_TYPE', severity: 'ERROR',
      latencyBucket, httpStatus: status, contentTypeClass: ctClass,
      bodyPresent: true,
    });
  }

  return makeOperation(assetConfig.code, {
    statusClass: 'HEALTHY', errorCode: 'NONE', severity: 'INFO',
    latencyBucket, httpStatus: status, contentTypeClass: ctClass,
    bodyPresent: true,
  });
}

async function checkBrowserRuntime(baseUrl, paths, timeoutMs) {
  const ops = [];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    for (const path of paths) {
      for (const vp of VIEWPORTS) {
        ops.push(makeOperation(ROUTE_OPERATIONS[path], {
          statusClass: 'FAILED', errorCode: 'BROWSER_FATAL_ERROR', severity: 'ERROR',
          viewport: vp.name, bodyPresent: false, httpStatus: null, errorCount: 1,
        }));
      }
    }
    return ops;
  }

  try {
    for (const path of paths) {
      for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        const fatalErrors = [];
        const consoleErrors = [];
        const networkFailures = [];
        const networkBlockers = [];
        let ignoredMedia404Count = 0;

        page.removeAllListeners('pageerror');
        page.removeAllListeners('console');
        page.removeAllListeners('requestfailed');
        page.removeAllListeners('response');

        page.on('pageerror', () => {
          fatalErrors.push('pageerror');
        });

        page.on('console', (message) => {
          if (message.type() !== 'error') return;
          const text = message.text();
          if (text === 'Failed to load resource: the server responded with a status of 404 ()' && ignoredMedia404Count > 0) {
            ignoredMedia404Count--;
            return;
          }
          if (!isIgnoredExternalError(text)) {
            consoleErrors.push(text);
          }
        });

        page.on('requestfailed', (request) => {
          const rurl = request.url();
          if (/ytimg\.com|img\.youtube\.com/.test(rurl)) return;
          networkFailures.push(rurl);
        });

        page.on('response', (response) => {
          if (response.status() === 404 && (/ytimg\.com|img\.youtube\.com/.test(response.url()))) {
            ignoredMedia404Count++;
          }
          if (isNetworkBlocker(response.url(), response.status())) {
            networkBlockers.push(response.url());
          }
        });

        const url = baseUrl + path;
        await page.setViewportSize({ width: vp.width, height: vp.height });

        let httpStatus = null;
        let bodyPresent = false;
        let loadError = false;

        try {
          const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
          if (resp) {
            httpStatus = resp.status();
          }
          await page.waitForSelector('body', { timeout: Math.min(timeoutMs, 10000) });
          bodyPresent = true;
        } catch {
          loadError = true;
          try {
            const bodyEl = await page.$('body');
            bodyPresent = !!bodyEl;
          } catch {
            bodyPresent = false;
          }
        }

        let overflow = 0;
        if (bodyPresent) {
          try {
            overflow = await page.evaluate(() => {
              const root = document.documentElement;
              return Math.max(0, root.scrollWidth - root.clientWidth);
            });
          } catch {
            overflow = -1;
          }
        }

        const totalErrorCount = fatalErrors.length + consoleErrors.length + networkFailures.length + networkBlockers.length + (overflow > 0 ? 1 : 0);

        let statusClass = 'HEALTHY';
        let mainErrorCode = 'NONE';
        let severity = 'INFO';

        if (fatalErrors.length > 0) {
          statusClass = 'FAILED';
          mainErrorCode = 'BROWSER_FATAL_ERROR';
          severity = 'ERROR';
        } else if (consoleErrors.length > 0) {
          statusClass = 'FAILED';
          mainErrorCode = 'BROWSER_CONSOLE_ERROR';
          severity = 'ERROR';
        } else if (networkBlockers.length > 0) {
          statusClass = 'FAILED';
          mainErrorCode = 'BROWSER_HTTP_BLOCKER';
          severity = 'ERROR';
        } else if (networkFailures.length > 0) {
          statusClass = 'FAILED';
          mainErrorCode = 'BROWSER_NETWORK_FAILURE';
          severity = 'ERROR';
        } else if (overflow > 0) {
          statusClass = 'FAILED';
          mainErrorCode = 'BROWSER_HORIZONTAL_OVERFLOW';
          severity = 'ERROR';
        } else if (loadError) {
          statusClass = 'FAILED';
          mainErrorCode = 'BROWSER_FATAL_ERROR';
          severity = 'ERROR';
        }

        ops.push(makeOperation(ROUTE_OPERATIONS[path], {
          statusClass,
          errorCode: mainErrorCode,
          severity,
          viewport: vp.name,
          bodyPresent,
          httpStatus,
          errorCount: totalErrorCount,
          horizontalOverflow: overflow,
        }));

        await page.close();
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return ops;
}

async function main() {
  const inputs = parseInputs();
  if (inputs.error) {
    process.exit(2);
  }

  const { baseUrl, expectedSha, timeoutMs } = inputs;
  const operations = [];
  let overallHealthy = true;
  let observedReleaseSha = null;
  let releaseMatchState = 'UNKNOWN';
  let overallStatusClass = 'HEALTHY';

  const manifestResult = await checkManifest(baseUrl, expectedSha, timeoutMs);
  operations.push(makeOperation('MANIFEST_PARITY', {
    statusClass: manifestResult.statusClass,
    errorCode: manifestResult.sanitizedErrorCode,
    severity: manifestResult.severity,
    latencyBucket: manifestResult.latencyBucket,
    httpStatus: 200,
    contentTypeClass: 'JSON',
  }));

  observedReleaseSha = manifestResult.observedSha;
  releaseMatchState = manifestResult.releaseMatchState;

  if (!manifestResult.isHealthy) {
    overallHealthy = false;
    overallStatusClass = 'FAILED';
    emitOutput(baseUrl, expectedSha, observedReleaseSha, releaseMatchState, overallStatusClass, operations);
    process.exit(1);
  }

  const routePaths = Object.keys(ROUTE_OPERATIONS);
  const routeResults = await Promise.all(routePaths.map((path) => checkRoute(baseUrl, path, timeoutMs)));
  for (const r of routeResults) {
    operations.push(r);
    if (r.status_class === 'FAILED') {
      overallHealthy = false;
      overallStatusClass = 'FAILED';
    }
  }

  const staticPaths = Object.keys(STATIC_OPERATIONS);
  const staticResults = await Promise.all(staticPaths.map((path) => checkStaticAsset(baseUrl, path, STATIC_OPERATIONS[path], timeoutMs)));
  for (const s of staticResults) {
    operations.push(s);
    if (s.status_class === 'FAILED') {
      overallHealthy = false;
      overallStatusClass = 'FAILED';
    }
  }

  const browserOps = await checkBrowserRuntime(baseUrl, BROWSER_ROUTES, timeoutMs);
  for (const b of browserOps) {
    operations.push(b);
    if (b.status_class === 'FAILED') {
      overallHealthy = false;
      overallStatusClass = 'FAILED';
    }
  }

  emitOutput(baseUrl, expectedSha, observedReleaseSha, releaseMatchState, overallStatusClass, operations);

  if (overallHealthy) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

function emitOutput(baseUrl, expectedSha, observedSha, releaseMatchState, statusClass, operations) {
  const output = {
    contract_version: '1',
    ok: statusClass === 'HEALTHY',
    expected_release_sha: expectedSha,
    observed_release_sha: observedSha || 'UNKNOWN',
    release_match_state: releaseMatchState,
    status_class: statusClass,
    operations,
  };
  console.log(JSON.stringify(output));
}

main().catch(() => {
  console.error('Smoke runner terminated with unhandled error');
  process.exit(1);
});
