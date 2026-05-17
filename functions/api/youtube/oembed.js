const YOUTUBE_OEMBED_ENDPOINT = 'https://www.youtube.com/oembed';
const MAX_INPUT_URL_LENGTH = 2048;
const MAX_CHANNEL_NAME_LENGTH = 200;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      ...extraHeaders
    }
  });
}

function normalizeYouTubeHost(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/^m\./, '');
}

function isAllowedYouTubeHost(hostname) {
  const host = normalizeYouTubeHost(hostname);
  return host === 'youtube.com' || host === 'youtu.be';
}

function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url.trim());
    const host = normalizeYouTubeHost(parsed.hostname);
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return /^[0-9A-Za-z_-]{11}$/.test(id) ? id : '';
    }
    if (host !== 'youtube.com') return '';
    const watchId = parsed.searchParams.get('v') || '';
    if (/^[0-9A-Za-z_-]{11}$/.test(watchId)) return watchId;
    const segments = parsed.pathname.split('/').filter(Boolean);
    const markerIndex = segments.findIndex((segment) => ['embed', 'shorts', 'live', 'v'].includes(segment));
    const id = markerIndex >= 0 ? (segments[markerIndex + 1] || '') : '';
    return /^[0-9A-Za-z_-]{11}$/.test(id) ? id : '';
  } catch (e) {
    return '';
  }
}

function isSafeYouTubeChannelPath(pathname) {
  const path = String(pathname || '').trim();
  return /^\/@[0-9A-Za-z._-]{3,100}$/.test(path) ||
    /^\/channel\/UC[0-9A-Za-z_-]{10,100}$/.test(path);
}

function sanitizeYouTubeChannelUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url.trim());
    const host = normalizeYouTubeHost(parsed.hostname);
    if (parsed.protocol !== 'https:' || host !== 'youtube.com') return '';
    if (!isSafeYouTubeChannelPath(parsed.pathname)) return '';
    parsed.hostname = 'www.youtube.com';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (e) {
    return '';
  }
}

function deriveChannelIdFromUrl(channelUrl) {
  try {
    const parsed = new URL(channelUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments[0] && /^@[0-9A-Za-z._-]{3,100}$/.test(segments[0])) return segments[0];
    if (segments[0] === 'channel' && segments[1] && /^UC[0-9A-Za-z_-]{10,100}$/.test(segments[1])) return segments[1];
  } catch (e) {}
  return null;
}

function normalizeChannelName(value) {
  const name = String(value || '').trim();
  if (!name) return null;
  return name.slice(0, MAX_CHANNEL_NAME_LENGTH);
}

function buildEmptyChannelPayload() {
  return {
    channelId: null,
    channelName: null,
    channelUrl: null
  };
}

export async function onRequestGet(context) {
  const sourceUrl = new URL(context.request.url);
  const rawUrl = String(sourceUrl.searchParams.get('url') || '').trim();

  if (!rawUrl || rawUrl.length > MAX_INPUT_URL_LENGTH) {
    return jsonResponse({ error: 'Invalid YouTube URL' }, 400, { 'cache-control': 'no-store' });
  }

  let parsedInput;
  try {
    parsedInput = new URL(rawUrl);
  } catch (e) {
    return jsonResponse({ error: 'Invalid YouTube URL' }, 400, { 'cache-control': 'no-store' });
  }

  if (parsedInput.protocol !== 'https:' || !isAllowedYouTubeHost(parsedInput.hostname)) {
    return jsonResponse({ error: 'Invalid YouTube URL' }, 400, { 'cache-control': 'no-store' });
  }

  const videoId = extractYouTubeVideoId(rawUrl);
  if (!videoId) {
    return jsonResponse({ error: 'YouTube video ID required' }, 400, { 'cache-control': 'no-store' });
  }

  const oembedUrl = new URL(YOUTUBE_OEMBED_ENDPOINT);
  oembedUrl.searchParams.set('format', 'json');
  oembedUrl.searchParams.set('url', rawUrl);

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(oembedUrl.toString(), {
      headers: { accept: 'application/json' }
    });
  } catch (e) {
    return jsonResponse(buildEmptyChannelPayload(), 200, { 'cache-control': 'no-store' });
  }

  if (!upstreamResponse.ok) {
    return jsonResponse(buildEmptyChannelPayload(), 200, { 'cache-control': 'no-store' });
  }

  let upstreamJson;
  try {
    upstreamJson = await upstreamResponse.json();
  } catch (e) {
    return jsonResponse(buildEmptyChannelPayload(), 200, { 'cache-control': 'no-store' });
  }

  const channelUrl = sanitizeYouTubeChannelUrl(upstreamJson && upstreamJson.author_url);
  const channelName = normalizeChannelName(upstreamJson && upstreamJson.author_name);
  if (!channelUrl || !channelName) {
    return jsonResponse(buildEmptyChannelPayload(), 200, { 'cache-control': 'no-store' });
  }

  return jsonResponse({
    channelId: deriveChannelIdFromUrl(channelUrl),
    channelName,
    channelUrl
  });
}
