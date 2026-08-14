export const REQUEST_ID_HEADER = 'x-lovebud-request-id';
export const MAX_REQUEST_ID_LENGTH = 80;
export const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export function generateRequestId() {
  return 'req-' + crypto.randomUUID();
}

export function normalizeRequestId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!SAFE_REQUEST_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function getOrCreateRequestId(request) {
  const existingRequestId = normalizeRequestId(request.headers.get(REQUEST_ID_HEADER));
  if (existingRequestId) return existingRequestId;
  return generateRequestId();
}
