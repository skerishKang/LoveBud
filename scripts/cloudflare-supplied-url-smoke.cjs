const { chromium } = require('playwright');
const crypto = require('node:crypto');
const {
  CONTRACT_VERSION,
  STATUS_CLASSES,
  EXPECTATION_CLASSES,
  SEVERITY_CLASSES,
  CONTENT_TYPE_CLASSES,
  RELEASE_MATCH_STATES,
  LATENCY_BUCKETS,
  HTTP_STATUS_CLASSES,
  SANITIZED_ERROR_CODES,
  classifyLatency,
  classifyHttpStatus,
  classifyContentType,
  classifyReleaseMatch,
  normalizeSanitizedErrorCode,
} = require('./release-health-taxonomy.cjs');

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

function makeOperation(operationCode, fields) {
  return {
    operation_code: operationCode,
    expectation_class: fields.expectationClass || EXPECTATION_CLASSES.EXPECTED_SUCCESS,
    status_class: fields.statusClass || STATUS_CLASSES.FAILED,
    sanitized_error_code: normalizeSanitizedErrorCode(fields.errorCode || SANITIZED_ERROR_CODES.NONE),
    severity: fields.severity || SEVERITY_CLASSES.INFO,
    latency_bucket: fields.latencyBucket || LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN,
    http_status: fields.httpStatus != null ? fields.httpStatus : null,
    content_type_class: fields.contentTypeClass || CONTENT_TYPE_CLASSES.NOT_MEASURED,
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
  } catch {
    usage('SMOKE_BASE_URL must be a valid URL');
    return { error: 'SMOKE_BASE_URL_INVALID' };
  }

  if (baseUrl.protocol === 'https:') {
    // any https origin is allowed
  } else if (baseUrl.protocol === 'http:') {
    if (baseUrl.hostname !== 'localhost' && baseUrl.hostname !== '127.0.0.1') {
      usage('SMOKE_BASE_URL http: is only allowed for localhost or 127.0.0.1');
      return { error: 'SMOKE_BASE_URL_DISALLOWED' };
    }
  } else {
    usage('SMOKE_BASE_URL must use https: or http:localhost/127.0.0.1');
    return { error: 'SMOKE_BASE_URL_DISALLOWED' };
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
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    const elapsed = Date.now() - start;
    clearTimeout(timer);
    return { response, latencyMs: elapsed };
  } catch {
    const elapsed = Date.now() - start;
    clearTimeout(timer);
    return { failure: timedOut ? 'TIMEOUT' : 'NETWORK', latencyMs: elapsed };
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
    if (fetchResult.failure) {
      if (fetchResult.failure === 'TIMEOUT') {
        return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_TIMEOUT, severity: SEVERITY_CLASSES.ERROR, httpStatus: null, contentTypeClass: CONTENT_TYPE_CLASSES.NOT_MEASURED, bodyPresent: false, latencyBucket: LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN };
      }
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_NETWORK_ERROR, severity: SEVERITY_CLASSES.ERROR, httpStatus: null, contentTypeClass: CONTENT_TYPE_CLASSES.NOT_MEASURED, bodyPresent: false, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }
    const res = fetchResult.response;
    if (res.status !== 200) {
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_HTTP_STATUS, severity: SEVERITY_CLASSES.ERROR, httpStatus: res.status, contentTypeClass: classifyContentType(res.headers.get('content-type')), bodyPresent: false, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_CONTENT_TYPE, severity: SEVERITY_CLASSES.ERROR, httpStatus: res.status, contentTypeClass: classifyContentType(ct), bodyPresent: false, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }
    const cc = res.headers.get('cache-control') || '';
    if (!cc.includes('no-store')) {
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_CACHE_POLICY, severity: SEVERITY_CLASSES.ERROR, httpStatus: res.status, contentTypeClass: CONTENT_TYPE_CLASSES.JSON, bodyPresent: false, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }

    let body;
    try {
      body = await res.text();
    } catch {
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_BODY_READ_ERROR, severity: SEVERITY_CLASSES.ERROR, httpStatus: res.status, contentTypeClass: CONTENT_TYPE_CLASSES.JSON, bodyPresent: false, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_PARSE_ERROR, severity: SEVERITY_CLASSES.ERROR, httpStatus: res.status, contentTypeClass: CONTENT_TYPE_CLASSES.JSON, bodyPresent: true, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }

    const keys = Object.keys(parsed).sort();
    if (keys.length !== 2 || keys[0] !== 'contract_version' || keys[1] !== 'release_sha') {
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_SCHEMA_KEYS, severity: SEVERITY_CLASSES.ERROR, httpStatus: res.status, contentTypeClass: CONTENT_TYPE_CLASSES.JSON, bodyPresent: true, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }

    if (typeof parsed.contract_version !== 'string' || parsed.contract_version !== CONTRACT_VERSION) {
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_CONTRACT_VERSION, severity: SEVERITY_CLASSES.ERROR, httpStatus: res.status, contentTypeClass: CONTENT_TYPE_CLASSES.JSON, bodyPresent: true, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }

    if (typeof parsed.release_sha !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.release_sha)) {
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_SHA_FORMAT, severity: SEVERITY_CLASSES.ERROR, httpStatus: res.status, contentTypeClass: CONTENT_TYPE_CLASSES.JSON, bodyPresent: true, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }

    const forbiddenKey = keys.find((k) => FORBIDDEN_MANIFEST_KEYS.includes(k));
    if (forbiddenKey) {
      return { statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_FORBIDDEN_KEY, severity: SEVERITY_CLASSES.ERROR, httpStatus: res.status, contentTypeClass: CONTENT_TYPE_CLASSES.JSON, bodyPresent: true, latencyBucket: classifyLatency(fetchResult.latencyMs) };
    }

    return {
      statusClass: STATUS_CLASSES.HEALTHY,
      errorCode: SANITIZED_ERROR_CODES.NONE,
      severity: SEVERITY_CLASSES.INFO,
      httpStatus: res.status,
      contentTypeClass: CONTENT_TYPE_CLASSES.JSON,
      bodyPresent: true,
      latencyBucket: classifyLatency(fetchResult.latencyMs),
      parsed,
    };
  }

  const result1 = await extractResult(r1);
  const result2 = await extractResult(r2);

  const worstLatencyMs = Math.max(r1.latencyMs, r2.latencyMs);

  if (result1.statusClass === STATUS_CLASSES.FAILED || result2.statusClass === STATUS_CLASSES.FAILED) {
    const selected = result1.statusClass === STATUS_CLASSES.FAILED ? result1 : result2;
    return {
      releaseMatchState: RELEASE_MATCH_STATES.UNKNOWN,
      statusClass: STATUS_CLASSES.FAILED,
      sanitizedErrorCode: selected.errorCode,
      severity: SEVERITY_CLASSES.ERROR,
      latencyBucket: classifyLatency(worstLatencyMs),
      observedSha: null,
      isHealthy: false,
      httpStatus: selected.httpStatus != null ? selected.httpStatus : null,
      contentTypeClass: selected.contentTypeClass || CONTENT_TYPE_CLASSES.NOT_MEASURED,
      bodyPresent: selected.bodyPresent === true,
    };
  }

  const nonceMatchState = classifyReleaseMatch(result1.parsed.release_sha, result2.parsed.release_sha);
  const parsedPayloadEqual = JSON.stringify(result1.parsed) === JSON.stringify(result2.parsed);
  if (!parsedPayloadEqual || nonceMatchState === RELEASE_MATCH_STATES.MISMATCH) {
    return {
      releaseMatchState: RELEASE_MATCH_STATES.MISMATCH,
      statusClass: STATUS_CLASSES.FAILED,
      sanitizedErrorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_NONCE_INCONSISTENCY,
      severity: SEVERITY_CLASSES.ERROR,
      latencyBucket: classifyLatency(worstLatencyMs),
      observedSha: result1.parsed.release_sha,
      isHealthy: false,
      httpStatus: result1.httpStatus != null ? result1.httpStatus : null,
      contentTypeClass: result1.contentTypeClass || CONTENT_TYPE_CLASSES.NOT_MEASURED,
      bodyPresent: result1.bodyPresent === true,
    };
  }

  const observedSha = result1.parsed.release_sha;
  const releaseMatchState = classifyReleaseMatch(expectedSha, observedSha);
  if (releaseMatchState !== RELEASE_MATCH_STATES.MATCH) {
    return {
      releaseMatchState: releaseMatchState,
      statusClass: STATUS_CLASSES.FAILED,
      sanitizedErrorCode: SANITIZED_ERROR_CODES.LB_MANIFEST_SHA_MISMATCH,
      severity: SEVERITY_CLASSES.ERROR,
      latencyBucket: classifyLatency(worstLatencyMs),
      observedSha,
      isHealthy: false,
      httpStatus: result1.httpStatus != null ? result1.httpStatus : null,
      contentTypeClass: result1.contentTypeClass || CONTENT_TYPE_CLASSES.NOT_MEASURED,
      bodyPresent: result1.bodyPresent === true,
    };
  }

  return {
    releaseMatchState: RELEASE_MATCH_STATES.MATCH,
    statusClass: STATUS_CLASSES.HEALTHY,
    sanitizedErrorCode: SANITIZED_ERROR_CODES.NONE,
    severity: SEVERITY_CLASSES.INFO,
    latencyBucket: classifyLatency(worstLatencyMs),
    observedSha,
    isHealthy: true,
    httpStatus: result1.httpStatus != null ? result1.httpStatus : null,
    contentTypeClass: result1.contentTypeClass || CONTENT_TYPE_CLASSES.NOT_MEASURED,
    bodyPresent: result1.bodyPresent === true,
  };
}

