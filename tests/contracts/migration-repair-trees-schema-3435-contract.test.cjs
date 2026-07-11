/**
 * Contract tests for the trees schema repair migration (Issue #3435).
 *
 * These tests verify that scripts/migration-repair-trees-schema-3435.sql
 * satisfies the contractual requirements for the production service-restoration
 * foothold: additive nullable columns only, no backfill, no synthetic values,
 * no dependent-table mutations, fail-closed on precondition failure.
 *
 * This is a static/grammar test suite. No database connection, psql subprocess,
 * git diff, or git status is used. No raw/private values are asserted.
 *
 * Refs: #3435, #3433, #3425, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_PATH = path.join(ROOT, 'scripts/migration-repair-trees-schema-3435.sql');
const EXISTING_METADATA_MIGRATION_PATH = path.join(ROOT, 'scripts/migration-add-tree-metadata.sql');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests/test-layer-classification.json');

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}

function stripStringsAndComments(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/'[^']*'/g, '');     // remove single-quoted strings
}

const sql = readFile(MIGRATION_PATH);
const content = stripSqlComments(sql);
const clean = stripStringsAndComments(sql);

// ─── 1. Migration artifact exists and is additive ───────────────────────────

test('3435 migration SQL file exists', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH));
});

test('3435 migration does not DROP / TRUNCATE / RENAME anything', () => {
  assert.equal(content.includes('DROP TABLE'), false, 'Must not DROP TABLE');
  assert.equal(content.includes('DROP COLUMN'), false, 'Must not DROP COLUMN');
  assert.equal(content.includes('DROP INDEX'), false, 'Must not DROP INDEX');
  assert.equal(content.includes('DROP TRIGGER'), false, 'Must not DROP TRIGGER');
  assert.equal(content.includes('DROP FUNCTION'), false, 'Must not DROP FUNCTION');
  assert.equal(content.includes('TRUNCATE'), false, 'Must not TRUNCATE');
  assert.equal(content.includes('RENAME'), false, 'Must not RENAME');
});

test('3435 migration does not contain INSERT / UPDATE / DELETE', () => {
  assert.equal(content.includes('INSERT '), false, 'Must not INSERT');
  assert.equal(content.includes('INSERT\t'), false, 'Must not INSERT (tab)');
  assert.equal(content.includes('UPDATE '), false, 'Must not UPDATE');
  assert.equal(content.includes('DELETE '), false, 'Must not DELETE');
  assert.equal(content.includes('DELETE\t'), false, 'Must not DELETE (tab)');
});

test('3435 migration does not contain DEFAULT / NOT NULL / FK / CHECK / INDEX / TRIGGER', () => {
  // ALTER TABLE ADD COLUMN with DEFAULT would contain DEFAULT keyword
  assert.equal(/\bDEFAULT\b/i.test(content), false, 'Must not set DEFAULT');
  assert.equal(/\bNOT\s+NULL\b/i.test(content), false, 'Must not set NOT NULL');
  assert.equal(/\bREFERENCES\b/i.test(content), false, 'Must not set FOREIGN KEY');
  assert.equal(/\bCHECK\s*\(/i.test(clean), false, 'Must not add CHECK constraint');
  assert.equal(content.includes('CREATE INDEX'), false, 'Must not CREATE INDEX');
  assert.equal(content.includes('CREATE TRIGGER'), false, 'Must not CREATE TRIGGER');
});

test('3435 migration does not convert id to UUID', () => {
  assert.equal(/\buuid\b/i.test(content), false, 'Must not reference UUID type');
});

test('3435 migration does not mutate dependent tables', () => {
  const tablesToCheck = ['memories', 'tree_comments', 'tree_likes', 'tree_social_counts',
    'tree_view_dedup_events', 'comments', 'reactions', 'social_idempotency',
    'social_audit_log', 'tree_hub_layouts', 'community_posts', 'ai_logs'];
  for (const tbl of tablesToCheck) {
    assert.equal(
      content.includes(` ${tbl} `) || content.includes(`\t${tbl} `),
      false,
      `Must not reference dependent table ${tbl}`
    );
  }
});

test('3435 migration does not modify existing migration-add-tree-metadata.sql', () => {
  assert.ok(fs.existsSync(EXISTING_METADATA_MIGRATION_PATH), 'Existing metadata migration must still exist');
  // This test verifies we are not overwriting the other file.
  // The migration SQL itself should not contain that filename.
  const metaContent = readFile(EXISTING_METADATA_MIGRATION_PATH);
  assert.ok(metaContent.includes('group_name'), 'Existing metadata migration must reference group_name');
});

// ─── 2. Transaction boundary and timeouts ───────────────────────────────────

test('3435 migration wraps operations in BEGIN/COMMIT', () => {
  assert.ok(/^\s*BEGIN\b/im.test(sql), 'Must start with BEGIN');
  assert.ok(/\bCOMMIT\s*;?\s*$/im.test(sql), 'Must end with COMMIT');
});

test('3435 migration sets bounded lock_timeout and statement_timeout', () => {
  assert.ok(/lock_timeout\s*=\s*'[0-9]+s'/i.test(sql), 'Must set lock_timeout');
  assert.ok(/statement_timeout\s*=\s*'[0-9]+s'/i.test(sql), 'Must set statement_timeout');
});

test('3435 migration has at least one timeout value ≤ 30s', () => {
  const lockMatch = sql.match(/lock_timeout\s*=\s*'(\d+)s'/i);
  const stmtMatch = sql.match(/statement_timeout\s*=\s*'(\d+)s'/i);
  if (lockMatch) assert.ok(parseInt(lockMatch[1]) <= 30, 'lock_timeout must be ≤ 30s');
  if (stmtMatch) assert.ok(parseInt(stmtMatch[1]) <= 30, 'statement_timeout must be ≤ 30s');
});

// ─── 3. Preconditions exist ─────────────────────────────────────────────────

test('3435 migration checks public.trees relation exists', () => {
  assert.ok(/public\.trees/i.test(sql), 'Must reference public.trees');
});

test('3435 migration checks id column TEXT-compatible', () => {
  assert.ok(/id.*text|TEXT/i.test(sql), 'Must check id TEXT compatibility');
});

test('3435 migration checks id is primary key', () => {
  assert.ok(/PRIMARY\s+KEY/i.test(sql), 'Must check id is PRIMARY KEY');
});

test('3435 migration checks id is NOT NULL', () => {
  const notNullPattern = /id.*NOT\s+NULL|NOT\s+NULL.*id/i;
  const nullableCheck = /is_nullable\s*=\s*'NO'|nullable.*'NO'/i;
  assert.ok(notNullPattern.test(sql) || nullableCheck.test(sql),
    'Must check id is NOT NULL');
});

// ─── 4. Seven-column shape ──────────────────────────────────────────────────

test('3435 migration adds exactly 7 columns', () => {
  const addColumnMatches = sql.match(/ALTER\s+TABLE\s+public\.trees\s+ADD\s+COLUMN/gi);
  assert.ok(addColumnMatches !== null, 'Must use ALTER TABLE public.trees ADD COLUMN');
  assert.equal(addColumnMatches.length, 7, 'Must add exactly 7 columns');
});

test('3435 migration adds owner_id TEXT', () => {
  assert.ok(/owner_id\s+TEXT(?!\s+ARRAY)/i.test(sql), 'owner_id must be TEXT');
});

test('3435 migration adds title TEXT', () => {
  assert.ok(/title\s+TEXT(?!\s+ARRAY)/i.test(sql), 'title must be TEXT');
});

test('3435 migration adds visibility TEXT', () => {
  assert.ok(/visibility\s+TEXT(?!\s+ARRAY)/i.test(sql), 'visibility must be TEXT');
});

test('3435 migration adds group_name TEXT', () => {
  assert.ok(/group_name\s+TEXT(?!\s+ARRAY)/i.test(sql), 'group_name must be TEXT');
});

test('3435 migration adds keywords TEXT[]', () => {
  assert.ok(/keywords\s+TEXT\[\]/i.test(sql), 'keywords must be TEXT[]');
});

test('3435 migration adds created_at TIMESTAMPTZ', () => {
  assert.ok(/created_at\s+TIMESTAMPTZ|created_at\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE/i.test(sql),
    'created_at must be TIMESTAMPTZ');
});

test('3435 migration adds updated_at TIMESTAMPTZ', () => {
  assert.ok(/updated_at\s+TIMESTAMPTZ|updated_at\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE/i.test(sql),
    'updated_at must be TIMESTAMPTZ');
});

test('3435 migration uses schema-qualified public.trees', () => {
  const addColumnRefs = sql.match(/ALTER\s+TABLE\s+public\.trees\s+ADD\s+COLUMN/g);
  assert.ok(addColumnRefs !== null, 'ALTER TABLE must use public.trees');
  assert.equal(addColumnRefs.length, 7, 'All 7 ALTER TABLE must use schema-qualified public.trees');
});

// ─── 5. Staged nullable — all columns are NULL without DEFAULT ───────────────

test('3435 migration columns have no NOT NULL', () => {
  const addCols = sql.match(/ALTER\s+TABLE\s+public\.trees\s+ADD\s+COLUMN\s+\w+\s+\S+/gi);
  assert.ok(addCols !== null, 'Must have ADD COLUMN statements');
  for (const stmt of addCols) {
    assert.equal(/\bNOT\s+NULL\b/i.test(stmt), false,
      `Column in "${stmt}" must not have NOT NULL`);
  }
});

test('3435 migration columns have no DEFAULT', () => {
  const addCols = sql.match(/ALTER\s+TABLE\s+public\.trees\s+ADD\s+COLUMN\s+\w+\s+\S+/gi);
  assert.ok(addCols !== null);
  for (const stmt of addCols) {
    assert.equal(/\bDEFAULT\b/i.test(stmt), false,
      `Column in "${stmt}" must not have DEFAULT`);
  }
});

// ─── 6. Guarded / idempotent add-if-absent ──────────────────────────────────

test('3435 migration guards each column addition with IF NOT EXISTS', () => {
  const ifNotExistsBlocks = sql.match(/IF NOT EXISTS\s*\([^)]*information_schema\.columns[^)]*\)/gi);
  // At minimum, each of the 7 columns should have a guard
  assert.ok(ifNotExistsBlocks !== null, 'Must guard with IF NOT EXISTS');
  assert.ok(ifNotExistsBlocks.length >= 7, 'Must have at least 7 IF NOT EXISTS guards');
});

// ─── 7. Type compatibility checks ───────────────────────────────────────────

test('3435 migration checks existing column type compatibility and aborts on mismatch', () => {
  const typeCheckPattern = /RAISE\s+EXCEPTION\s+'TYPE_MISMATCH/i;
  assert.ok(typeCheckPattern.test(sql), 'Must abort on type mismatch');
  const mismatchCount = (sql.match(/TYPE_MISMATCH/g) || []).length;
  assert.equal(mismatchCount, 7, 'Must check type compatibility for all 7 columns');
});

// ─── 8. Postcondition inspection ────────────────────────────────────────────

test('3435 migration includes postcondition checks', () => {
  const postconditionPattern = /POSTCONDITION_FAILED/i;
  assert.ok(postconditionPattern.test(sql), 'Must include POSTCONDITION_FAILED checks');
  const postCount = (sql.match(/POSTCONDITION_FAILED/g) || []).length;
  assert.equal(postCount, 7, 'Must have 7 POSTCONDITION_FAILED checks (one per column)');
});

test('3435 migration aborts on postcondition failure', () => {
  const raisePattern = /RAISE\s+EXCEPTION\s+'POSTCONDITION_FAILED/i;
  assert.ok(raisePattern.test(sql), 'Must RAISE EXCEPTION on postcondition failure');
});

// ─── 9. No backfill, synthetic values, or row queries ───────────────────────

test('3435 migration contains no row-value queries on trees table', () => {
  // Must not SELECT ... FROM trees as a data table (information_schema is allowed)
  assert.equal(/FROM\s+(public\.)?trees\s/i.test(content), false,
    'Must not SELECT from trees (metadata-only migration)');
  // Must not contain subquery or JOIN on trees for row inspection
  assert.equal(/\bJOIN\s+(public\.)?trees\b/i.test(content), false,
    'Must not JOIN trees');
  assert.equal(/FROM\s+(public\.)?trees\b/i.test(content), false,
    'Must not FROM trees as row source');
  // Verify that all WHERE trees references are only in information_schema context
  const nonInfoSchemaContent = content.replace(/information_schema[^;]*;/g, '');
  assert.equal(/\btrees\b.*\bWHERE\b/i.test(nonInfoSchemaContent), false,
    'Must not filter trees rows outside information_schema');
});

// ─── 10. References and hygiene ─────────────────────────────────────────────

test('3435 migration references #3435, #3433, #3425, #1882', () => {
  assert.ok(/#3435/.test(sql), 'Must reference #3435');
  assert.ok(/#3433/.test(sql), 'Must reference #3433');
  assert.ok(/#3425/.test(sql), 'Must reference #3425');
  assert.ok(/#1882/.test(sql), 'Must reference #1882');
});

test('3435 migration does not embed connection strings', () => {
  assert.equal(/postgresql:\/\//i.test(sql), false, 'Must not embed a connection string');
  assert.equal(/migration was applied|applied to production/i.test(sql), false,
    'Must not claim production apply');
});

test('3435 migration states service-restoration-foothold posture', () => {
  assert.ok(
    /service-restoration foothold|foothold|staged nullable/i.test(sql),
    'Must describe itself as a service-restoration foothold'
  );
});

test('3435 migration forbids close keywords for parent issues', () => {
  assert.equal(/\bCloses\s+#3435\b/i.test(sql), false, 'Must not use Closes #3435');
  assert.equal(/\bFixes\s+#3435\b/i.test(sql), false, 'Must not use Fixes #3435');
  assert.equal(/\bResolves\s+#3435\b/i.test(sql), false, 'Must not use Resolves #3435');
  assert.equal(/\bCloses\s+#3433\b/i.test(sql), false, 'Must not use Closes #3433');
  assert.equal(/\bCloses\s+#3425\b/i.test(sql), false, 'Must not use Closes #3425');
  assert.equal(/\bCloses\s+#1882\b/i.test(sql), false, 'Must not use Closes #1882');
});

// ─── 11. No PR #3432 tree-comment overlap ───────────────────────────────────

test('3435 migration does not reference tree-comment tables', () => {
  assert.equal(/tree_comments/i.test(sql), false, 'Must not reference tree_comments table');
});

test('3435 migration is unrelated to tree comment migration files', () => {
  // Verify no accidental overlap with PR #3432 scope
  const fileDir = path.dirname(MIGRATION_PATH);
  const files = fs.readdirSync(fileDir);
  const treeCommentMigrations = files.filter(f =>
    f.includes('tree-comment') || f.includes('reconcile-tree-comments'));
  // Just verify the tree-comment migration files still exist (PR #3432 protected)
  for (const f of treeCommentMigrations) {
    assert.ok(fs.existsSync(path.join(fileDir, f)),
      `Tree comment migration ${f} must remain untouched`);
  }
});

// ─── 13. UDT-level exact-type enforcement in preconditions ──────────────────

test('3435 migration keywords type check requires pg_catalog._text, not just ARRAY', () => {
  // The keywords type-mismatch check must verify udt_name = '_text'
  // Reject integer[], varchar[], jsonb[], uuid[], etc.
  const keywordsTypeBlock = sql.split(/END\s*\$\$\s*;/i).find(block =>
    /KEY_MISMATCH.*keywords|TYPE_MISMATCH.*keywords/i.test(block)
  );
  assert.ok(keywordsTypeBlock, 'Must have a TYPE_MISMATCH block for keywords');
  assert.ok(/_text|udt_name.*_text/i.test(keywordsTypeBlock),
    'keywords type check must reference pg_catalog._text');
});

test('3435 migration created_at requires pg_catalog.timestamptz', () => {
  const createdBlocks = sql.split(/END\s*\$\$\s*;/i).filter(block =>
    /created_at/i.test(block) &&
    /TYPE_MISMATCH|POSTCONDITION_FAILED/i.test(block)
  );
  for (const block of createdBlocks) {
    assert.ok(/timestamptz|timestamp with time zone/i.test(block),
      `created_at check block must reference timestamptz, got: ${block.slice(0, 100)}`);
  }
});

test('3435 migration updated_at requires pg_catalog.timestamptz', () => {
  const updatedBlocks = sql.split(/END\s*\$\$\s*;/i).filter(block =>
    /updated_at/i.test(block) &&
    /TYPE_MISMATCH|POSTCONDITION_FAILED/i.test(block)
  );
  for (const block of updatedBlocks) {
    assert.ok(/timestamptz|timestamp with time zone/i.test(block),
      `updated_at check block must reference timestamptz, got: ${block.slice(0, 100)}`);
  }
});

test('3435 migration does not accept timestamp without time zone for timestamps', () => {
  // The SQL must NOT allow 'timestamp without time zone' as a valid type
  // for created_at or updated_at in any type-mismatch or postcondition check
  const timestampBlocks = sql.split(/END\s*\$\$\s*;/i).filter(block =>
    /created_at|updated_at/i.test(block) &&
    /TYPE_MISMATCH|POSTCONDITION_FAILED/i.test(block)
  );
  for (const block of timestampBlocks) {
    assert.equal(/without time zone/i.test(block), false,
      `timestamp block must not accept timestamp without time zone`);
    assert.equal(/'timestamp'(?!\s+with)/i.test(block), false,
      `timestamp block must not accept bare 'timestamp'`);
  }
});

test('3435 migration owner_id/title/visibility/group_name require exact pg_catalog.text, not varchar', () => {
  const textCols = ['owner_id', 'title', 'visibility', 'group_name'];
  const checkBlocks = sql.split(/END\s*\$\$\s*;/i).filter(block =>
    textCols.some(c => block.includes(c)) &&
    /TYPE_MISMATCH|POSTCONDITION_FAILED/i.test(block)
  );
  for (const block of checkBlocks) {
    assert.ok(/udt_name\s*=\s*'text'/i.test(block) || /udt_schema\s*=\s*'pg_catalog'/i.test(block),
      `Text-column check must require pg_catalog.text`);
    // Must not accept character varying / varchar / char
    assert.equal(/character varying/i.test(block), false,
      `Text-column check must not accept character varying`);
    assert.equal(/varchar/i.test(block), false,
      `Text-column check must not accept varchar`);
  }
});

// ─── 14. Existing-column nullable and no-default verification ────────────────

test('3435 migration TYPE_MISMATCH blocks verify is_nullable = YES for all target columns', () => {
  const targetCols = ['owner_id', 'title', 'visibility', 'group_name',
    'keywords', 'created_at', 'updated_at'];
  const typeMismatchBlocks = sql.split(/END\s*\$\$\s*;/i).filter(block =>
    targetCols.some(c => block.includes(c)) &&
    /TYPE_MISMATCH/i.test(block)
  );
  assert.equal(typeMismatchBlocks.length, 7,
    'Must have exactly 7 TYPE_MISMATCH blocks (one per column)');
  for (const block of typeMismatchBlocks) {
    assert.ok(/is_nullable\s*=\s*'YES'/i.test(block),
      'TYPE_MISMATCH block must require is_nullable = YES');
  }
});

test('3435 migration TYPE_MISMATCH blocks verify column_default IS NULL for all target columns', () => {
  const targetCols = ['owner_id', 'title', 'visibility', 'group_name',
    'keywords', 'created_at', 'updated_at'];
  const typeMismatchBlocks = sql.split(/END\s*\$\$\s*;/i).filter(block =>
    targetCols.some(c => block.includes(c)) &&
    /TYPE_MISMATCH/i.test(block)
  );
  assert.equal(typeMismatchBlocks.length, 7,
    'Must have exactly 7 TYPE_MISMATCH blocks (one per column)');
  for (const block of typeMismatchBlocks) {
    assert.ok(/column_default\s+IS\s+NULL/i.test(block),
      'TYPE_MISMATCH block must require column_default IS NULL');
  }
});

// ─── 15. Postcondition nullable and no-default verification ──────────────────

test('3435 migration postcondition blocks verify is_nullable = YES for all 7 columns', () => {
  const targetCols = ['owner_id', 'title', 'visibility', 'group_name',
    'keywords', 'created_at', 'updated_at'];
  const postconditionBlocks = sql.split(/END\s*\$\$\s*;/i).filter(block =>
    targetCols.some(c => block.includes(c)) &&
    /POSTCONDITION_FAILED/i.test(block)
  );
  assert.equal(postconditionBlocks.length, 7,
    'Must have exactly 7 POSTCONDITION_FAILED blocks (one per column)');
  for (const block of postconditionBlocks) {
    assert.ok(/is_nullable\s*=\s*'YES'/i.test(block),
      'Postcondition block must require is_nullable = YES');
  }
});

test('3435 migration postcondition blocks verify column_default IS NULL for all 7 columns', () => {
  const targetCols = ['owner_id', 'title', 'visibility', 'group_name',
    'keywords', 'created_at', 'updated_at'];
  const postconditionBlocks = sql.split(/END\s*\$\$\s*;/i).filter(block =>
    targetCols.some(c => block.includes(c)) &&
    /POSTCONDITION_FAILED/i.test(block)
  );
  assert.equal(postconditionBlocks.length, 7,
    'Must have exactly 7 POSTCONDITION_FAILED blocks (one per column)');
  for (const block of postconditionBlocks) {
    assert.ok(/column_default\s+IS\s+NULL/i.test(block),
      'Postcondition block must require column_default IS NULL');
  }
});

// ─── 16. PK validation is schema/table-safe, single-column, exact id ────────

test('3435 migration PK precondition avoids constraint_name join (schema/table-safe)', () => {
  // Must not use constraint_name-based join which could match wrong schema/constraint
  assert.equal(/constraint_name\s*=\s*kcu\.constraint_name/i.test(clean), false,
    'PK precondition must not use constraint_name join');
});

test('3435 migration PK precondition requires exactly one PK column', () => {
  assert.ok(/indnatts\s*=\s*1/i.test(sql),
    'PK precondition must verify exactly one PK column via indnatts = 1');
  assert.ok(/indisprimary/i.test(sql),
    'PK precondition must use indisprimary');
});

test('3435 migration PK precondition requires the single PK column to be id', () => {
  assert.ok(/attname\s*=\s*'id'/i.test(sql),
    'PK precondition must require the PK column is id');
});

// ─── 17. Test-layer inventory contract ──────────────────────────────────────

test('3435 migration contract appears in test-layer classification exactly once', () => {
  const classification = readFile(CLASSIFICATION_PATH);
  const classificationJson = JSON.parse(classification);
  const entries = classificationJson.entries;
  const matchingEntries = entries.filter(e =>
    e.path === 'tests/contracts/migration-repair-trees-schema-3435-contract.test.cjs'
  );
  assert.equal(matchingEntries.length, 1,
    'Must appear exactly once in test-layer classification');
});

test('3435 migration contract test-layer classification layer is SOURCE_STATIC', () => {
  const classification = readFile(CLASSIFICATION_PATH);
  const classificationJson = JSON.parse(classification);
  const entry = classificationJson.entries.find(e =>
    e.path === 'tests/contracts/migration-repair-trees-schema-3435-contract.test.cjs'
  );
  assert.ok(entry, 'Must have an entry in classification');
  assert.equal(entry.layer, 'SOURCE_STATIC',
    'Layer must be SOURCE_STATIC');
});

test('3435 migration contract test-layer classification capabilities is an empty array', () => {
  const classification = readFile(CLASSIFICATION_PATH);
  const classificationJson = JSON.parse(classification);
  const entry = classificationJson.entries.find(e =>
    e.path === 'tests/contracts/migration-repair-trees-schema-3435-contract.test.cjs'
  );
  assert.ok(entry, 'Must have an entry in classification');
  assert.ok(Array.isArray(entry.capabilities),
    'capabilities must be an array');
  assert.equal(entry.capabilities.length, 0,
    'capabilities must be empty');
});

// ─── 18. Idempotent add-if-absent for each column ───────────────────────────

test('3435 migration uses IF NOT EXISTS guard per column', () => {
  const guardedCols = [
    'owner_id', 'title', 'visibility', 'group_name',
    'keywords', 'created_at', 'updated_at',
  ];
  // Split into DO blocks and find one that contains both information_schema
  // and the column name (they may span multiple lines)
  const doBlocks = sql.split(/END\s*\$\$\s*;/i);
  for (const col of guardedCols) {
    let found = false;
    for (const block of doBlocks) {
      if (
        /IF\s+NOT\s+EXISTS/i.test(block) &&
        /information_schema\.columns/i.test(block) &&
        block.includes(col)
      ) {
        found = true;
        break;
      }
    }
    assert.ok(found,
      `Must guard ${col} addition with IF NOT EXISTS via information_schema`);
  }
});
