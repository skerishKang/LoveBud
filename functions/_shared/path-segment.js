export const INVALID_PATH_ENCODING_CODE = 'INVALID_PATH_ENCODING';

export class InvalidPathEncodingError extends Error {
  constructor() {
    super('Invalid path encoding');
    this.name = 'InvalidPathEncodingError';
    this.code = INVALID_PATH_ENCODING_CODE;
  }
}

export function normalizeEncodedPathSegment(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  try {
    return encodeURIComponent(decodeURIComponent(trimmed));
  } catch (error) {
    if (error instanceof URIError) {
      throw new InvalidPathEncodingError();
    }
    throw error;
  }
}

export function isInvalidPathEncodingError(error) {
  return error instanceof InvalidPathEncodingError;
}

export function buildInvalidPathEncodingResponse(requestId = null, requestIdHeader = 'x-lovebud-request-id') {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'invalid-path-encoding'
  };
  if (requestId) headers[requestIdHeader] = requestId;

  return new Response(JSON.stringify({ error: 'Invalid path encoding', code: INVALID_PATH_ENCODING_CODE }), {
    status: 400,
    headers
  });
}
