import assert from 'node:assert/strict';
import {
  BROWSE_SCHEMA_CAPABILITY_SQL,
  buildDirectNeonBrowseSummaryQuery,
  estimateBrowseStage,
  fetchDirectNeonBrowseSummary,
  normalizeBrowseLimit,
  normalizeBrowseSort,
  normalizeDirectNeonBrowseRow,
  parseBrowseEmotionTags,
} from '../functions/_shared/direct-neon-browse-summary-core.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

check('sort normalization preserves four modes and falls back', () => {
  for (const sort of ['latest', 'popular', 'likes', 'views']) assert.equal(normalizeBrowseSort(sort), sort);
  assert.equal(normalizeBrowseSort('views desc; drop table trees'), 'latest');
  assert.equal(normalizeBrowseSort(null), 'latest');
});

check('limit normalization matches 1..60 clamp', () => {
  assert.equal(normalizeBrowseLimit(undefined), 12);
  assert.equal(normalizeBrowseLimit(0), 12);
  assert.equal(normalizeBrowseLimit(-9), 1);
  assert.equal(normalizeBrowseLimit(61), 60);
  assert.equal(normalizeBrowseLimit('7'), 7);
});

check('latest query preserves public-only and 3+ public-memory boundary', () => {
  const query = buildDirectNeonBrowseSummaryQuery({ sort: 'latest', limit: 12 });
  assert.match(query.text, /WHERE visibility = 'public'/);
  assert.match(query.text, /HAVING count\(\*\) >= 3/);
  assert.match(query.text, /WHERE t\.visibility = 'public'/);
  assert.match(query.text, /ORDER BY t\.created_at DESC/);
  assert.deepEqual([...query.values], [12]);
});

check('popular query uses canonical memory-count ordering', () => {
  const query = buildDirectNeonBrowseSummaryQuery({ sort: 'popular', limit: 12 });
  assert.match(query.text, /ORDER BY c\.memory_count DESC, t\.created_at DESC/);
});

check('likes query uses deterministic social tie-breakers when capability exists', () => {
  const query = buildDirectNeonBrowseSummaryQuery({
    sort: 'likes',
    capabilities: { hasSocialCountsTable: true, hasLikeCountColumn: true },
  });
  assert.equal(query.effectiveSort, 'likes');
  assert.match(query.text, /ORDER BY s\.like_count DESC, t\.updated_at DESC, t\.created_at DESC, t\.id ASC/);
});

check('views query falls back to latest when view capability is missing', () => {
  const query = buildDirectNeonBrowseSummaryQuery({
    sort: 'views',
    capabilities: { hasSocialCountsTable: true, hasLikeCountColumn: true, hasViewCountColumn: false },
  });
  assert.equal(query.sort, 'views');
  assert.equal(query.effectiveSort, 'latest');
  assert.match(query.text, /ORDER BY t\.created_at DESC/);
});

check('views query uses deterministic social tie-breakers when capability exists', () => {
  const query = buildDirectNeonBrowseSummaryQuery({
    sort: 'views',
    capabilities: { hasSocialCountsTable: true, hasLikeCountColumn: true, hasViewCountColumn: true },
  });
  assert.equal(query.effectiveSort, 'views');
  assert.match(query.text, /ORDER BY s\.view_count DESC, t\.updated_at DESC, t\.created_at DESC, t\.id ASC/);
});

check('untrusted sort text never reaches SQL', () => {
  const malicious = 'views DESC; DROP TABLE trees; --';
  const query = buildDirectNeonBrowseSummaryQuery({ sort: malicious, limit: 5 });
  assert.equal(query.effectiveSort, 'latest');
  assert.doesNotMatch(query.text, /DROP TABLE|--/i);
});

check('query never selects owner identity', () => {
  const query = buildDirectNeonBrowseSummaryQuery({ sort: 'latest' });
  assert.doesNotMatch(query.text, /owner_id|ownerId/);
});