async function checkRoute(url, path, timeoutMs) {
  const fetchResult = await fetchWithTiming(url + path, timeoutMs);
  if (fetchResult.failure) {
    const errorCode = fetchResult.failure === 'TIMEOUT'
      ? SANITIZED_ERROR_CODES.LB_ROUTE_RESPONSE_TIMEOUT
      : SANITIZED_ERROR_CODES.LB_ROUTE_RESPONSE_NETWORK;
    return makeOperation(ROUTE_OPERATIONS[path], {
      statusClass: STATUS_CLASSES.FAILED, errorCode, severity: SEVERITY_CLASSES.ERROR, latencyBucket: LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN,
      bodyPresent: false, httpStatus: null,
    });
  }

  const res = fetchResult.response;
  const status = res.status;
  const ct = res.headers.get('content-type') || '';
  const latencyBucket = classifyLatency(fetchResult.latencyMs);

  let bodyText;
  try {
    bodyText = await res.text();
  } catch {
    return makeOperation(ROUTE_OPERATIONS[path], {
      statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_ROUTE_RESPONSE_NETWORK, severity: SEVERITY_CLASSES.ERROR,
      latencyBucket, httpStatus: status, contentTypeClass: classifyContentType(ct),
      bodyPresent: false,
    });
  }

  const hasBodyElement = /<body(?:\s|>)/i.test(bodyText);
  const httpStatusClass = classifyHttpStatus(status);
  const is2xx = httpStatusClass === HTTP_STATUS_CLASSES.HTTP_2XX;

  if (!is2xx) {
    const errorCode = httpStatusClass === HTTP_STATUS_CLASSES.HTTP_5XX
      ? SANITIZED_ERROR_CODES.LB_ROUTE_RESPONSE_HTTP_5XX
      : SANITIZED_ERROR_CODES.LB_ROUTE_RESPONSE_HTTP_4XX;
    return makeOperation(ROUTE_OPERATIONS[path], {
      statusClass: STATUS_CLASSES.FAILED, errorCode, severity: SEVERITY_CLASSES.ERROR,
      latencyBucket, httpStatus: status, contentTypeClass: classifyContentType(ct),
      bodyPresent: hasBodyElement,
    });
  }

  if (!hasBodyElement) {
    return makeOperation(ROUTE_OPERATIONS[path], {
      statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_ROUTE_BODY_MISSING, severity: SEVERITY_CLASSES.ERROR,
      latencyBucket, httpStatus: status, contentTypeClass: classifyContentType(ct),
      bodyPresent: false,
    });
  }

  return makeOperation(ROUTE_OPERATIONS[path], {
    statusClass: STATUS_CLASSES.HEALTHY, errorCode: SANITIZED_ERROR_CODES.NONE, severity: SEVERITY_CLASSES.INFO,
    latencyBucket, httpStatus: status, contentTypeClass: classifyContentType(ct),
    bodyPresent: true,
  });
}

