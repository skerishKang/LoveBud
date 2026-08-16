const VALID_SORTS = new Set(['latest', 'popular', 'likes', 'views']);

const ORDER_BY = Object.freeze({
  latest: 't.created_at DESC',
  popular: 'c.memory_count DESC, t.created_at DESC',
  likes: 's.like_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC',
  views: 's.view_count DESC, t.updated_at DESC, t.created_at DESC, t.id ASC',
});

export const BROWSE_SCHEMA_CAPABILITY_SQL = `
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tree_social_counts'
  ) AS has_social_counts_table,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tree_social_counts'
      AND column_name = 'like_count'
  ) AS has_like_count_column,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tree_social_counts'
      AND column_name = 'view_count'
  ) AS has_view_count_column
`;

export function normalizeBrowseSort(rawSort) {
  return VALID_SORTS.has(rawSort) ? rawSort : 'latest';
}

export function normalizeBrowseLimit(rawLimit) {
  const parsed = Number(rawLimit ?? 12);
  const finite = Number.isFinite(parsed) && parsed !== 0 ? parsed : 12;
  return Math.min(Math.max(finite, 1), 60);
}

export function normalizeBrowseCapabilities(raw = {}) {
  return Object.freeze({
    hasSocialCountsTable: raw.hasSocialCountsTable === true,
    hasLikeCountColumn: raw.hasLikeCountColumn === true,
    hasViewCountColumn: raw.hasViewCountColumn === true,
  });
}

function buildSocialCountsSource(capabilities) {
  const { hasSocialCountsTable, hasLikeCountColumn, hasViewCountColumn } = capabilities;
  if (!hasSocialCountsTable || (!hasLikeCountColumn && !hasViewCountColumn)) {
    return '(SELECT NULL::text AS tree_id, 0::bigint AS like_count, 0::bigint AS view_count WHERE FALSE)';
  }
  if (hasLikeCountColumn && hasViewCountColumn) {
    return '(SELECT tree_id::text AS tree_id, like_count, view_count FROM tree_social_counts)';
  }
  if (hasLikeCountColumn) {
    return '(SELECT tree_id::text AS tree_id, like_count, 0::bigint AS view_count FROM tree_social_counts)';
  }
  return '(SELECT tree_id::text AS tree_id, 0::bigint AS like_count, view_count FROM tree_social_counts)';
}

function resolveEffectiveSort(sort, capabilities) {
  if (sort === 'likes' && !(capabilities.hasSocialCountsTable && capabilities.hasLikeCountColumn)) {
    return 'latest';
  }
  if (sort === 'views' && !(capabilities.hasSocialCountsTable && capabilities.hasViewCountColumn)) {
    return 'latest';
  }
  return sort;
}

export function buildDirectNeonBrowseSummaryQuery({ sort, limit, capabilities } = {}) {
  const normalizedSort = normalizeBrowseSort(sort);
  const normalizedLimit = normalizeBrowseLimit(limit);
  const normalizedCapabilities = normalizeBrowseCapabilities(capabilities);
  const effectiveSort = resolveEffectiveSort(normalizedSort, normalizedCapabilities);
  const orderClause = ORDER_BY[effectiveSort];
  const socialCountsSource = buildSocialCountsSource(normalizedCapabilities);

  const text = `
SELECT
  t.id,
  t.title,
  t.visibility,
  t.created_at::text AS created_at,
  t.updated_at::text AS updated_at,
  c.memory_count,
  c.all_tags,
  COALESCE(s.like_count, 0) AS like_count,
  COALESCE(s.view_count, 0) AS view_count,
  m.thumbnail AS raw_thumbnail,
  m.source_url AS raw_source_url
FROM trees t
INNER JOIN (
  SELECT
    tree_id,
    count(*) AS memory_count,
    jsonb_agg(emotion_tags) AS all_tags
  FROM memories
  WHERE visibility = 'public'
  GROUP BY tree_id
  HAVING count(*) >= 3
) c ON t.id = c.tree_id
LEFT JOIN ${socialCountsSource} s ON t.id::text = s.tree_id
LEFT JOIN LATERAL (
  SELECT thumbnail, source_url
  FROM memories
  WHERE tree_id = t.id
    AND visibility = 'public'
    AND (NULLIF(thumbnail, '') IS NOT NULL OR NULLIF(source_url, '') IS NOT NULL)
  ORDER BY created_at DESC
  LIMIT 1
) m ON TRUE
WHERE t.visibility = 'public'
ORDER BY ${orderClause}
LIMIT $1
`;

  return Object.freeze({
    text,
    values: Object.freeze([normalizedLimit]),
    sort: normalizedSort,
    effectiveSort,
    limit: normalizedLimit,
    capabilities: normalizedCapabilities,
  });
}