check('row normalization matches browse response semantics', () => {
  const row = normalizeDirectNeonBrowseRow({
    id: 'tree-1',
    title: 'Example',
    visibility: 'public',
    created_at: '2026-08-01T00:00:00+00:00',
    updated_at: '2026-08-02T00:00:00+00:00',
    memory_count: 5,
    all_tags: [['joy', 'calm'], ['joy', 'hope']],
    like_count: 4,
    view_count: 9,
    raw_thumbnail: '',
    raw_source_url: 'https://example.invalid/video',
  });
  assert.deepEqual(row, {
    id: 'tree-1',
    title: 'Example',
    visibility: 'public',
    createdAt: '2026-08-01T00:00:00+00:00',
    updatedAt: '2026-08-02T00:00:00+00:00',
    representativeThumbnail: 'https://example.invalid/video',
    memoryCount: 5,
    emotionTags: ['calm', 'hope', 'joy'],
    stage: '최애',
    theme: 'LoveTree',
    timeRange: '',
    representativeMemorySourceUrl: 'https://example.invalid/video',
    likeCount: 4,
    viewCount: 9,
  });
});

check('tag parsing is deterministic and capped', () => {
  assert.deepEqual(parseBrowseEmotionTags([['z', 'a'], '["m","a"]', null, ['b', 'c', 'd']]), ['a', 'b', 'c', 'd', 'm']);
});

check('stage thresholds match canonical browse behavior', () => {
  assert.equal(estimateBrowseStage(0), 'empty');
  assert.equal(estimateBrowseStage(2), '입덕');
  assert.equal(estimateBrowseStage(4), '성장');
  assert.equal(estimateBrowseStage(5), '최애');
});