async function checkStaticAsset(url, path, assetConfig, timeoutMs) {
  const fetchResult = await fetchWithTiming(url + path, timeoutMs);
  if (fetchResult.failure) {
    const errorCode = fetchResult.failure === 'TIMEOUT'
      ? SANITIZED_ERROR_CODES.LB_STATIC_ASSET_TIMEOUT
      : SANITIZED_ERROR_CODES.LB_STATIC_ASSET_NETWORK;
    return makeOperation(assetConfig.code, {
      statusClass: STATUS_CLASSES.FAILED, errorCode, severity: SEVERITY_CLASSES.ERROR, latencyBucket: LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN,
      bodyPresent: false, httpStatus: null,
    });
  }

  const res = fetchResult.response;
  const status = res.status;
  const ct = res.headers.get('content-type') || '';
  const latencyBucket = classifyLatency(fetchResult.latencyMs);
  const ctClass = classifyContentType(ct);

  const is2xx = classifyHttpStatus(status) === HTTP_STATUS_CLASSES.HTTP_2XX;

  if (!is2xx) {
    return makeOperation(assetConfig.code, {
      statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_STATIC_ASSET_MISSING_ASSET, severity: SEVERITY_CLASSES.ERROR,
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
      statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.LB_STATIC_ASSET_CONTENT_TYPE, severity: SEVERITY_CLASSES.ERROR,
      latencyBucket, httpStatus: status, contentTypeClass: ctClass,
      bodyPresent: true,
    });
  }

  return makeOperation(assetConfig.code, {
    statusClass: STATUS_CLASSES.HEALTHY, errorCode: SANITIZED_ERROR_CODES.NONE, severity: SEVERITY_CLASSES.INFO,
    latencyBucket, httpStatus: status, contentTypeClass: ctClass,
    bodyPresent: true,
  });
}