// Normalize a Postgres timestamp value into the canonical Modal/Python
// `isoformat` wire form used by the canonical Browse DTO:
//   'YYYY-MM-DDTHH:MM:SS[.ffffff][+HH:MM]'
//
// Why this exists: the `@neondatabase/serverless` HTTP driver materializes
// `timestamp` / `timestamptz` columns as JS `Date` objects at the driver
// boundary, which discards sub-millisecond precision and emits a millisecond
// `.000Z` form via `Date.toISOString()`. To preserve strict wire parity with
// the Modal/Python canonical DTO (which keeps full microsecond precision and a
// `+HH:MM` UTC offset), the Browse query casts `created_at` / `updated_at` to
// `text` so the driver returns the raw Postgres textual representation (e.g.
// `2026-07-01 12:34:56.123456+00`). This function converts that textual form
// into the canonical Modal/Python form.
//
// Rules (no fabricated precision):
//   - null / undefined => null
//   - already-canonical ISO strings are returned unchanged (idempotent)
//   - sub-second digits are padded to 6 (microsecond) to match
//     `datetime.isoformat()`; this is canonical, not fabricated, because e.g.
//     `.123` === 123000us === `.123000`.
//   - when microsecond == 0 the fractional part is omitted entirely, exactly
//     like `datetime.isoformat()` (never emit `.000000`).
//   - offset is normalized to `+HH:MM` (or `-HH:MM`); `Z` => `+00:00`.
function normalizeDirectNeonTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    // Defensive fallback only. The Browse query casts the column to text, so the
    // driver should never hand us a Date in production; a Date has already lost
    // sub-millisecond precision, so this path cannot preserve it.
    return normalizeDirectNeonTimestamp(value.toISOString());
  }
  if (typeof value !== 'string') return String(value);

  const text = value.trim();
  // Separate a trailing offset: +HH, +HH:MM, -HH, -HH:MM, or Z.
  const offsetMatch = text.match(/([+-]\d{2}(?::?\d{2})?|Z)$/);
  let offset = '';
  let body = text;
  if (offsetMatch) {
    offset = offsetMatch[1];
    body = text.slice(0, offsetMatch.index);
  }
  // Normalize date/time separator (PG uses a space, ISO uses T).
  body = body.replace(' ', 'T');
  // Normalize fractional seconds to 6-digit microseconds (canonical).
  body = body.replace(/(\.\d+)$/, (m) => {
    const digits = m.slice(1);
    return '.' + (digits + '000000').slice(0, 6);
  });
  // Normalize offset to +HH:MM (or -HH:MM). No offset (naive `timestamp`) is
  // left undecorated to match a naive Modal `isoformat` and to avoid fabricating
  // a timezone. The timestamptz columns used here always carry an offset.
  let normalizedOffset;
  if (offset === 'Z') {
    normalizedOffset = '+00:00';
  } else if (offset) {
    const sign = offset[0];
    const rest = offset.slice(1);
    normalizedOffset = rest.includes(':') ? offset : `${sign}${rest}:00`;
  } else {
    normalizedOffset = '';
  }
  return body + normalizedOffset;
}

export function estimateBrowseStage(memoryCount) {
  const count = Number(memoryCount) || 0;
  if (count <= 0) return 'empty';
  if (count <= 2) return '입덕';
  if (count <= 4) return '성장';
  return '최애';
}

export function parseBrowseEmotionTags(allTagsRaw) {
  if (!Array.isArray(allTagsRaw)) return [];
  const unique = new Set();
  for (const raw of allTagsRaw) {
    if (!raw) continue;
    let tags = raw;
    if (typeof raw === 'string') {
      try {
        tags = JSON.parse(raw);
      } catch {
        tags = [raw];
      }
    }
    if (!Array.isArray(tags)) continue;
    for (const tag of tags) {
      if (tag) unique.add(String(tag));
    }
  }
  return [...unique].sort().slice(0, 5);
}

export function normalizeDirectNeonBrowseRow(row = {}) {
  const memoryCount = Number(row.memory_count ?? 0) || 0;
  const rawThumbnail = row.raw_thumbnail || '';
  const rawSourceUrl = row.raw_source_url || '';
  const result = {
    id: String(row.id ?? ''),
    title: row.title || '나의 Lovetree',
    visibility: row.visibility || 'public',
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
    representativeThumbnail: rawThumbnail || rawSourceUrl || '',
    memoryCount,
    emotionTags: parseBrowseEmotionTags(row.all_tags),
    stage: estimateBrowseStage(memoryCount),
    theme: 'LoveTree',
    timeRange: '',
    representativeMemorySourceUrl: rawSourceUrl,
    likeCount: Number(row.like_count ?? 0) || 0,
  };
  if (row.view_count != null) {
    result.viewCount = Number(row.view_count) || 0;
  }
  return result;
}

export async function readDirectNeonBrowseCapabilities(executeQuery) {
  if (typeof executeQuery !== 'function') throw new TypeError('executeQuery must be a function');
  const rows = await executeQuery(BROWSE_SCHEMA_CAPABILITY_SQL, []);
  const row = Array.isArray(rows) && rows.length ? rows[0] : {};
  return normalizeBrowseCapabilities({
    hasSocialCountsTable: row.has_social_counts_table === true,
    hasLikeCountColumn: row.has_like_count_column === true,
    hasViewCountColumn: row.has_view_count_column === true,
  });
}

export async function fetchDirectNeonBrowseSummary(executeQuery, options = {}) {
  if (typeof executeQuery !== 'function') throw new TypeError('executeQuery must be a function');
  const capabilities = options.capabilities
    ? normalizeBrowseCapabilities(options.capabilities)
    : await readDirectNeonBrowseCapabilities(executeQuery);
  const query = buildDirectNeonBrowseSummaryQuery({
    sort: options.sort,
    limit: options.limit,
    capabilities,
  });
  const rows = await executeQuery(query.text, [...query.values]);
  if (!Array.isArray(rows)) throw new TypeError('Browse query must return an array of rows');
  return rows.map(normalizeDirectNeonBrowseRow);
}
