#!/usr/bin/env node
'use strict';

/*
 * #3273 safe source write/read divergence classifier.
 *
 * Safe-by-default: the CLI defaults to dry-run/preflight mode and never writes
 * production data unless the operator explicitly provides env-only fixture
 * inputs and sets LOVEBUD_QA_DRY_RUN=false.
 *
 * Output is a sanitized JSON summary only. Raw ids, URLs, tokens, headers,
 * cookies, response bodies, and payloads are intentionally omitted.
 */

const { URL } = require('node:url');

const CLASSIFICATIONS = Object.freeze({
  PERSISTED: 'PERSISTED',
  OWNER_STALE: 'OWNER_STALE',
  COMMUNITY_STALE: 'COMMUNITY_STALE',
  WRITE_REJECTED: 'WRITE_REJECTED',
  BLOCKED_FIXTURE_UNAVAILABLE: 'BLOCKED_FIXTURE_UNAVAILABLE',
  BLOCKED_AUTH_UNAVAILABLE: 'BLOCKED_AUTH_UNAVAILABLE',
  BLOCKED_RUNTIME_CONFIG_UNAVAILABLE: 'BLOCKED_RUNTIME_CONFIG_UNAVAILABLE',
});

const THUMBNAIL = Object.freeze({
  MATCHED: 'MATCHED',
  STALE: 'THUMBNAIL_STALE',
  NOT_PRESENT: 'NOT_PRESENT',
  NOT_YOUTUBE: 'NOT_YOUTUBE',
  NOT_CHECKED: 'NOT_CHECKED',
});

const REQUIRED_FIXTURE_ENV = Object.freeze([
  'LOVEBUD_QA_TREE_ID',
  'LOVEBUD_QA_MEMORY_ID',
  'LOVEBUD_QA_NEW_SOURCE_URL',
]);

function isTruthyDryRun(value) {
  if (value === undefined || value === null || value === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function safeStatus(classification, overrides = {}) {
  return sanitizeSummary({
    status: classification && classification.startsWith('BLOCKED_') ? 'BLOCKED' : 'OK',
    classification,
    ownerRead: 'NOT_CHECKED',
    communityRead: 'NOT_CHECKED',
    writeResponse: 'NOT_CHECKED',
    thumbnailCoherence: THUMBNAIL.NOT_CHECKED,
    blockedReason: classification && classification.startsWith('BLOCKED_') ? classification : '',
    checksRun: [],
    sanitizedNotes: [],
    ...overrides,
  });
}

function validateBaseUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function getMissingFixtureEnv(env) {
  return REQUIRED_FIXTURE_ENV.filter((key) => !String(env[key] || '').trim());
}

function preflight(env = process.env) {
  const baseUrl = String(env.LOVEBUD_QA_BASE_URL || '').trim();
  if (!validateBaseUrl(baseUrl)) {
    return safeStatus(CLASSIFICATIONS.BLOCKED_RUNTIME_CONFIG_UNAVAILABLE, {
      checksRun: ['runtime-config'],
      sanitizedNotes: ['base URL missing or invalid; no network call attempted'],
    });
  }

  const authToken = String(env.LOVEBUD_QA_AUTH_TOKEN || '').trim();
  if (!authToken) {
    return safeStatus(CLASSIFICATIONS.BLOCKED_AUTH_UNAVAILABLE, {
      checksRun: ['runtime-config', 'auth-token'],
      sanitizedNotes: ['auth token missing; no write/read fetch attempted'],
    });
  }

  const missingFixture = getMissingFixtureEnv(env);
  if (missingFixture.length > 0) {
    return safeStatus(CLASSIFICATIONS.BLOCKED_FIXTURE_UNAVAILABLE, {
      checksRun: ['runtime-config', 'auth-token', 'fixture-env'],
      sanitizedNotes: ['required synthetic fixture env missing; no write/read fetch attempted'],
    });
  }

  if (isTruthyDryRun(env.LOVEBUD_QA_DRY_RUN)) {
    return safeStatus('DRY_RUN_READY', {
      status: 'DRY_RUN',
      blockedReason: '',
      checksRun: ['runtime-config', 'auth-token', 'fixture-env', 'dry-run'],
      sanitizedNotes: [
        'dry-run/preflight only; no PUT/POST/DELETE/GET runtime evidence collected',
        'set LOVEBUD_QA_DRY_RUN=false only with approved synthetic fixture and authorized test identity',
      ],
    });
  }

  return null;
}

function firstString(record, keys) {
  if (!record || typeof record !== 'object') return '';
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function extractYouTubeId(value) {
  if (!value || typeof value !== 'string') return '';
  const raw = value.trim();
  const direct = raw.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([0-9A-Za-z_-]{11})/);
  if (direct) return direct[1];
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '').toLowerCase();
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const fromParam = parsed.searchParams.get('v');
      if (fromParam && /^[0-9A-Za-z_-]{11}$/.test(fromParam)) return fromParam;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && /^[0-9A-Za-z_-]{11}$/.test(last)) return last;
    }
    if (host === 'youtu.be') {
      const first = parsed.pathname.split('/').filter(Boolean)[0];
      if (first && /^[0-9A-Za-z_-]{11}$/.test(first)) return first;
    }
  } catch (_error) {
    return '';
  }
  return '';
}