async function checkBrowserRuntime(baseUrl, paths, timeoutMs) {
  const ops = [];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    for (const path of paths) {
      for (const vp of VIEWPORTS) {
        ops.push(makeOperation(ROUTE_OPERATIONS[path], {
          statusClass: STATUS_CLASSES.FAILED, errorCode: SANITIZED_ERROR_CODES.BROWSER_FATAL_ERROR, severity: SEVERITY_CLASSES.ERROR,
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
        let fatalErrorCount = 0;
        let consoleErrorCount = 0;
        let networkFailureCount = 0;
        let networkBlockerCount = 0;
        let ignoredMedia404Count = 0;

        page.removeAllListeners('pageerror');
        page.removeAllListeners('console');
        page.removeAllListeners('requestfailed');
        page.removeAllListeners('response');

        page.on('pageerror', () => {
          fatalErrorCount++;
        });

        page.on('console', (message) => {
          if (message.type() !== 'error') return;
          const text = message.text();
          if (text === 'Failed to load resource: the server responded with a status of 404 ()' && ignoredMedia404Count > 0) {
            ignoredMedia404Count--;
            return;
          }
          if (!isIgnoredExternalError(text)) {
            consoleErrorCount++;
          }
        });

        page.on('requestfailed', (request) => {
          const rurl = request.url();
          if (/ytimg\.com|img\.youtube\.com/.test(rurl)) return;
          networkFailureCount++;
        });

        page.on('response', (response) => {
          if (response.status() === 404 && (/ytimg\.com|img\.youtube\.com/.test(response.url()))) {
            ignoredMedia404Count++;
          }
          if (isNetworkBlocker(response.url(), response.status())) {
            networkBlockerCount++;
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

        const totalErrorCount = fatalErrorCount + consoleErrorCount + networkFailureCount + networkBlockerCount + (overflow > 0 ? 1 : 0);

        let statusClass = STATUS_CLASSES.HEALTHY;
        let mainErrorCode = SANITIZED_ERROR_CODES.NONE;
        let severity = SEVERITY_CLASSES.INFO;

        if (fatalErrorCount > 0) {
          statusClass = STATUS_CLASSES.FAILED;
          mainErrorCode = SANITIZED_ERROR_CODES.BROWSER_FATAL_ERROR;
          severity = SEVERITY_CLASSES.ERROR;
        } else if (consoleErrorCount > 0) {
          statusClass = STATUS_CLASSES.FAILED;
          mainErrorCode = SANITIZED_ERROR_CODES.BROWSER_CONSOLE_ERROR;
          severity = SEVERITY_CLASSES.ERROR;
        } else if (networkBlockerCount > 0) {
          statusClass = STATUS_CLASSES.FAILED;
          mainErrorCode = SANITIZED_ERROR_CODES.BROWSER_HTTP_BLOCKER;
          severity = SEVERITY_CLASSES.ERROR;
        } else if (networkFailureCount > 0) {
          statusClass = STATUS_CLASSES.FAILED;
          mainErrorCode = SANITIZED_ERROR_CODES.BROWSER_NETWORK_FAILURE;
          severity = SEVERITY_CLASSES.ERROR;
        } else if (overflow > 0) {
          statusClass = STATUS_CLASSES.FAILED;
          mainErrorCode = SANITIZED_ERROR_CODES.BROWSER_HORIZONTAL_OVERFLOW;
          severity = SEVERITY_CLASSES.ERROR;
        } else if (loadError) {
          statusClass = STATUS_CLASSES.FAILED;
          mainErrorCode = SANITIZED_ERROR_CODES.BROWSER_FATAL_ERROR;
          severity = SEVERITY_CLASSES.ERROR;
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
    emitInputFailure(inputs.error);
    process.exit(2);
  }

  const { baseUrl, expectedSha, timeoutMs } = inputs;
  const operations = [];
  let overallHealthy = true;
  let observedReleaseSha = null;
  let releaseMatchState = RELEASE_MATCH_STATES.UNKNOWN;
  let overallStatusClass = STATUS_CLASSES.HEALTHY;

  const manifestResult = await checkManifest(baseUrl, expectedSha, timeoutMs);
  operations.push(makeOperation('MANIFEST_PARITY', {
    statusClass: manifestResult.statusClass,
    errorCode: manifestResult.sanitizedErrorCode,
    severity: manifestResult.severity,
    latencyBucket: manifestResult.latencyBucket,
    httpStatus: manifestResult.httpStatus,
    contentTypeClass: manifestResult.contentTypeClass,
    bodyPresent: manifestResult.bodyPresent,
  }));

  observedReleaseSha = manifestResult.observedSha;
  releaseMatchState = manifestResult.releaseMatchState;

  if (!manifestResult.isHealthy) {
    overallHealthy = false;
    overallStatusClass = STATUS_CLASSES.FAILED;
    emitOutput(expectedSha, observedReleaseSha, releaseMatchState, overallStatusClass, operations);
    process.exit(1);
  }

  const routePaths = Object.keys(ROUTE_OPERATIONS);
  const routeResults = await Promise.all(routePaths.map((path) => checkRoute(baseUrl, path, timeoutMs)));
  for (const r of routeResults) {
    operations.push(r);
    if (r.status_class === STATUS_CLASSES.FAILED) {
      overallHealthy = false;
      overallStatusClass = STATUS_CLASSES.FAILED;
    }
  }

  const staticPaths = Object.keys(STATIC_OPERATIONS);
  const staticResults = await Promise.all(staticPaths.map((path) => checkStaticAsset(baseUrl, path, STATIC_OPERATIONS[path], timeoutMs)));
  for (const s of staticResults) {
    operations.push(s);
    if (s.status_class === STATUS_CLASSES.FAILED) {
      overallHealthy = false;
      overallStatusClass = STATUS_CLASSES.FAILED;
    }
  }

  const browserOps = await checkBrowserRuntime(baseUrl, BROWSER_ROUTES, timeoutMs);
  for (const b of browserOps) {
    operations.push(b);
    if (b.status_class === STATUS_CLASSES.FAILED) {
      overallHealthy = false;
      overallStatusClass = STATUS_CLASSES.FAILED;
    }
  }

  emitOutput(expectedSha, observedReleaseSha, releaseMatchState, overallStatusClass, operations);

  if (overallHealthy) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

let outputEmitted = false;

function buildOutput(expectedSha, observedSha, releaseMatchState, statusClass, operations) {
  return {
    contract_version: CONTRACT_VERSION,
    ok: statusClass === STATUS_CLASSES.HEALTHY,
    expected_release_sha: expectedSha || 'UNKNOWN',
    observed_release_sha: observedSha || 'UNKNOWN',
    release_match_state: releaseMatchState,
    status_class: statusClass,
    operations,
  };
}

function emitOutput(expectedSha, observedSha, releaseMatchState, statusClass, operations) {
  if (outputEmitted) return;
  outputEmitted = true;
  console.log(JSON.stringify(buildOutput(expectedSha, observedSha, releaseMatchState, statusClass, operations)));
}

const INPUT_ERROR_CODES = Object.freeze({
  SMOKE_BASE_URL_REQUIRED: SANITIZED_ERROR_CODES.LB_INPUT_URL_MISSING,
  SMOKE_BASE_URL_INVALID: SANITIZED_ERROR_CODES.LB_INPUT_URL_INVALID,
  SMOKE_BASE_URL_DISALLOWED: SANITIZED_ERROR_CODES.LB_INPUT_URL_DISALLOWED,
  SMOKE_EXPECTED_SHA_REQUIRED: SANITIZED_ERROR_CODES.LB_INPUT_SHA_MISSING,
  SMOKE_EXPECTED_SHA_INVALID: SANITIZED_ERROR_CODES.LB_INPUT_SHA_INVALID,
  SMOKE_TIMEOUT_MS_INVALID: SANITIZED_ERROR_CODES.LB_INPUT_TIMEOUT_INVALID,
});

function emitInputFailure(inputError) {
  if (outputEmitted) return;
  outputEmitted = true;
  const errorCode = INPUT_ERROR_CODES[inputError] || SANITIZED_ERROR_CODES.LB_INPUT_INVALID;
  const op = makeOperation('INPUT_VALIDATION', {
    expectationClass: EXPECTATION_CLASSES.EXPECTED_SUCCESS,
    statusClass: STATUS_CLASSES.FAILED,
    errorCode,
    severity: SEVERITY_CLASSES.ERROR,
    errorCount: 1,
  });
  console.log(JSON.stringify(buildOutput('UNKNOWN', 'UNKNOWN', RELEASE_MATCH_STATES.UNKNOWN, STATUS_CLASSES.FAILED, [op])));
}

function emitUnexpectedFailure() {
  if (outputEmitted) return;
  outputEmitted = true;
  const op = makeOperation('UNEXPECTED_FAILURE', {
    expectationClass: EXPECTATION_CLASSES.UNEXPECTED_FAILURE,
    statusClass: STATUS_CLASSES.FAILED,
    errorCode: SANITIZED_ERROR_CODES.LB_UNEXPECTED_FAILURE,
    severity: SEVERITY_CLASSES.ERROR,
    errorCount: 1,
  });
  console.log(JSON.stringify(buildOutput('UNKNOWN', 'UNKNOWN', RELEASE_MATCH_STATES.UNKNOWN, STATUS_CLASSES.FAILED, [op])));
}

main().catch(() => {
  emitUnexpectedFailure();
  process.exit(1);
});
