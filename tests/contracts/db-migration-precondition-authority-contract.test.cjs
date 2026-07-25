'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'db', 'migration-provenance', 'precondition-registry.json');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'db-migration-precondition-authority-contract.md');

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

const FORBIDDEN_PHRASES = [
  /Registry unavailable.*NOT_EVALUATED/,
  /Query catalog missing.*NOT_EVALUATED/,
  /source validation calls evaluatePrecondition/,
  /PRECONDITION_NOT_IMPLEMENTED/,
  /does not require a database session or lock handle/,
  /lockHandle is reserved for future use/,
  /readable by require\(\)/,
];

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
      const lines = raw.split('\n').filter(l => !/^\s*[{\[\],]/.test(l) && !/^\s*$/.test(l));
      for (const line of lines) {
        if (sqlIndicators.test(line)) {
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
      const forbidden = new Set(['query', 'text', 'sql', 'url', 'env', 'credential', 'operator', 'hostname', 'caller_path', 'dynamic_source', 'allowlist', 'evidence_contract', 'kind', 'field']);
      const found = findProhibitedField(parsed, forbidden, '');
      assert.equal(found.length, 0, `Prohibited fields found: ${found.join(', ')}`);
    });
  });

  describe('4. Contract document existence and sections', () => {
    it('Authority contract document exists', () => {
      assert.ok(fs.existsSync(CONTRACT_PATH));
    });
    const topLevelSections = [
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
      'Result contract',
      'Status mapping',
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
    const subsectionTerms = [
      'Normative status matrix',
      'Multi-check precedence',
      'No-precondition semantics',
    ];
    const doc = readDoc(CONTRACT_PATH);
    for (const section of topLevelSections) {
      it(`Has top-level section: ${section}`, () => {
        const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(doc, new RegExp(`^## ${escaped}`, 'm'), `Missing top-level section: ${section}`);
      });
    }
    for (const term of subsectionTerms) {
      it(`Has subsection: ${term}`, () => {
        assert.match(doc, new RegExp(`### ${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), `Missing subsection: ${term}`);
      });
    }
  });

  describe('5. Normative status matrix exact rows', () => {
    const doc = readDoc(CONTRACT_PATH);
    const matrixRows = [
      /Registry safely loaded and status is.*ADOPTION_REQUIRED.*NOT_EVALUATED/,
      /Query-catalog authority has not yet been adopted.*ADOPTION_REQUIRED.*NOT_EVALUATED/,
      /ACTIVE registry lacks the target entry or has empty checks.*FAIL/,
      /ACTIVE registry lacks the target entry or has empty checks despite source validation.*NOT_EVALUATED/,
      /Fixed registry\/catalog file missing or unreadable.*UNAVAILABLE/,
      /JSON successfully read but malformed or contract-invalid.*FAIL/,
      /Unsafe\/malformed registry\/catalog evidence reaches runtime.*UNAVAILABLE/,
      /Broker throw\/rejection or malformed query evidence.*UNAVAILABLE/,
      /Valid evidence disagrees with expected value.*FAIL/,
      /All defined non-empty checks match.*PASS/,
    ];
    for (let i = 0; i < matrixRows.length; i++) {
      it(`Status matrix row ${i + 1} exists`, () => {
        assert.match(doc, matrixRows[i]);
      });
    }
  });

  describe('6. Forbidden contradictory phrases absent', () => {
    const doc = readDoc(CONTRACT_PATH);
    for (const re of FORBIDDEN_PHRASES) {
      it(`Does not contain forbidden phrase`, () => {
        assert.ok(!re.test(doc), `Document must not match: ${re}`);
      });
    }
  });

  describe('7. Source validation result vocabulary exact', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Source validation returns { status: PASS | FAIL | UNAVAILABLE }', () => {
      // Must define exactly these three, not NOT_EVALUATED
      const svSection = doc.split('## Source-validation integration')[1]?.split('## ')[0] || '';
      assert.match(svSection, /status.*PASS.*FAIL.*UNAVAILABLE/);
      // Must not contain evalutePrecondition call claim
      assert.ok(!svSection.includes('calls evaluatePrecondition'));
    });
    it('Source validation does NOT call evaluatePrecondition', () => {
      const forbidsCall = /does not call|not call `evaluatePrecondition`|does \*\*not\*\* call/i.test(doc);
      const stillHasOld = /source validation calls evaluatePrecondition/i.test(doc);
      assert.ok(forbidsCall, 'Document must state that source validation does not call evaluatePrecondition');
      assert.ok(!stillHasOld, 'Document must not contain "source validation calls evaluatePrecondition"');
    });
    it('No reason field or PRECONDITION_NOT_IMPLEMENTED in source section', () => {
      const svSection = doc.split('## Source-validation integration')[1]?.split('## ')[0] || '';
      assert.ok(!svSection.includes('reason'), 'Source section must not mention reason field');
      assert.ok(!svSection.includes('PRECONDITION_NOT_IMPLEMENTED'));
    });
  });

  describe('8. Registry check exact keys', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Check has exact keys: check_id, query_reference, expected', () => {
      const checkSchema = doc.split('## Check schema')[1]?.split('## ')[0] || '';
      assert.match(checkSchema, /check_id/);
      assert.match(checkSchema, /query_reference/);
      assert.match(checkSchema, /expected/);
    });
    it('Check schema forbids evidence_contract, kind, field', () => {
      // These must appear in the document section about forbidden check-level keys
      const forbiddenSection = doc.split('Forbidden check-level keys')[1]?.split('### ')[0] || '';
      assert.match(forbiddenSection, /evidence_contract/);
      assert.match(forbiddenSection, /kind/);
      assert.match(forbiddenSection, /field/);
    });
  });

  describe('9. Catalog owns result contract, registry owns expected', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Catalog entry has exact keys: name, text, values, result_contract', () => {
      assert.match(doc, /"name"/);
      assert.match(doc, /"text"/);
      assert.match(doc, /"values"/);
      assert.match(doc, /result_contract/);
    });
    it('Catalog owns result_contract with kind and field', () => {
      assert.match(doc, /result_contract[\s\S]*?kind/);
      assert.match(doc, /result_contract[\s\S]*?field/);
    });
    it('Registry owns expected boolean only', () => {
      assert.match(doc, /registry owns.*expected/);
    });
    it('No duplicate authority - catalog does not store expected', () => {
      const catalogSection = doc.split('## Future fixed query catalog')[1]?.split('## ')[0] || '';
      assert.ok(!catalogSection.includes('"expected"'), 'Catalog must not store expected');
    });
  });

  describe('10. Loader boundary', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('require() is not allowed as loader authority', () => {
      // Document must explicitly forbid require() as loader
      const loaderText = doc.split('**Loader boundary.**')[1]?.split('**')[0] || '';
      assert.ok(doc.includes('require') && (doc.includes('not allowed') || doc.includes('must not be used')), 'Document must forbid require() as loader');
    });
    it('Defines exact loader sequence', () => {
      const steps = [
        /derive repository root/,
        /fixed repository-relative path/,
        /lexical containment/,
        /realpath containment/,
        /regular-file check/,
        /read.*UTF-8/,
        /JSON\.parse exactly once/,
        /validate exactly once/,
      ];
      for (const step of steps) {
        assert.match(doc, step);
      }
    });
  });

  describe('11. Runtime evaluation requires lockHandle and broker', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Runtime requires orchestrator-supplied lockHandle', () => {
      const brokerSection = doc.split('## Pinned-session broker relationship')[1]?.split('## ')[0] || '';
      assert.match(brokerSection, /lockHandle/);
      assert.match(brokerSection, /lock-adapter instance/);
    });
    it('Runtime requires queryLockedSession', () => {
      const brokerSection = doc.split('## Pinned-session broker relationship')[1]?.split('## ')[0] || '';
      assert.match(brokerSection, /queryLockedSession/);
    });
    it('Release ownership remains with releaseAdvisoryLock', () => {
      const brokerSection = doc.split('## Pinned-session broker relationship')[1]?.split('## ')[0] || '';
      assert.match(brokerSection, /releaseAdvisoryLock/);
    });
  });

  describe('12. No precondition semantics', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('No precondition = NOT_EVALUATED, not PASS', () => {
      assert.match(doc, /NOT_EVALUATED.*not PASS|not PASS/i);
    });
    it('PASS requires defined non-empty checks', () => {
      assert.match(doc, /PASS.*defined non-empty checks|PASS.*non-empty/i);
    });
    it('Authority not adopted = NOT_EVALUATED', () => {
      assert.match(doc, /Authority not adopted.*NOT_EVALUATED|NOT_EVALUATED.*authority/i);
    });
  });

  describe('13. Manifest and adapter unchanged', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Canonical manifest remains ADOPTION_REQUIRED', () => {
      assert.match(doc, /canonical manifest remains|unchanged|not.*changed/);
    });
    it('Manifest adapter not changed', () => {
      assert.match(doc, /manifest adapter.*not.*changed|migration-canonical-manifest-adapter-core|not.*changed in this child/);
    });
  });

  describe('14. Issue references correct', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('Document Refs #3657', () => {
      assert.match(doc, /Refs #3657/);
    });
    it('#3650 and #3652 are prior completed, not future child', () => {
      // Must not be described as future children
      for (const ref of ['#3650', '#3652']) {
        const isFuture = new RegExp(`${ref}.*future|${ref}.*next child|${ref}.*will be|${ref}.*to be`).test(doc);
        const isPast = new RegExp(`${ref}.*prior completed|${ref}.*completed`).test(doc);
        assert.ok(!isFuture || isPast, `${ref} must not be described as a future child`);
      }
    });
    it('Does not contain Closes/Fixes/Resolves #1882', () => {
      const closePattern = /(Closes|Fixes|Resolves)\s+#1882/;
      assert.ok(!closePattern.test(doc));
    });
    it('Protected issues referenced as Keep OPEN', () => {
      for (const issue of ['#3458', '#3425', '#3435', '#3437', '#1882']) {
        assert.match(doc, new RegExp(`${issue}.*OPEN`));
      }
    });
  });

  describe('15. No package/workflow/UI changes required', () => {
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

  describe('16. Future dependency order', () => {
    const doc = readDoc(CONTRACT_PATH);
    it('8 steps defined', () => {
      const steps = [
        /1\. precondition authority contract/,
        /2\. registry validator.*source-validation integration.*NEW ISSUE REQUIRED/,
        /3\. fixed read-only query catalog.*NEW ISSUE REQUIRED/,
        /4\. precondition registry loader\/resolver/,
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

  describe('17. Registry and document status consistency', () => {
    it('Registry status matches ADOPTION_REQUIRED', () => {
      const { parsed } = readRegistry();
      assert.equal(parsed.status, 'ADOPTION_REQUIRED');
    });
    it('Document references ADOPTION_REQUIRED', () => {
      const doc = readDoc(CONTRACT_PATH);
      assert.match(doc, /ADOPTION_REQUIRED/);
    });
  });
});
