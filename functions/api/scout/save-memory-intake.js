const FORBIDDEN_NAMES = [
  'rawSourceBody',
  'fullScrapedContent',

  'fullArticle',
  'fullPost',
  'fullTranscript',
  'lyrics',
  'paywalledContent',
  'copiedImage',
  'copiedVideo',
  'rawProviderOutput',
  'rawRequestResponseBodies',
  'rawRequestBody',
  'rawResponseBody',

  'tokens',
  'cookies',
  'authHeaders',
  'apiBaseUrl',
  'dashboardUrl',
  'dbRow',
  'privateLog',
  'screenshotWithPrivateId',
];

const REQUIRED_FIELDS = ['sourceLink', 'sourceLabel', 'memoryDraft'];
const OPTIONAL_FIELDS = ['summary', 'translatedSummary', 'fanContext', 'emotionTags'];

function normalizeString(value, maxLen) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function checkForbiddenFieldNames(obj, path) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_NAMES.includes(key)) {
      return key;
    }
  }
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const val of Object.values(obj)) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const nested = checkForbiddenFieldNames(val, path);
        if (nested) return nested;
      }
    }
  }
  return null;
}

function hasUnsafeUrlPattern(url) {
  const lower = url.toLowerCase();
  const unsafePatterns = ['token=', 'api_key=', 'apikey=', 'session=', 'secret=', 'password=', 'jwt=', 'bearer='];
  for (const p of unsafePatterns) {
    if (lower.includes(p)) return true;
  }
  return false;
}

function hasUnsafeDraftContent(text) {
  const lower = text.toLowerCase();
  return lower.includes('bearer ') || lower.includes('authorization:');
}

function sanitizeEmotionTags(value) {
  if (Array.isArray(value)) {
    const joined = value.filter(t => typeof t === 'string').join(', ');
    return joined.slice(0, 500);
  }
  if (typeof value === 'string') return normalizeString(value, 500);
  return '';
}

export function validateReviewedPayload(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: { code: 'invalid_payload', message: 'Request body must be a JSON object' } };
  }

  const reviewed = body.reviewed;
  if (!reviewed || typeof reviewed !== 'object') {
    return { ok: false, error: { code: 'invalid_payload', message: 'Payload must contain a reviewed group' } };
  }

  const generatedFallback = body.generated && (!reviewed.sourceLink || !reviewed.memoryDraft);
  if (generatedFallback) {
    return { ok: false, error: { code: 'unreviewed_generated_only', message: 'Generated-only payload rejected. Review and accept before saving.' } };
  }

  const forbiddenInBody = checkForbiddenFieldNames(body);
  if (forbiddenInBody) {
    return { ok: false, error: { code: 'forbidden_content', message: 'Payload contains forbidden field: ' + forbiddenInBody } };
  }

  const forbiddenInReviewed = checkForbiddenFieldNames(reviewed);
  if (forbiddenInReviewed) {
    return { ok: false, error: { code: 'forbidden_content', message: 'Reviewed group contains forbidden field: ' + forbiddenInReviewed } };
  }

  for (const field of REQUIRED_FIELDS) {
    if (typeof reviewed[field] !== 'string' || !reviewed[field].trim()) {
      return { ok: false, error: { code: 'invalid_payload', message: 'Required field \'' + field + '\' is missing or empty' } };
    }
  }

  for (const field of OPTIONAL_FIELDS) {
    if (reviewed[field] !== undefined) {
      const ok = field === 'emotionTags'
        ? Array.isArray(reviewed[field]) || (typeof reviewed[field] === 'string' && reviewed[field].trim())
        : typeof reviewed[field] === 'string' && reviewed[field].trim();
      if (!ok) {
        return { ok: false, error: { code: 'invalid_payload', message: 'Optional field \'' + field + '\' must be a non-empty string (or array for emotionTags) when present' } };
      }
    }
  }

  try {
    new URL(reviewed.sourceLink);
  } catch {
    return { ok: false, error: { code: 'invalid_payload', message: 'sourceLink must be a valid URL' } };
  }

  if (hasUnsafeUrlPattern(reviewed.sourceLink)) {
    return { ok: false, error: { code: 'unsafe_source', message: 'Source link contains credential-like parameters' } };
  }

  if (hasUnsafeDraftContent(reviewed.memoryDraft)) {
    return { ok: false, error: { code: 'forbidden_content', message: 'Memory draft contains authentication-like content' } };
  }

  const s = {};
  s.sourceLink = normalizeString(reviewed.sourceLink, 2048);
  s.sourceLabel = normalizeString(reviewed.sourceLabel, 200);
  s.memoryDraft = normalizeString(reviewed.memoryDraft, 5000);
  if (reviewed.summary) s.summary = normalizeString(reviewed.summary, 1000);
  if (reviewed.translatedSummary) s.translatedSummary = normalizeString(reviewed.translatedSummary, 1000);
  if (reviewed.fanContext) s.fanContext = normalizeString(reviewed.fanContext, 2000);
  if (reviewed.emotionTags !== undefined) s.emotionTags = sanitizeEmotionTags(reviewed.emotionTags);

  return { ok: true, reviewed: s };
}