function normalizeSourceIdentity(recordOrUrl) {
  const sourceUrl = typeof recordOrUrl === 'string'
    ? recordOrUrl
    : firstString(recordOrUrl, ['sourceUrl', 'source_url', 'videoUrl', 'video_url', 'originalUrl', 'original_url', 'url']);
  const sourceType = typeof recordOrUrl === 'object'
    ? firstString(recordOrUrl, ['sourceType', 'source_type', 'type']).toLowerCase()
    : '';
  const videoId = extractYouTubeId(sourceUrl);

  if (videoId) {
    return {
      kind: 'youtube-video',
      sourceType: sourceType || 'youtube',
      comparableKey: `youtube-video:${videoId}`,
      present: true,
    };
  }

  if (sourceUrl) {
    let comparableKey = 'url:unparseable';
    try {
      const parsed = new URL(sourceUrl);
      parsed.hash = '';
      comparableKey = `url:${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname}${parsed.search}`;
    } catch (_error) {
      comparableKey = 'url:invalid';
    }
    return {
      kind: sourceType || 'generic-url',
      sourceType: sourceType || 'unknown',
      comparableKey,
      present: true,
    };
  }

  return {
    kind: 'missing',
    sourceType: sourceType || 'unknown',
    comparableKey: 'missing',
    present: false,
  };
}

function normalizeThumbnailIdentity(record) {
  const thumbnail = firstString(record, [
    'thumbnail',
    'thumbnailUrl',
    'thumbnail_url',
    'representativeThumbnail',
    'representative_thumbnail',
  ]);
  if (!thumbnail) return { present: false, comparableKey: 'missing' };
  const videoId = extractYouTubeId(thumbnail);
  return {
    present: true,
    comparableKey: videoId ? `youtube-video:${videoId}` : 'thumbnail:non-youtube',
  };
}

function compareSourceIdentity(actualRecord, submittedIdentity) {
  const actual = normalizeSourceIdentity(actualRecord);
  return {
    matched: actual.present && actual.comparableKey === submittedIdentity.comparableKey,
    state: actual.present && actual.comparableKey === submittedIdentity.comparableKey ? 'MATCHED' : 'MISMATCHED',
  };
}

function evaluateThumbnailCoherence(record, submittedIdentity) {
  const thumbnail = normalizeThumbnailIdentity(record);
  if (!thumbnail.present) return THUMBNAIL.NOT_PRESENT;
  if (!submittedIdentity.comparableKey.startsWith('youtube-video:')) return THUMBNAIL.NOT_YOUTUBE;
  return thumbnail.comparableKey === submittedIdentity.comparableKey ? THUMBNAIL.MATCHED : THUMBNAIL.STALE;
}

function findCommunityMemoryByOpaqueHandle(payload, opaqueMemoryId) {
  const candidates = [];
  if (Array.isArray(payload)) candidates.push(...payload);
  if (payload && Array.isArray(payload.memories)) candidates.push(...payload.memories);
  if (payload && Array.isArray(payload.data)) candidates.push(...payload.data);
  if (payload && Array.isArray(payload.items)) candidates.push(...payload.items);
  return candidates.find((item) => item && String(item.id || item.memoryId || item.memory_id || '') === String(opaqueMemoryId)) || null;
}

async function readJsonResponse(response) {
  if (!response) return null;
  if (typeof response.json === 'function') return response.json();
  return response;
}

function runtimeHeaders(authToken) {
  return {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };
}

