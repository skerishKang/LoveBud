'use strict';

/**
 * Public Tree Embed Projection Core — Issue #4098 / parent #4088.
 *
 * Pure projection only. The caller owns canonical public occurrence order and
 * supplies already-authorized Tree/Moment records. This module never sorts,
 * deduplicates, fetches, persists, renders, or performs provider runtime work.
 *
 * Output is a minimal allowlist compatible with the merged #4064 Tree Play
 * Mode queue core. Private/non-public Moments leave no placeholder or other
 * existence signal; dense sourceIndex values are minted only after filtering.
 */

const MAX_START_SECONDS = 12 * 60 * 60;
const MAX_ATTRIBUTION_LENGTH = 200;

const TRUSTED_YOUTUBE_SOURCE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

const TRUSTED_YOUTUBE_THUMBNAIL_HOSTS = new Set([
  'img.youtube.com',
  'i.ytimg.com',
]);

const UNAVAILABLE_REASONS = Object.freeze({
  UNAVAILABLE: 'UNAVAILABLE',
  INVALID_SEGMENT: 'INVALID_SEGMENT',
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function parseSafeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  const explicitScheme = raw.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
  if (explicitScheme && !/^https?:$/i.test(explicitScheme[0])) return null;

  try {
    const parsed = new URL(explicitScheme ? raw : `https://${raw}`);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function normalizeHost(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidYouTubeVideoId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
}

function extractYouTubeVideoId(parsed) {
  if (!parsed || !TRUSTED_YOUTUBE_SOURCE_HOSTS.has(normalizeHost(parsed.hostname))) {
    return null;
  }

  const host = normalizeHost(parsed.hostname);
  const segments = parsed.pathname.split('/').filter(Boolean);
  let videoId = '';

  if (host === 'youtu.be') {
    videoId = segments[0] || '';
  } else if (['embed', 'v', 'shorts', 'live'].includes(segments[0])) {
    videoId = segments[1] || '';
  } else {
    videoId = parsed.searchParams.get('v') || '';
  }

  return isValidYouTubeVideoId(videoId) ? videoId : null;
}

function normalizeYouTubeSource(value) {
  const parsed = parseSafeHttpUrl(value);
  const videoId = extractYouTubeVideoId(parsed);
  if (!videoId) {
    return Object.freeze({ valid: false, provider: null, mediaId: null, sourceUrl: '' });
  }

  return Object.freeze({
    valid: true,
    provider: 'youtube',
    mediaId: videoId,
    sourceUrl: `https://www.youtube.com/embed/${videoId}`,
  });
}

function extractThumbnailVideoId(parsed) {
  if (!parsed || !TRUSTED_YOUTUBE_THUMBNAIL_HOSTS.has(normalizeHost(parsed.hostname))) {
    return null;
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'vi') return null;
  const candidate = segments[1] || '';
  return isValidYouTubeVideoId(candidate) ? candidate : null;
}

function normalizeThumbnail(value, mediaId) {
  if (!mediaId || typeof value !== 'string' || !value.trim()) return null;
  const parsed = parseSafeHttpUrl(value);
  const thumbnailMediaId = extractThumbnailVideoId(parsed);
  if (!thumbnailMediaId || thumbnailMediaId !== mediaId) return null;
  return `https://i.ytimg.com/vi/${mediaId}/hqdefault.jpg`;
}

function normalizeAttribution(moment) {
  const candidates = [
    moment.sourceAttribution,
    moment.source,
    moment.channelName,
    moment.artist,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim();
    if (!normalized) continue;
    return normalized.slice(0, MAX_ATTRIBUTION_LENGTH);
  }
  return null;
}

function normalizeStartSeconds(value) {
  if (value === null || value === undefined || value === '') {
    return Object.freeze({ valid: true, value: null });
  }
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
    return Object.freeze({ valid: false, value: null });
  }
  if (value < 0 || value > MAX_START_SECONDS) {
    return Object.freeze({ valid: false, value: null });
  }
  return Object.freeze({ valid: true, value });
}

function projectTree(tree) {
  if (!isPlainObject(tree) || tree.visibility !== 'public') return null;
  if (typeof tree.id !== 'string' || !tree.id.trim()) return null;

  const projected = {
    id: tree.id.trim(),
    title: typeof tree.title === 'string' ? tree.title : '',
  };

  if (Number.isSafeInteger(tree.memoryCount) && tree.memoryCount >= 0) {
    projected.memoryCount = tree.memoryCount;
  }

  return Object.freeze(projected);
}

function projectOccurrence(moment, sourceIndex) {
  const media = normalizeYouTubeSource(moment.sourceUrl);
  const start = normalizeStartSeconds(moment.startSeconds);
  const playable = media.valid && start.valid;
  const unavailableReason = playable
    ? null
    : (media.valid ? UNAVAILABLE_REASONS.INVALID_SEGMENT : UNAVAILABLE_REASONS.UNAVAILABLE);

  const projected = {
    title: typeof moment.title === 'string' ? moment.title : '',
    provider: media.provider,
    mediaId: media.mediaId,
    sourceUrl: media.sourceUrl,
    startSeconds: start.value,
    endSeconds: null,
    sourceIndex,
    playable,
    unavailableReason,
  };

  const thumbnail = media.valid ? normalizeThumbnail(moment.thumbnail, media.mediaId) : null;
  if (thumbnail) projected.thumbnail = thumbnail;

  const sourceAttribution = normalizeAttribution(moment);
  if (sourceAttribution) projected.sourceAttribution = sourceAttribution;

  return Object.freeze(projected);
}

function projectPublicTreeEmbed(tree, moments) {
  const projectedTree = projectTree(tree);
  if (!projectedTree) return null;

  const inputMoments = Array.isArray(moments) ? moments : [];
  const occurrences = [];

  for (let i = 0; i < inputMoments.length; i += 1) {
    const moment = inputMoments[i];
    if (!isPlainObject(moment) || moment.visibility !== 'public') continue;
    occurrences.push(projectOccurrence(moment, occurrences.length));
  }

  Object.freeze(occurrences);
  return Object.freeze({ tree: projectedTree, occurrences });
}

module.exports = Object.freeze({
  MAX_START_SECONDS,
  UNAVAILABLE_REASONS,
  projectPublicTreeEmbed,
});
