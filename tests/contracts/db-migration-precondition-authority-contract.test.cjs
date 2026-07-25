'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'precondition-registry.json');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'db-migration-precondition-authority-contract.md');
const CANONICAL_MANIFEST_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');

function readRegistry() {
  assert.ok(fs.existsSync(REGISTRY_PATH), `Registry must exist: ${REGISTRY_PATH}`);
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  return { raw, parsed: JSON.parse(raw) };
}

function readDoc(filePath) {
  assert.ok(fs.existsSync(filePath), `Document must exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function findProhibitedField(obj, fieldSet, parentPath) {
  const results = [];
  if (obj === null || obj === undefined || typeof obj !== 'object') return results;
  for (const key of Object.keys(obj)) {
    const combined = parentPath ? `${parentPath}.${key}` : key;
    if (fieldSet.has(key)) {
      results.push(combined);
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      results.push(...findProhibitedField(obj[key], fieldSet, combined));
    }
  }
  return results;
}

describe('DB Migration Precondition Authority Contract (#3657)', () => {

  describe('1. Registry existence and parsability', () => {
    it('Registry file exists', () => {
      assert.ok(fs.existsSync(REGISTRY_PATH));
    });
    it('Registry is valid JSON', () => {
      const { raw } = readRegistry();
      assert.doesNotThrow(() => JSON.parse(raw));
    });
  });

  describe('2. Registry top-level keys', () => {
    it('Has exactly 3 top-level keys: format_version, status, entries', () => {
      const { parsed } = readRegistry();
      const keys = Object.keys(parsed);
      assert.deepEqual(keys, ['format_version', 'status', 'entries']);
    });
    it('format_version is "1.0"', () => {
      const { parsed } = readRegistry();
      assert.equal(parsed.format_version, '1.0');
    });
    it('status is "ADOPTION_REQUIRED"', () => {
      const { parsed } = readRegistry();
      assert.equal(parsed.status, 'ADOPTION_REQUIRED');
    });
    it('entries is an empty array', () => {
      const { parsed } = readRegistry();
      assert.ok(Array.isArray(parsed.entries));
      assert.equal(parsed.entries.length, 0);
    });
    it('No extra top-level keys beyond format_version, status, entries', () => {
      const { parsed } = readRegistry();
      const allowed = new Set(['format_version', 'status', 'entries']);
      for (const key of Object.keys(parsed)) {
        assert.ok(allowed.has(key), `Unexpected top-level key: ${key}`);
      }
    });
  });

  describe('3. Registry forbidden content', () => {
    it('No SQL text in registry', () => {
      const { raw } = readRegistry();
      const sqlIndicators = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|FROM|WHERE)\b/i;
      // The top-level key "status" and values like "ADOPTION_REQUIRED" do not contain SQL.
      // Check that no value contains SQL keywords in a query-like context.
      const lines = raw.split('\n').filter(l => !/^\s*[{\[\],]/.test(l) && !/^\s*$/.test(l));
      for (const line of lines) {
        if (sqlIndicators.test(line)) {
          // "status" value and "format_version" value are exempt.
          const val = line.trim();
          if (val === '"status": "ADOPTION_REQUIRED"' || val === '"format_version": "1.0"' || val === '"entries": []') continue;
          assert.fail(`Potential SQL text in registry: ${line.trim()}`);
        }
      }
    });
    it('No URL in registry', () => {
      const { raw } = readRegistry();
      assert.ok(!/https?:\/\//i.test(raw), 'Registry must not contain URLs');
    });
    it('No env, credential, operator, hostname patterns in registry', () => {
      const { raw } = readRegistry();
      const forbidden = [/env[_.]/, /credential/i, /operator/i, /hostname/i, /database_url/i, /connection_string/i];
      for (const re of forbidden) {
        assert.ok(!re.test(raw), `Registry must not match ${re}`);
      }
    });
    it('No prohibited field keys exist in parsed registry', () => {
      const { parsed } = readRegistry();
      const forbidden = new Set(['query', 'text', 'sql', 'url', 'env', 'credential', 'operator', 'hostname', 'caller_path', 'dynamic_source', 'allowlist']);
      const found = findProhibitedField(parsed, forbidden, '');
      assert.equal(found.length, 0, `Prohibited fields found: ${found.join(', ')}`);
    });
  });

  describe('4. Contract document existence and sections', () => {
    it('Authority contract document exists', () => {
      assert.ok(fs.existsSync(CONTRACT_PATH));
    });
    const requiredSections = [
      'Purpose',
      'Current inactive state',
      'Authority ownership',
      'Fixed registry path',
      'Registry top-level schema',
      'Registry entry schema',
      'Check schema',
      'Migration binding',
      'Query-reference boundary',
      'Future fixed query catalog',
      'Evidence contract',
      'Status mapping',
      'Multi-check precedence',
      'No-precondition semantics',
      'Source-validation integration',
      'Manifest relationship',
      'Orchestrator relationship',
      'Pinned-session broker relationship',
      'Sensitive-data boundary',
      'Prohibited behaviors',
      'Required implementation sequence',
      'Required future tests',
      'Rollback',
      'Completion boundary',
      'References',
    ];
    const doc = readDoc(CONTRACT_PATH);
    for (const section of requiredSections) {
      it(`Has section: ${section}`, () => {
        const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(doc, new RegExp(`^## ${escaped}`, 'm'), `Missing section: ${section}`);
      });
    }
  });

  describe('5. Document no-precondition semantics', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Document forbids no-precondition = PASS', () => {
      assert.match(doc, /NOT_EVALUATED/i);
      const noPassDefault = doc.includes('PASS` is never returned when no precondition is defined') ||
        doc.includes('PASS is never an automatic default') ||
        doc.includes('never PASS');
      assert.ok(noPassDefault, 'Document must forbid PASS as default for no precondition');
    });
    it('Document requires NOT_EVALUATED for no precondition', () => {
      assert.match(doc, /NOT_EVALUATED \(not PASS\)|no precondition.*NOT_EVALUATED/i);
    });
    it('Document requires PASRequires defined non-empty checks', () => {
      const passDefined = doc.includes('PASS` requires defined non-empty checks') ||
        doc.includes('Every `PASS` requires defined non-empty checks') ||
        doc.includes('PASS requires defined non-empty checks');
      assert.ok(passDefined, 'Document must require PASS requires defined non-empty checks');
    });
  });

  describe('6. Document status definitions', () => {
    const doc = readDoc(CONTRACT_PATH);
    const statuses = ['NOT_EVALUATED', 'PASS', 'FAIL', 'UNAVAILABLE'];
    for (const s of statuses) {
      it(`Document defines ${s} status`, () => {
        const headingMatch = doc.includes(`### ${s}`) || doc.includes(`## ${s}`);
        const defineMatch = new RegExp(`${s}[\\s\\S]{0,200}returned when|${s}[\\s\\S]{0,200}Returned when`, 'i');
        assert.ok(headingMatch || defineMatch.test(doc), `Status ${s} must be defined`);
      });
    }
    it('Document defines UNAVAILABLE > FAIL precedence', () => {
      const precedencePattern = /UNAVAILABLE.*FAIL|FAIL.*UNAVAILABLE|One or more UNAVAILABLE.*UNAVAILABLE/;
      assert.match(doc, precedencePattern);
    });
  });

  describe('7. Document registry path and query boundary', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Document defines fixed registry path', () => {
      assert.match(doc, /db\/migration-provenance\/precondition-registry\.json/);
    });
    it('Document requires canonical migration cross-validation', () => {
      assert.match(doc, /cross-validate|manifest.*registry|registry.*manifest/i);
    });
    it('Document forbids unknown migration ID', () => {
      const forbids = /unknown migration|must not invent|no orphan/i;
      assert.match(doc, forbids);
    });
    it('Document defines query-reference-only registry', () => {
      assert.match(doc, /query.?reference[^)]/i);
    });
    it('Document forbids SQL text in registry', () => {
      assert.match(doc, /SQL text|SQL.*not.*stored|must not contain SQL|SQL.*forbidden/i);
    });
    it('Document defines future fixed query catalog', () => {
      assert.match(doc, /readonly-query-catalog|fixed query catalog|query catalog/i);
    });
    it('Document forbids caller path/query/SQL override', () => {
      assert.match(doc, /caller.*override|caller.*supplied|cannot accept caller/i);
    });
  });

  describe('8. Document manifest and implementation sequence', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Document states canonical manifest unchanged', () => {
      assert.match(doc, /canonical manifest remains|unchanged|not.*changed/i);
    });
    it('Document states manifest adapter unchanged', () => {
      assert.match(doc, /manifest adapter.*not.*changed|migration-canonical-manifest-adapter-core|not.*changed in this child/i);
    });
    it('Document defines exact future dependency order', () => {
      const steps = [
        /precondition authority contract/,
        /registry validator.*source-validation integration/,
        /fixed read-only query catalog contract/,
        /precondition registry loader\/resolver/,
        /evaluatePrecondition adapter/,
        /composition root/,
        /disposable PostgreSQL rehearsal/,
        /separately approved environment adoption/,
      ];
      for (const step of steps) {
        assert.match(doc, step);
      }
    });
  });

  describe('9. Document references and issue protection', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Document Refs #3657', () => {
      assert.match(doc, /Refs #3657/);
    });
    it('Document does not contain Closes/Fixes/Resolves #1882', () => {
      const closePattern = /(Closes|Fixes|Resolves)\s+#1882/;
      assert.ok(!closePattern.test(doc), 'Document must not contain Closes/Fixes/Resolves #1882');
    });
    it('Document references #3458, #3425, #3435, #3437, #1882 as Keep OPEN references', () => {
      for (const issue of ['#3458', '#3425', '#3435', '#3437', '#1882']) {
        assert.match(doc, new RegExp(`Refs ${issue}|${issue}.*OPEN`));
      }
    });
  });

  describe('10. Registry and document status consistency', () => {
    it('Registry status matches ADOPTION_REQUIRED', () => {
      const { parsed } = readRegistry();
      assert.equal(parsed.status, 'ADOPTION_REQUIRED');
    });
    it('Document references ADOPTION_REQUIRED as inactive', () => {
      const doc = readDoc(CONTRACT_PATH);
      assert.match(doc, /ADOPTION_REQUIRED/);
    });
  });

  describe('11. Prohibited behaviors in document', () => {
    const doc = readDoc(CONTRACT_PATH);
    const prohibitions = [
      /Storing SQL text/,
      /Storing file paths/,
      /Accepting caller-supplied query text/,
      /Returning.*PASS.*no precondition entry/,
      /Returning.*PASS.*ADOPTION_REQUIRED/,
      /Bypassing the registry/,
      /Embedding precondition logic/,
      /expected_preconditions.*manifest/,
      /Executing SQL queries from the precondition module/,
      /Changing the canonical manifest/,
      /Installing packages/,
      /Modifying UI components/,
      /Starting Docker, PostgreSQL/,
      /Exposing registry or query evidence outside/,
      /Overriding or bypassing the multi-check precedence/,
    ];
    for (const re of prohibitions) {
      it(`Prohibits: ${re}`, () => {
        assert.match(doc, re);
      });
    }
  });

  describe('12. Registry entry conceptual contract (documented)', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Document defines BOOLEAN_SINGLE_ROW evidence kind', () => {
      assert.match(doc, /BOOLEAN_SINGLE_ROW/);
    });
    it('Document defines check_id as stable kebab-case', () => {
      assert.match(doc, /kebab-case|kebab.?case/i);
    });
    it('Document defines query_reference as fixed catalog key', () => {
      assert.match(doc, /query_reference/);
    });
    it('Document defines evidence_contract with kind/field/expected', () => {
      assert.match(doc, /evidence_contract/);
    });
  });

  describe('13. No package/workflow/UI changes required', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Document does not require package.json changes', () => {
      const requiresChange = /package\.json.*(?:change|modify|update|add|install)/i.test(doc);
      const onlyProhibits = /package\.json.*forbidden|prohibited|must not/i.test(doc);
      assert.ok(!requiresChange || onlyProhibits, 'Document must not require package.json changes');
    });
    it('Document does not require workflow file changes', () => {
      const requiresChange = /workflow.*(?:change|modify|update|add)/i.test(doc);
      const onlyProhibits = /workflow.*forbidden|prohibited|must not/i.test(doc);
      assert.ok(!requiresChange || onlyProhibits, 'Document must not require workflow file changes');
    });
  });

  describe('14. Future tests documented', () => {
    const doc = readDoc(CONTRACT_PATH);
    const futureTests = [
      /registry validator/,
      /status transition/,
      /evaluatePrecondition contract/,
      /Multi-check precedence/,
      /No-precondition enforcement/,
      /Query-reference resolution/,
      /Cross-validation.*manifest/,
      /Caller override rejection/,
      /Security-sensitive boundary/,
    ];
    for (const re of futureTests) {
      it(`Future test documented: ${re}`, () => {
        assert.match(doc, re);
      });
    }
  });

  describe('15. Implementation sequence documented', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Document lists 8 steps in correct order', () => {
      const steps = [
        /1\. precondition authority contract/,
        /2\. registry validator.*source-validation/,
        /3\. fixed read-only query catalog/,
        /4\. precondition registry loader.*resolver/,
        /5\. evaluatePrecondition adapter/,
        /6\. composition root/,
        /7\. disposable PostgreSQL rehearsal/,
        /8\. separately approved environment adoption/,
      ];
      for (const step of steps) {
        assert.match(doc, step);
      }
    });
  });
});
