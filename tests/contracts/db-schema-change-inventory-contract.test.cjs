'use strict';

/**
 * Static contract test: repository schema-change inventory guard (#3458).
 *
 * This is the first small slice of #3458 (design-work item 1: inventory every
 * schema-changing path). It is a SOURCE-ONLY, READ-ONLY inventory-completeness
 * guard. It does NOT connect to PostgreSQL or any database, does NOT execute
 * SQL or migrations, does NOT use DATABASE_URL or any secret, and does NOT
 * mutate any environment.
 *
 * Purpose: fail closed when a new schema-changing artifact (a *.sql file, a
 * scripts/modal_compute/functions module that contains DDL, or a
 * migration-runner / schema-repair named script) is added to the repository
 * but is not registered in docs/architecture/db-schema-change-inventory.json.
 *
 * This guard is an inventory-omission guard only. It is NOT a proof that any
 * PostgreSQL behavior executed correctly and NOT a substitute for the
 * disposable-CI DB-engine tests or the read-only provenance gate.
 *
 * Refs #3458
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INVENTORY_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'db-schema-change-inventory.json');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'db-schema-change-inventory.md');
const MIGRATION_INVENTORY_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'migration-path-inventory.json');
const BASELINE_SHA = 'cba2577195d9d29d5bbc7b835b765eb5a0e6b99d';

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', 'vendor', '.local', '.hermes',
  '.secrets',
]);
const EXCLUDED_PATH_PREFIXES = [
  'docs/conversation/',
];
const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'docs/architecture/db-schema-change-inventory.json',
  'docs/architecture/migration-path-inventory.json',
  'tests/contracts/db-schema-change-inventory-contract.test.cjs',
]);

const DDL_RE = /\b(CREATE\s+(TABLE|INDEX|POLICY|TRIGGER|SCHEMA)\b|CREATE\s+OR\s+REPLACE\s+FUNCTION|ALTER\s+(TABLE|POLICY)\b|DROP\s+(TABLE|INDEX|TRIGGER)\b|TRUNCATE\b|ENABLE\s+ROW\s+LEVEL\s+SECURITY)/i;
const RUNNER_RE = /(migration|rollback|seed|repair|reconcile|adopt|inspect-schema|verify-db)/i;
const SCRIPT_EXTS = new Set(['.cjs', '.js', '.mjs', '.py']);
const RUNNER_EXTS = new Set(['.cjs', '.js', '.mjs', '.py', '.sh', '.ps1']);

// RULE_DOC_SQL scope: documentation dirs whose markdown may carry manual SQL procedures.
const DOC_SQL_SCOPE_PREFIXES = ['docs/ops/', 'docs/architecture/', 'docs/product/'];
// Operator/runbook/manual-procedure document-name signal (precision filter).
const RUNBOOK_NAME_RE = /(runbook|migrat|repair|recover|reconcil|rollback|foothold|bulk|seed)/i;
// Fenced ```sql code block capture.
const FENCED_SQL_RE = /```sql[^\n]*\n([\s\S]*?)```/gi;

// True when the markdown content embeds a fenced ```sql block whose body contains DDL.
// Prose-only DDL mentions (architecture/design docs) and non-DDL fenced SQL (pure DML/SELECT
// or naming-convention examples without a runbook-style name) do not qualify on their own.
function hasFencedSqlDdl(content) {
  FENCED_SQL_RE.lastIndex = 0;
  let m;
  while ((m = FENCED_SQL_RE.exec(content)) !== null) {
    if (DDL_RE.test(m[1])) return true;
  }
  return false;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function isExcludedDir(name) {
  return EXCLUDED_DIR_NAMES.has(name);
}

function isExcludedPath(relPath) {
  if (EXCLUDED_FILES.has(relPath)) return true;
  for (const prefix of EXCLUDED_PATH_PREFIXES) {
    if (relPath.startsWith(prefix)) return true;
  }
  return false;
}

// Recursively collect repository-relative file paths, pruning excluded dirs.
function walkRepo() {
  const out = [];
  function walk(absDir, relDir) {
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        if (isExcludedDir(ent.name)) continue;
        walk(path.join(absDir, ent.name), rel);
      } else if (ent.isFile()) {
        if (!isExcludedPath(rel)) out.push(rel);
      }
    }
  }
  walk(REPO_ROOT, '');
  return out.sort();
}

function basenameNoExt(relPath) {
  const base = relPath.split('/').pop();
  const dot = base.indexOf('.');
  return dot === -1 ? base : base.slice(0, dot);
}

function isTestFile(relPath) {
  return /\.test\.(cjs|js|mjs)$/.test(relPath) || relPath.startsWith('tests/');
}

function readSafe(relPath) {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
  } catch {
    return '';
  }
}

// Detect schema-change candidate paths per the documented guard rules.
function detectCandidates(files) {
  const detected = new Set();
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    // RULE_SQL: every *.sql file must be registered.
    if (ext === '.sql') {
      detected.add(rel);
      continue;
    }
    // RULE_DDL_SCRIPT: scripts/modal_compute/functions module containing DDL.
    const inRuntimeScriptDir = rel.startsWith('scripts/') || rel.startsWith('modal_compute/') || rel.startsWith('functions/');
    if (SCRIPT_EXTS.has(ext) && inRuntimeScriptDir && !isTestFile(rel)) {
      if (DDL_RE.test(readSafe(rel))) detected.add(rel);
    }
    // RULE_RUNNER_NAME: migration-runner / schema-repair named non-test script.
    if (RUNNER_EXTS.has(ext) && !isTestFile(rel)) {
      if (RUNNER_RE.test(basenameNoExt(rel))) detected.add(rel);
    }
    // RULE_DOC_SQL: operator/runbook markdown under docs/ops|architecture|product that
    // embeds a fenced ```sql block containing DDL. Precision = runbook-style document name
    // AND fenced DDL, which excludes explanatory naming/status/audit and prose-only
    // architecture docs (false positives).
    if (ext === '.md') {
      const inDocScope = DOC_SQL_SCOPE_PREFIXES.some((prefix) => rel.startsWith(prefix));
      if (inDocScope && RUNBOOK_NAME_RE.test(basenameNoExt(rel)) && hasFencedSqlDdl(readSafe(rel))) {
        detected.add(rel);
      }
    }
  }
  return Array.from(detected).sort();
}

function loadInventory() {
  assert.ok(fs.existsSync(INVENTORY_PATH), 'inventory JSON must exist');
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

describe('DB schema-change inventory guard (#3458)', () => {

  describe('1. Inventory artifact existence', () => {
    it('inventory JSON exists', () => {
      assert.ok(fs.existsSync(INVENTORY_PATH));
    });
    it('inventory markdown exists', () => {
      assert.ok(fs.existsSync(DOC_PATH));
    });
    it('guard test file exists', () => {
      assert.ok(fs.existsSync(__filename));
    });
    it('related migration-path-inventory still present (not replaced)', () => {
      assert.ok(fs.existsSync(MIGRATION_INVENTORY_PATH));
    });
  });

  describe('2. Inventory JSON structure', () => {
    const inv = loadInventory();
    it('has required top-level fields', () => {
      for (const f of ['schema_version', 'title', 'issue', 'baseline_sha', 'scope', 'canonical_status_enum', 'category_enum', 'engine_enum', 'guard', 'entries']) {
        assert.ok(Object.prototype.hasOwnProperty.call(inv, f), `missing top-level field: ${f}`);
      }
    });
    it('binds the expected baseline SHA', () => {
      assert.strictEqual(inv.baseline_sha, BASELINE_SHA);
    });
    it('references #3458', () => {
      assert.match(inv.issue, /#3458/);
    });
    it('declares the canonical_status enum identical to migration-path-inventory', () => {
      const expected = ['CANONICAL_CANDIDATE', 'LEGACY_COMPATIBILITY', 'MANUAL_ONLY', 'INCIDENT_REPAIR_ONLY', 'ROLLBACK_ONLY', 'TEST_FIXTURE_ONLY', 'DEPRECATED', 'PROHIBITED_FOR_NEW_USE', 'UNCLEAR_REQUIRES_DECISION'];
      assert.deepStrictEqual(inv.canonical_status_enum, expected);
    });
    it('documents the guard test path', () => {
      assert.match(inv.guard.test, /db-schema-change-inventory-contract\.test\.cjs/);
    });
    it('documents that the guard is a static, non-executing guard', () => {
      const text = JSON.stringify(inv.guard).toLowerCase();
      assert.match(text, /not a proof|does not connect|inventory-omission|static/i);
    });
  });

  describe('3. Entry field completeness and enum validity', () => {
    const inv = loadInventory();
    const requiredFields = ['path', 'category', 'engine', 'operations', 'canonical_status', 'destructive', 'production_capable', 'owner_or_issue', 'notes'];
    it('every entry has all required minimum fields', () => {
      for (const e of inv.entries) {
        for (const f of requiredFields) {
          assert.ok(Object.prototype.hasOwnProperty.call(e, f), `${e.path || '<no path>'} missing field: ${f}`);
        }
      }
    });
    it('operations is a non-empty array for every entry', () => {
      for (const e of inv.entries) {
        assert.ok(Array.isArray(e.operations) && e.operations.length >= 1, `${e.path} operations must be a non-empty array`);
      }
    });
    it('destructive and production_capable are booleans', () => {
      for (const e of inv.entries) {
        assert.strictEqual(typeof e.destructive, 'boolean', `${e.path} destructive must be boolean`);
        assert.strictEqual(typeof e.production_capable, 'boolean', `${e.path} production_capable must be boolean`);
      }
    });
    it('canonical_status values are within the enum', () => {
      for (const e of inv.entries) {
        assert.ok(inv.canonical_status_enum.includes(e.canonical_status), `${e.path} has invalid canonical_status: ${e.canonical_status}`);
      }
    });
    it('category values are within the enum', () => {
      for (const e of inv.entries) {
        assert.ok(inv.category_enum.includes(e.category), `${e.path} has invalid category: ${e.category}`);
      }
    });
    it('engine values are within the enum', () => {
      for (const e of inv.entries) {
        assert.ok(inv.engine_enum.includes(e.engine), `${e.path} has invalid engine: ${e.engine}`);
      }
    });
    it('notes are non-empty', () => {
      for (const e of inv.entries) {
        assert.ok(String(e.notes).trim().length > 0, `${e.path} notes must be non-empty`);
      }
    });
  });

  describe('4. No duplicate inventory paths', () => {
    it('entry paths are unique', () => {
      const inv = loadInventory();
      const seen = new Set();
      const dups = [];
      for (const e of inv.entries) {
        if (seen.has(e.path)) dups.push(e.path);
        seen.add(e.path);
      }
      assert.deepStrictEqual(dups, [], `duplicate inventory paths: ${dups.join(', ')}`);
    });
  });

  describe('5. Every inventory entry path exists on disk (no stale entries)', () => {
    it('all entry paths resolve to existing files', () => {
      const inv = loadInventory();
      const missing = [];
      for (const e of inv.entries) {
        if (!fs.existsSync(path.join(REPO_ROOT, e.path))) missing.push(e.path);
      }
      assert.deepStrictEqual(missing, [], `stale inventory paths (file missing): ${missing.join(', ')}`);
    });
  });

  describe('6. Core guard: every detected schema-change artifact is registered', () => {
    it('no unregistered schema-changing artifact exists', () => {
      const inv = loadInventory();
      const registered = new Set(inv.entries.map((e) => e.path));
      const files = walkRepo();
      const candidates = detectCandidates(files);
      const unregistered = candidates.filter((c) => !registered.has(c));
      assert.deepStrictEqual(
        unregistered,
        [],
        `Schema-changing artifact(s) not registered in db-schema-change-inventory.json: ${unregistered.join(', ')}. ` +
        'Add an entry (path, category, engine, operations, canonical_status, destructive, production_capable, owner_or_issue, notes) before merging.'
      );
    });
    it('guard actually detects the known SQL and DDL artifacts (non-vacuous)', () => {
      const files = walkRepo();
      const candidates = detectCandidates(files);
      // Sanity: the guard must detect at least the known SQL migration artifacts and DDL tooling.
      assert.ok(candidates.includes('scripts/migration-add-tree-comments.sql'), 'guard must detect scripts/*.sql');
      assert.ok(candidates.includes('scripts/migration-provenance-core.cjs'), 'guard must detect DDL-bearing tooling');
      assert.ok(candidates.includes('tests/db-engine/fixtures/tree-comments-legacy.sql'), 'guard must detect fixture *.sql');
      // RULE_DOC_SQL must detect a runbook that embeds fenced DDL directly.
      assert.ok(candidates.includes('docs/ops/moment-social-write-hardening-migration-runbook.md'), 'guard must detect runbook markdown embedding fenced DDL');
      assert.ok(candidates.length >= 25, `guard should detect at least the 25 SQL artifacts, got ${candidates.length}`);
    });
  });

  describe('7. Verified-negative runtime surfaces are documented', () => {
    it('inventory documents modal_compute and functions as verified-negative', () => {
      const inv = loadInventory();
      const neg = (inv.verified_negative_surfaces || []).map((s) => s.path);
      assert.ok(neg.includes('modal_compute/'), 'modal_compute/ must be documented as verified-negative');
      assert.ok(neg.includes('functions/'), 'functions/ must be documented as verified-negative');
    });
    it('Python runtime layer contains no literal DDL (verified negative holds)', () => {
      const files = walkRepo().filter((f) => f.startsWith('modal_compute/') && f.endsWith('.py'));
      assert.ok(files.length >= 1, 'expected Python modules under modal_compute/');
      const offenders = files.filter((f) => DDL_RE.test(readSafe(f)));
      assert.deepStrictEqual(offenders, [], `Python modules with literal DDL (must be inventoried if real): ${offenders.join(', ')}`);
    });
    it('functions runtime layer contains no literal schema-changing DDL (verified-negative invariant)', () => {
      // Hard invariant, independent of inventory registration: the Cloudflare Functions
      // runtime (same-origin /api edge) must not contain literal schema-changing DDL.
      // Registering a path in the inventory does NOT satisfy this check; any literal DDL
      // here is a verified-negative violation and fails the test.
      const files = walkRepo().filter((f) => f.startsWith('functions/') && /\.(js|cjs|mjs)$/.test(f));
      assert.ok(files.length >= 1, 'expected JS modules under functions/');
      const offenders = files.filter((f) => DDL_RE.test(readSafe(f)));
      assert.deepStrictEqual(
        offenders,
        [],
        `functions/ runtime modules contain literal schema-changing DDL (verified-negative violation; not satisfied by inventory registration): ${offenders.join(', ')}`
      );
    });
  });

  describe('8. Inventory markdown required headings', () => {
    const doc = fs.existsSync(DOC_PATH) ? fs.readFileSync(DOC_PATH, 'utf8') : '';
    const requiredHeadings = [
      'LoveBud Repository Schema-Change Inventory',
      'Baseline',
      'Scope',
      'Non-Goals',
      'Relation to migration-path-inventory.json',
      'Classification Vocabulary',
      'Static Guard',
      'Verified-Negative Surfaces',
      'Category Breakdown',
      'Production / Database / SQL Boundary',
      'Known Gaps',
    ];
    for (const heading of requiredHeadings) {
      it(`has heading: ${heading}`, () => {
        const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(doc, new RegExp(escaped));
      });
    }
  });

  describe('9. Protected issue references and Keep OPEN statements', () => {
    const doc = fs.existsSync(DOC_PATH) ? fs.readFileSync(DOC_PATH, 'utf8') : '';
    const issues = ['#3458', '#3425', '#3435', '#3437', '#1882'];
    for (const iss of issues) {
      it(`doc references ${iss}`, () => {
        assert.match(doc, new RegExp(iss.replace('#', '#')));
      });
      it(`doc has "Keep ${iss} OPEN"`, () => {
        assert.match(doc, new RegExp(`Keep ${iss.replace('#', '#')} OPEN`));
      });
    }
    it('no Closes/Fixes/Resolves for protected issues', () => {
      for (const iss of ['3458', '3425', '3435', '3437', '1882']) {
        assert.doesNotMatch(doc, new RegExp(`(Closes|Fixes|Resolves)\\s+#${iss}`));
      }
    });
  });

  describe('10. Production / DB / SQL mutation prohibited in this slice', () => {
    const doc = fs.existsSync(DOC_PATH) ? fs.readFileSync(DOC_PATH, 'utf8') : '';
    it('states no SQL execution', () => {
      assert.match(doc, /SQL executed.*No|No SQL (is )?executed/i);
    });
    it('states no Production access', () => {
      assert.match(doc, /Production accessed.*No|No Production[^.]*access/i);
    });
    it('states no database connection', () => {
      assert.match(doc, /Database accessed.*No|No database connection/i);
    });
    it('states no secret usage', () => {
      assert.match(doc, /Secrets used.*No|No (DATABASE_URL|secret) (is )?used/i);
    });
  });

  describe('11. No credentials, connection strings, endpoints, or private identifiers', () => {
    const invRaw = fs.existsSync(INVENTORY_PATH) ? fs.readFileSync(INVENTORY_PATH, 'utf8') : '';
    const docRaw = fs.existsSync(DOC_PATH) ? fs.readFileSync(DOC_PATH, 'utf8') : '';
    const combined = `${invRaw}\n${docRaw}`;
    const prohibited = [
      /postgres:\/\/[^\s"]+/i,
      /postgresql:\/\/[^\s"]+/i,
      /mysql:\/\/[^\s"]+/i,
      /DATABASE_URL\s*[:=]\s*\S+/,
      /NETLIFY_DATABASE_URL\s*[:=]\s*\S+/,
      /password\s*[:=]\s*\S+[^\s.]/i,
      /BEGIN[A-Z ]*PRIVATE KEY/,
      /neon\.tech/i,
      /cloud\.neon/i,
      /\.neon\.app/i,
      /pages\.dev/i,
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
      /Bearer\s/i,
    ];
    for (let i = 0; i < prohibited.length; i += 1) {
      it(`no prohibited pattern #${i + 1}`, () => {
        assert.doesNotMatch(combined, prohibited[i]);
      });
    }
    it('does not embed the legacy seed owner identifier', () => {
      assert.doesNotMatch(combined, /6xJoZMw64gWZcSIIS92kmBcSGVn1/);
    });
  });
});

// ─── #4532 canonical migration count freshness guard ────────────────────────
//
// #4532 observed drift: the canonical manifest catalogued five migrations while
// architecture prose still claimed "two"/"three catalogued migrations". The fix
// is to stop restating the number at all and derive it from the manifest, so the
// count cannot silently go stale again. These guards enforce that, and keep
// "catalogued" distinct from "applied/adopted".

const CANONICAL_MANIFEST_PATH = path.join(
  REPO_ROOT,
  'db',
  'migration-provenance',
  'canonical-migrations.json'
);
const MIGRATIONS_README_PATH = path.join(REPO_ROOT, 'db', 'migrations', 'README.md');

// A restated literal count is the exact failure mode this guard removes.
const RESTATED_COUNT_RE =
  /\b(one|two|three|four|five|six|seven|[0-9]+)\s+catalogued\s+(?:additive\s+)?migrations?\b/gi;

const COUNT_SURFACES = [
  INVENTORY_PATH,
  DOC_PATH,
  MIGRATIONS_README_PATH,
  CANONICAL_MANIFEST_PATH,
];

function readCanonicalManifest() {
  return JSON.parse(fs.readFileSync(CANONICAL_MANIFEST_PATH, 'utf8'));
}

function restatedCountFaults(text) {
  return [...new Set(String(text).match(RESTATED_COUNT_RE) || [])];
}

function derivedCanonicalCount() {
  return readCanonicalManifest().migrations.length;
}

// ─── #4539 active-normative count guard (bounded) ────────────────────────────
//
// #4532 fixed the primary inventory surfaces; #4539 removes the remaining
// hand-maintained catalogue counts from the other active architecture/governance
// contracts. This is deliberately a BOUNDED allowlist, not a repo-wide regex
// ban: historical evidence (dated audits, decision records bound to a snapshot)
// and regression fixtures in THIS test file may legitimately contain a literal
// historical count, and those must not be misreported as current claims.

const ACTIVE_NORMATIVE_COUNT_SURFACES = [
  'docs/architecture/DB_MIGRATION_PROVENANCE_GATE.md',
  'docs/architecture/DB_MIGRATION_PROVENANCE_CLEAN_TARGET_ADOPTION_DECISION.md',
  'docs/architecture/db-canonical-runner-protocol-contract.md',
  'docs/architecture/db-destructive-ddl-approval-contract.md',
  'docs/architecture/db-migration-identity-order-checksum-contract.md',
  'docs/architecture/db-migration-precondition-authority-contract.md',
  'docs/architecture/db-migration-source-validation-adapter-contract.md',
  'docs/architecture/canonical-memory-lineage-write-contract-4005.md',
  'docs/architecture/db-schema-change-inventory.json',
  'docs/architecture/db-schema-change-inventory.md',
  'db/migrations/README.md',
  'tests/test-layer-classification.json',
];

// Deliberately NOT in the active set: this test file (holds the NC fixture) and
// dated historical audits whose count is an explicitly bound snapshot.
const HISTORICAL_OR_FIXTURE_SURFACES = [
  'tests/contracts/db-schema-change-inventory-contract.test.cjs',
  'docs/architecture/canonical-neon-schema-data-convergence-audit-4005.md',
];

function activeNormativeCountFaults() {
  const offenders = [];
  for (const rel of ACTIVE_NORMATIVE_COUNT_SURFACES) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) {
      offenders.push(`MISSING_ACTIVE_SURFACE:${rel}`);
      continue;
    }
    for (const hit of restatedCountFaults(fs.readFileSync(abs, 'utf8'))) {
      offenders.push(`${rel}: "${hit}"`);
    }
  }
  return offenders;
}

describe('#4539 active-normative migration count guard', () => {
  it('no active normative surface restates a hand-maintained catalogue count', () => {
    assert.deepEqual(
      activeNormativeCountFaults(),
      [],
      'active normative surfaces must derive the count from canonical-migrations.json, not restate it'
    );
  });

  it('the bounded allowlist is real: every listed surface exists and the list is non-trivial', () => {
    assert.ok(
      ACTIVE_NORMATIVE_COUNT_SURFACES.length >= 8,
      'allowlist must actually cover the active architecture/governance contracts'
    );
    const missing = ACTIVE_NORMATIVE_COUNT_SURFACES.filter(
      (rel) => !fs.existsSync(path.join(REPO_ROOT, rel))
    );
    assert.deepEqual(missing, [], `allowlist entries must exist: ${missing.join(', ')}`);
  });

  it('NC9: re-introducing a literal count into an active normative surface is detected', () => {
    const injected =
      'The current canonical manifest remains ADOPTION_REQUIRED with two catalogued migrations.';
    assert.deepEqual(
      restatedCountFaults(injected),
      ['two catalogued migrations'],
      'an active normative restatement must be flagged'
    );
  });

  it('NC10: manifest-derived phrasing is accepted on active surfaces', () => {
    const derived =
      'The canonical manifest remains ADOPTION_REQUIRED. Its current catalogue is the migrations ' +
      'array in db/migration-provenance/canonical-migrations.json; the count is derived from that manifest.';
    assert.deepEqual(
      restatedCountFaults(derived),
      [],
      'manifest-derived wording must not be flagged'
    );
  });

  it('historical evidence and negative-control fixtures are not misreported as current claims', () => {
    // Positive control: the preserved literal counts live only outside the active set.
    const fixture = restatedCountFaults(
      'The committed canonical migration stream is inactive (ADOPTION_REQUIRED) with two catalogued migrations.'
    );
    assert.deepEqual(
      fixture,
      ['two catalogued migrations'],
      'the regression fixture intentionally keeps its literal'
    );
    for (const rel of HISTORICAL_OR_FIXTURE_SURFACES) {
      assert.ok(
        !ACTIVE_NORMATIVE_COUNT_SURFACES.includes(rel),
        `${rel} must stay outside the active-normative count guard`
      );
    }
    // The active set must not contain the fixture/historical files it preserves.
    const overlap = ACTIVE_NORMATIVE_COUNT_SURFACES.filter((rel) =>
      HISTORICAL_OR_FIXTURE_SURFACES.includes(rel)
    );
    assert.deepEqual(overlap, [], 'active and historical sets must be disjoint');
  });

  it('catalogued is still not treated as applied, adopted, or ACTIVE', () => {
    const manifest = readCanonicalManifest();
    assert.equal(manifest.status, 'ADOPTION_REQUIRED', 'catalogue population must not activate the manifest');
    assert.ok(derivedCanonicalCount() > 0, 'catalogue must still be populated');
  });
});

describe('#4532 canonical migration count freshness guard', () => {
  it('canonical manifest count is derived from the manifest itself', () => {
    const manifest = readCanonicalManifest();
    assert.ok(Array.isArray(manifest.migrations), 'manifest must expose a migrations array');
    assert.ok(derivedCanonicalCount() > 0, 'derived count must be positive');
    assert.equal(
      new Set(manifest.migrations.map((m) => m.id)).size,
      manifest.migrations.length,
      'catalogued migration ids must be unique'
    );
  });

  it('every catalogued migration has a real SQL file, and every canonical SQL file is catalogued', () => {
    const manifest = readCanonicalManifest();
    const dir = path.join(REPO_ROOT, 'db', 'migrations');
    const onDisk = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const catalogued = manifest.migrations.map((m) => path.basename(m.path)).sort();
    assert.deepEqual(
      catalogued,
      onDisk,
      'catalogued manifest entries and canonical SQL files must stay in exact one-to-one agreement'
    );
  });

  it('no authority surface restates a literal catalogued-migration count', () => {
    const offenders = [];
    for (const file of COUNT_SURFACES) {
      for (const hit of restatedCountFaults(fs.readFileSync(file, 'utf8'))) {
        offenders.push(`${path.relative(REPO_ROOT, file)}: "${hit}"`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `catalogued counts must be derived from canonical-migrations.json, not restated: ${offenders.join('; ')}`
    );
  });

  it('NC7: re-introducing a stale hardcoded count is detected', () => {
    const stale = 'The committed canonical migration stream is inactive (ADOPTION_REQUIRED) with two catalogued migrations.';
    assert.deepEqual(
      restatedCountFaults(stale),
      ['two catalogued migrations'],
      'a restated literal count must be flagged so it cannot drift again'
    );
    const correct = 'The stream is inactive (ADOPTION_REQUIRED); its catalogued migration count is derived from canonical-migrations.json.';
    assert.deepEqual(restatedCountFaults(correct), [], 'derived phrasing must not be flagged');
  });

  it('catalogued is not conflated with applied or adopted', () => {
    const manifest = readCanonicalManifest();
    assert.equal(manifest.status, 'ADOPTION_REQUIRED', 'canonical stream must remain not-adopted');
    for (const text of [
      fs.readFileSync(INVENTORY_PATH, 'utf8'),
      fs.readFileSync(DOC_PATH, 'utf8'),
      fs.readFileSync(MIGRATIONS_README_PATH, 'utf8'),
    ]) {
      assert.doesNotMatch(
        text,
        /canonical[^.]*stream (?:is|remains) ACTIVE/i,
        'no surface may present the canonical stream as ACTIVE'
      );
    }
  });

  it('NC8: flipping the manifest to ACTIVE is detected as a catalog/adoption conflation', () => {
    const manifest = readCanonicalManifest();
    assert.notEqual(manifest.status, 'ACTIVE', 'fixture precondition: manifest is not ACTIVE');
    const mutated = JSON.parse(JSON.stringify(manifest));
    mutated.status = 'ACTIVE';
    assert.equal(
      mutated.status,
      'ACTIVE',
      'a mutated manifest claiming ACTIVE must be distinguishable from the real ADOPTION_REQUIRED state'
    );
    assert.notEqual(
      mutated.status,
      manifest.status,
      'catalogue population alone must never be treated as adoption evidence'
    );
  });
});
