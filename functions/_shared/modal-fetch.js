export const MODAL_FETCH_TIMEOUT_MS = 25_000;

export async function fetchModalWithTimeout(url, options = {}, runtime = {}) {
  const fetcher = runtime.fetcher || fetch;
  const timeoutMs = runtime.timeoutMs ?? MODAL_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isModalTimeoutError(error) {
  return !!error && error.name === 'AbortError';
}