await (async () => {
  const calls = [];
  const execute = async (text, values) => {
    calls.push({ text, values });
    if (text === BROWSE_SCHEMA_CAPABILITY_SQL) {
      return [{ has_social_counts_table: true, has_like_count_column: true, has_view_count_column: true }];
    }
    return [{
      id: 'tree-2', title: 'Two', visibility: 'public', memory_count: 3,
      all_tags: [['warm']], like_count: 1, view_count: 2,
      raw_thumbnail: 'thumb', raw_source_url: 'source',
      created_at: null, updated_at: null,
    }];
  };
  const rows = await fetchDirectNeonBrowseSummary(execute, { sort: 'views', limit: 3 });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].text, BROWSE_SCHEMA_CAPABILITY_SQL);
  assert.deepEqual(calls[1].values, [3]);
  assert.equal(rows[0].id, 'tree-2');
  assert.equal(rows[0].stage, '성장');
  passed += 1;
  console.log('PASS injected executor path performs capability + data query without network');
})();

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp strict-parity regression (COMP3 #4003)
//
// The direct-Neon Browse path previously serialized `createdAt` / `updatedAt`
// through `@neondatabase/serverless` (JS Date -> Date.toISOString()), producing
// a millisecond `.000Z` form that diverged from the Modal/Python canonical
// DTO microsecond `+00:00` form. The query now casts the columns to `text` so
// the driver returns the raw Postgres textual timestamp, and
// `normalizeDirectNeonTimestamp` normalizes it to the canonical Modal/Python
// `isoformat` form. These checks prove the wire-format parity without any
// fabricated precision.
// ─────────────────────────────────────────────────────────────────────────────

check('timestamp: PG textual microsecond precision preserved and normalized to canonical Modal/Python form', () => {
  const row = normalizeDirectNeonBrowseRow({
    id: 't', visibility: 'public', memory_count: 3,
    created_at: '2026-07-01 12:34:56.123456+00',
    updated_at: '2026-07-01 12:34:56.123456+00',
  });
  assert.equal(row.createdAt, '2026-07-01T12:34:56.123456+00:00');
  assert.equal(row.updatedAt, '2026-07-01T12:34:56.123456+00:00');
});

check('timestamp: createdAt and updatedAt both use the canonical form (parity)', () => {
  const row = normalizeDirectNeonBrowseRow({
    id: 't', visibility: 'public', memory_count: 3,
    created_at: '2026-07-01 09:08:07.000007+00',
    updated_at: '2026-07-01 09:08:07.000007+00',
  });
  assert.equal(row.createdAt, row.updatedAt);
  assert.equal(row.createdAt, '2026-07-01T09:08:07.000007+00:00');
});

check('timestamp: null timestamps normalize to null (no fabricated value)', () => {
  const row = normalizeDirectNeonBrowseRow({
    id: 't', visibility: 'public', memory_count: 3,
    created_at: null, updated_at: null,
  });
  assert.equal(row.createdAt, null);
  assert.equal(row.updatedAt, null);
});

check('timestamp: exact-second value omits fractional part (matches Python isoformat, no fabricated .000000)', () => {
  const row = normalizeDirectNeonBrowseRow({
    id: 't', visibility: 'public', memory_count: 3,
    created_at: '2026-07-01 12:34:56+00',
    updated_at: '2026-07-01 12:34:56+00',
  });
  assert.equal(row.createdAt, '2026-07-01T12:34:56+00:00');
  assert.equal(row.updatedAt, '2026-07-01T12:34:56+00:00');
  assert.doesNotMatch(row.createdAt, /\.\d/);
});

check('timestamp: sub-millisecond digits padded to 6-digit microsecond canonical (no fabrication)', () => {
  const row = normalizeDirectNeonBrowseRow({
    id: 't', visibility: 'public', memory_count: 3,
    created_at: '2026-07-01 12:34:56.123+00',
  });
  assert.equal(row.createdAt, '2026-07-01T12:34:56.123000+00:00');
});

check('timestamp: non-timestamp fields unaffected by timestamp normalization', () => {
  const row = normalizeDirectNeonBrowseRow({
    id: 'tree-9', title: 'Keep', visibility: 'public',
    created_at: '2026-07-01 12:34:56.123456+00',
    updated_at: '2026-07-01 12:34:56.123456+00',
    memory_count: 5, all_tags: [['joy']], like_count: 4, view_count: 9,
    raw_thumbnail: '', raw_source_url: 'https://e.invalid/v',
  });
  assert.equal(row.id, 'tree-9');
  assert.equal(row.title, 'Keep');
  assert.equal(row.memoryCount, 5);
  assert.deepEqual(row.emotionTags, ['joy']);
  assert.equal(row.likeCount, 4);
  assert.equal(row.viewCount, 9);
  assert.equal(row.stage, '최애');
});

check('query: Browse SELECT casts created_at/updated_at to text to preserve raw PG precision at driver boundary', () => {
  const query = buildDirectNeonBrowseSummaryQuery({ sort: 'latest', limit: 12 });
  assert.match(query.text, /t\.created_at::text AS created_at/);
  assert.match(query.text, /t\.updated_at::text AS updated_at/);
  // The ORDER BY still references the real column, not the text cast.
  assert.match(query.text, /ORDER BY t\.created_at DESC/);
});

check('timestamp: already-canonical ISO string is idempotent (no double normalization)', () => {
  const row = normalizeDirectNeonBrowseRow({
    id: 't', visibility: 'public', memory_count: 3,
    created_at: '2026-08-01T00:00:00+00:00',
    updated_at: '2026-08-02T00:00:00+00:00',
  });
  assert.equal(row.createdAt, '2026-08-01T00:00:00+00:00');
  assert.equal(row.updatedAt, '2026-08-02T00:00:00+00:00');
});

check('timestamp: JS Date input fails closed without fabricating microsecond precision', () => {
  // A JS Date has already lost sub-millisecond PostgreSQL precision; presenting
  // it as a canonical six-digit microsecond timestamp would fabricate precision
  // that cannot be proven from the source. The function must fail closed and
  // must not emit a fabricated `.123000+00:00` form.
  const dateValue = new Date('2026-07-01T12:34:56.123Z');
  for (const which of ['created_at', 'updated_at']) {
    const row = {
      id: 't', visibility: 'public', memory_count: 3,
      created_at: '2026-07-01 12:34:56.123456+00',
      updated_at: '2026-07-01 12:34:56.123456+00',
    };
    row[which] = dateValue;
    let caught;
    try {
      normalizeDirectNeonBrowseRow(row);
      assert.fail(`expected ${which} Date input to fail closed`);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof TypeError, 'expected TypeError');
    assert.equal(caught.message, 'DIRECT_NEON_TIMESTAMP_PRECISION_LOST');
    assert.doesNotMatch(caught.message, /\.\d{3,6}\+00:00/);
  }
});

console.log(`DIRECT_NEON_BROWSE_CORE_4003 PASS ${passed}/22`);
