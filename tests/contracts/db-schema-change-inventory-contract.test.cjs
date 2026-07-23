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