function buildUrl(baseUrl, pathname, searchParams = {}) {
  const url = new URL(pathname, baseUrl);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && String(value) !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function buildSyntheticPayload(env) {
  const payload = {
    sourceUrl: String(env.LOVEBUD_QA_NEW_SOURCE_URL || '').trim(),
  };
  if (String(env.LOVEBUD_QA_OLD_SOURCE_LABEL || '').trim()) {
    payload.source = 'synthetic-source-change';
  }
  return payload;
}

async function runClassifier(options = {}) {
  const env = options.env || process.env;
  const blocked = preflight(env);
  if (blocked) return blocked;

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return safeStatus(CLASSIFICATIONS.BLOCKED_RUNTIME_CONFIG_UNAVAILABLE, {
      checksRun: ['runtime-config', 'fetch-implementation'],
      sanitizedNotes: ['fetch implementation unavailable; no network call attempted'],
    });
  }

  const baseUrl = String(env.LOVEBUD_QA_BASE_URL || '').trim();
  const authToken = String(env.LOVEBUD_QA_AUTH_TOKEN || '').trim();
  const treeId = String(env.LOVEBUD_QA_TREE_ID || '').trim();
  const memoryId = String(env.LOVEBUD_QA_MEMORY_ID || '').trim();
  const submittedIdentity = normalizeSourceIdentity(String(env.LOVEBUD_QA_NEW_SOURCE_URL || '').trim());
  const checksRun = ['runtime-config', 'auth-token', 'fixture-env', 'runtime-enabled'];

  let writePayload;
  let writeJson;
  try {
    writePayload = buildSyntheticPayload(env);
    const writeResponse = await fetchImpl(buildUrl(baseUrl, `/api/memories/${encodeURIComponent(memoryId)}`), {
      method: 'PUT',
      headers: runtimeHeaders(authToken),
      body: JSON.stringify(writePayload),
    });
    checksRun.push('write-response');
    writeJson = await readJsonResponse(writeResponse);
  } catch (_error) {
    return safeStatus(CLASSIFICATIONS.WRITE_REJECTED, {
      status: 'FAIL',
      writeResponse: 'MISMATCHED',
      checksRun,
      sanitizedNotes: ['write request failed or response could not be parsed; raw error omitted'],
    });
  }

  const writeMatch = compareSourceIdentity(writeJson, submittedIdentity);
  if (!writeMatch.matched) {
    return safeStatus(CLASSIFICATIONS.WRITE_REJECTED, {
      status: 'FAIL',
      writeResponse: 'MISMATCHED',
      checksRun,
      sanitizedNotes: ['write response did not acknowledge submitted source identity'],
    });
  }

  let ownerJson;
  try {
    const ownerResponse = await fetchImpl(buildUrl(baseUrl, `/api/memories/${encodeURIComponent(memoryId)}`), {
      method: 'GET',
      headers: runtimeHeaders(authToken),
    });
    checksRun.push('owner-reread');
    ownerJson = await readJsonResponse(ownerResponse);
  } catch (_error) {
    ownerJson = null;
  }
  const ownerMatch = compareSourceIdentity(ownerJson, submittedIdentity);
  if (!ownerMatch.matched) {
    return safeStatus(CLASSIFICATIONS.OWNER_STALE, {
      status: 'FAIL',
      writeResponse: 'MATCHED',
      ownerRead: 'MISMATCHED',
      checksRun,
      sanitizedNotes: ['owner reread source identity did not match submitted identity'],
    });
  }

  let communityJson;
  try {
    const communityResponse = await fetchImpl(buildUrl(baseUrl, '/api/community/memories', { treeId }), {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    checksRun.push('community-reread');
    communityJson = await readJsonResponse(communityResponse);
  } catch (_error) {
    communityJson = null;
  }
  const communityMemory = findCommunityMemoryByOpaqueHandle(communityJson, memoryId);
  const communityMatch = compareSourceIdentity(communityMemory, submittedIdentity);
  if (!communityMatch.matched) {
    return safeStatus(CLASSIFICATIONS.COMMUNITY_STALE, {
      status: 'FAIL',
      writeResponse: 'MATCHED',
      ownerRead: 'MATCHED',
      communityRead: communityMemory ? 'MISMATCHED' : 'TARGET_NOT_FOUND_BY_OPAQUE_HANDLE',
      checksRun,
      sanitizedNotes: ['community reread did not expose matching source identity for the opaque fixture handle'],
    });
  }

  const thumbnailCoherence = evaluateThumbnailCoherence(communityMemory || ownerJson || writeJson, submittedIdentity);
  return safeStatus(CLASSIFICATIONS.PERSISTED, {
    writeResponse: 'MATCHED',
    ownerRead: 'MATCHED',
    communityRead: 'MATCHED',
    thumbnailCoherence,
    checksRun,
    sanitizedNotes: thumbnailCoherence === THUMBNAIL.STALE
      ? ['source identity persisted, but thumbnail identity is stale']
      : ['write response, owner reread, and community reread matched submitted source identity'],
  });
}

function sanitizeString(value) {
  return String(value || '')
    .replace(/https?:\/\/[^\s"')]+/gi, '[REDACTED_URL]')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/(token|cookie|authorization|password|secret)\s*[:=]\s*[^\s,}]+/gi, '$1=[REDACTED]')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[REDACTED_ID]');
}

function sanitizeSummary(summary) {
  const allowedKeys = [
    'status',
    'classification',
    'ownerRead',
    'communityRead',
    'writeResponse',
    'thumbnailCoherence',
    'blockedReason',
    'checksRun',
    'sanitizedNotes',
  ];
  const clean = {};
  for (const key of allowedKeys) {
    const value = summary[key];
    if (Array.isArray(value)) {
      clean[key] = value.map((entry) => sanitizeString(entry));
    } else {
      clean[key] = sanitizeString(value);
    }
  }
  return clean;
}

async function main() {
  const summary = await runClassifier();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status === 'FAIL' || summary.status === 'BLOCKED') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((_error) => {
    process.stdout.write(`${JSON.stringify(safeStatus(CLASSIFICATIONS.BLOCKED_RUNTIME_CONFIG_UNAVAILABLE, {
      checksRun: ['unexpected-error'],
      sanitizedNotes: ['unexpected classifier error; raw error omitted'],
    }), null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CLASSIFICATIONS,
  THUMBNAIL,
  preflight,
  runClassifier,
  normalizeSourceIdentity,
  evaluateThumbnailCoherence,
  findCommunityMemoryByOpaqueHandle,
  sanitizeSummary,
};
