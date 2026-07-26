'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AUDIT_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_CURRENT_STATE_AUDIT.md');
const DECISION_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md');
const AUDIT_BASELINE_SHA = 'eb030c1d4751dfee45d65f5a420caebebac6ebcc';

function readDoc(filePath) {
  assert.ok(fs.existsSync(filePath), `Document must exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function existsRepoPath(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

function assertContainsHeading(documentText, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(documentText, new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, 'm'));
}

describe('DB Migration Provenance Current-State Audit Contract (#3644)', () => {
  const audit = readDoc(AUDIT_PATH);
  const decision = readDoc(DECISION_PATH);
  const combined = `${audit}\n${decision}`;

  describe('1. Document existence and baseline identity', () => {
    it('Audit document exists', () => {
      assert.ok(fs.existsSync(AUDIT_PATH));
    });
    it('Decision document exists', () => {
      assert.ok(fs.existsSync(DECISION_PATH));
    });
    it('Contract test file exists', () => {
      assert.ok(fs.existsSync(__filename));
    });
    it('Audit contains the fixed audit baseline SHA', () => {
      assert.match(audit, new RegExp(AUDIT_BASELINE_SHA));
    });
    it('Decision contains the fixed audit baseline SHA', () => {
      assert.match(decision, new RegExp(AUDIT_BASELINE_SHA));
    });
    it('Both documents identify audit issue #3644', () => {
      assert.match(audit, /#3644/);
      assert.match(decision, /#3644/);
    });
  });

  describe('2. Current audit structure', () => {
    const requiredHeadings = [
      'LoveBud DB Migration Provenance Current-State Audit',
      'Audit baseline',
      'Scope and evidence limits',
      'Executive conclusion',
      '#3458 acceptance-criteria matrix',
      'Newly completed repository capabilities',
      'Exact pinned-session composition gap',
      'Other repository-side gaps',
      'Operator-input and repository-implementation separation',
      'Reconciled dependency graph',
      'Selected next outcome',
      'Unsupported claims',
      'Audit completion statement',
    ];
    for (const heading of requiredHeadings) {
      it(`Has audit heading: ${heading}`, () => {
        assertContainsHeading(audit, heading);
      });
    }
  });

  describe('3. Current decision structure', () => {
    const requiredHeadings = [
      'LoveBud DB Migration Provenance Next-Child Decision',
      'Decision summary',
      'Why the previous decision changed',
      'Verified current incompatibility',
      'Selected next child',
      'Exact allowed files',
      'Prohibited files and areas',
      'Explicit non-goals',
      'Acceptance criteria',
      'Verification requirements',
      'Rollback and forward-fix posture',
      'Completion boundary',
      'Work that remains after the selected child',
      'Decision completion statement',
      'Precondition authority child (#3657)',
    ];
    for (const heading of requiredHeadings) {
      it(`Has decision heading: ${heading}`, () => {
        assertContainsHeading(decision, heading);
      });
    }
  });

  describe('4. Parent acceptance-criteria matrix remains explicit', () => {
    const currentStatuses = ['COMPLETE', 'PARTIAL', 'NOT_STARTED'];
    for (const status of currentStatuses) {
      it(`Contains current matrix status: ${status}`, () => {
        assert.match(audit, new RegExp(`\\b${status}\\b`));
      });
    }
    it('Documents all 12 numbered acceptance areas', () => {
      for (let criterion = 1; criterion <= 12; criterion += 1) {
        assert.match(audit, new RegExp(`^\\| ${criterion} \\|`, 'm'));
      }
    });
    it('Does not promote source contracts or synthetic mocks to completion proof', () => {
      assert.match(audit, /No acceptance criterion is upgraded based solely on a contract file or synthetic mock/);
    });
    it('Keeps criterion 2 as the only currently complete parent criterion', () => {
      assert.match(audit, /Criterion 2 remains the only currently complete parent criterion/);
    });
  });

  describe('5. Repository capability and dependency evidence', () => {
    const capabilityHeadings = [
      '1. Canonical runner protocol',
      '2. Canonical runner orchestrator',
      '3. PostgreSQL pinned-session advisory-lock adapter',
      '4. PostgreSQL ledger read/append adapter',
      '5. Adoption operator checklist',
      '6. CI infrastructure-unavailable governance',
    ];
    for (const heading of capabilityHeadings) {
      it(`Documents repository capability: ${heading}`, () => {
        assertContainsHeading(audit, heading);
      });
    }
    it('Documents the exact pinned-session query broker gap', () => {
      assert.match(audit, /queryLockedSession\(\{ lockHandle, query \}\)/);
      assert.match(audit, /No current source module can safely perform all of the following/);
    });
    it('Documents repository implementation and external input as separate lanes', () => {
      assert.match(audit, /Repository implementation dependencies/);
      assert.match(audit, /External operator inputs/);
      assert.match(audit, /parallel dependency lanes/);
    });
  });

  describe('6. Current selected outcome and fail-closed boundaries', () => {
    it('Selects exactly the safe implementation child outcome', () => {
      assert.match(audit, /SAFE_IMPLEMENTATION_CHILD_SELECTED/);
      assert.match(decision, /SAFE_IMPLEMENTATION_CHILD_SELECTED/);
      assert.doesNotMatch(decision, /Outcome[^\n]*NO_SAFE_IMPLEMENTATION_CHILD_WITHOUT_OPERATOR_INPUT/);
    });
    it('Selects the source-tested pinned-session query broker', () => {
      assert.match(decision, /Selected child \| Source-tested pinned-session query broker/);
      assert.match(decision, /POSTGRES_LOCKED_SESSION_QUERY_UNAVAILABLE/);
    });
    it('Keeps source-tested evidence distinct from target and Production proof', () => {
      assert.match(audit, /repository capability, not as proof that PostgreSQL or Production behavior occurred/);
      assert.match(audit, /Disposable PostgreSQL engine tests remain distinct from target-readonly evidence and Production evidence/);
    });
    it('Keeps manifest and ledger authority inactive', () => {
      assert.match(audit, /Manifest is inactive and contains zero canonical migrations/);
      assert.match(audit, /a ledger relation exists/);
      assert.match(audit, /an authoritative applied-migration history exists/);
    });
    it('Keeps deployment and Production claims unsupported', () => {
      assert.match(audit, /the migration system is Production-ready/);
      assert.match(audit, /deployment provenance is enforced/);
      assert.match(audit, /Production catalog evidence has been collected/);
    });
  });

  describe('7. Operator inputs and later approvals remain separate', () => {
    it('Documents the two external operator inputs', () => {
      assert.match(audit, /OI-1 \| Dedicated Production-readonly credential \| `UNAVAILABLE`/);
      assert.match(audit, /OI-2 \| Abstract PostgreSQL role mapping \| `UNAVAILABLE`/);
    });
    it('Documents Phase B approval separately from the two inputs', () => {
      assert.match(audit, /OA-B \| Phase B bounded read-only collection approval \| `NOT_GRANTED`/);
    });
    it('Documents later Phase C, D, and E decisions as not reached', () => {
      assert.match(audit, /OA-C \| Phase C evidence and drift review \| `NOT_REACHED`/);
      assert.match(audit, /OA-D \| Manifest activation decision \| `NOT_REACHED`/);
      assert.match(audit, /OA-E \| Ledger bootstrap and canonical migration-stream approval \| `NOT_REACHED`/);
    });
  });

  describe('8. Current exact allowed-file boundary', () => {
    const allowedFiles = [
      'scripts/migration-postgres-session-lock-adapter-core.cjs',
      'tests/contracts/db-postgres-session-lock-adapter-contract.test.cjs',
      'docs/architecture/db-postgres-session-lock-adapter-contract.md',
      'docs/architecture/db-postgres-ledger-adapter-contract.md',
    ];
    for (const file of allowedFiles) {
      it(`Decision lists allowed file: ${file}`, () => {
        const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(decision, new RegExp(escaped));
      });
    }
    it('Completion boundary remains documented without phrase coupling', () => {
      assertContainsHeading(decision, 'Completion boundary');
    });
    it('Classification registry is documented without requiring a fixed word order', () => {
      assert.match(decision, /tests\/test-layer-classification\.json/);
    });
    it('Prohibits package, workflow, migration-state, product, and secret changes', () => {
      assert.match(decision, /package\.json/);
      assert.match(decision, /\.github\/\*\*/);
      assert.match(decision, /db\/migration-provenance\/\*\*/);
      assert.match(decision, /product, API, UI, Auth, CSS, and Cloudflare files/);
      assert.match(decision, /secrets, environment configuration/);
    });
  });

  describe('9. Protected issue references and Keep OPEN statements', () => {
    const protectedIssues = ['#3458', '#3425', '#3435', '#3437', '#1882'];
    for (const issue of protectedIssues) {
      it(`Audit keeps ${issue} open`, () => {
        assert.match(audit, new RegExp(`Keep ${issue} OPEN`));
      });
      it(`Decision keeps ${issue} open`, () => {
        assert.match(decision, new RegExp(`Keep ${issue} OPEN`));
      });
    }
    it('No Closes/Fixes/Resolves for protected issues', () => {
      for (const issue of protectedIssues) {
        const number = issue.slice(1);
        assert.doesNotMatch(combined, new RegExp(`(Closes|Fixes|Resolves)\\s+#${number}`));
      }
    });
  });

  describe('10. Production, database, SQL, and secret non-authority', () => {
    it('Audit states no database access', () => {
      assert.match(audit, /Database accessed \| No/);
    });
    it('Audit states no Production or staging access', () => {
      assert.match(audit, /Production or staging accessed \| No/);
    });
    it('Audit states no SQL execution', () => {
      assert.match(audit, /SQL executed \| No/);
    });
    it('Audit states no secret inspection', () => {
      assert.match(audit, /Secrets or credentials inspected \| No/);
    });
    it('Decision states no Production, database, or SQL authority', () => {
      assert.match(decision, /Production access \| None/);
      assert.match(decision, /Database access \| None/);
      assert.match(decision, /SQL execution \| None/);
    });
    it('Completion statements preserve all non-authority boundaries', () => {
      assert.match(audit, /made no database connection, executed no SQL/);
      assert.match(audit, /accessed no provider or Production environment/);
      assert.match(decision, /No database connection was opened, no SQL was executed/);
      assert.match(decision, /no Production or provider environment was accessed/);
    });
  });

  describe('11. Referenced repository paths exist', () => {
    const referencedPaths = [
      'docs/architecture/DB_MIGRATION_PROVENANCE_GATE.md',
      'docs/architecture/migration-path-inventory.json',
      'db/migration-provenance/canonical-migrations.json',
      'db/migration-provenance/expected-schema-manifest.json',
      'db/migration-provenance/ledger-contract.json',
      'db/migration-provenance/adoption-attestation-contract.json',
      'db/migration-provenance/adoption-baseline-collection-plan-contract.json',
      'db/migration-provenance/catalog-metadata-contract.json',
      'db/migration-provenance/production-readonly-catalog-boundary-contract.json',
      'db/migrations/README.md',
      'scripts/check-migration-provenance.cjs',
      'scripts/migration-provenance-core.cjs',
      'scripts/migration-catalog-fingerprint-core.cjs',
      'scripts/adoption-attestation-core.cjs',
      'scripts/production-readonly-catalog-boundary-core.cjs',
      'package.json',
      '.github/workflows/ci.yml',
    ];
    for (const relPath of referencedPaths) {
      it(`Path exists: ${relPath}`, () => {
        assert.ok(existsRepoPath(relPath), `Path must exist: ${relPath}`);
      });
    }
  });

  describe('12. No raw credentials, endpoints, or private values', () => {
    const prohibitedPatterns = [
      /postgres:\/\/[^\s"]+/,
      /postgresql:\/\/[^\s"]+/,
      /password\s*[:=]\s*\S+[^\s.]/i,
      /DATABASE_URL\s*[:=]\s*\S+[^\s.]/,
      /BEGIN.*PRIVATE KEY/,
      /neon\.tech/i,
      /cloud\.neon/i,
    ];
    for (let index = 0; index < prohibitedPatterns.length; index += 1) {
      it(`No prohibited pattern #${index + 1}`, () => {
        assert.doesNotMatch(combined, prohibitedPatterns[index]);
      });
    }
  });

  describe('13. Documents remain substantial and internally bounded', () => {
    it('Audit is substantial', () => {
      assert.ok(audit.length > 500);
    });
    it('Decision is substantial', () => {
      assert.ok(decision.length > 500);
    });
    it('Decision does not claim later children are approved or ready', () => {
      assert.match(decision, /does not claim those later children are approved or ready/);
    });
    it('Precondition authority child remains source-only', () => {
      assert.match(decision, /The `evaluatePrecondition` adapter is \*\*not\*\* implemented/);
      assert.match(decision, /No SQL query, adapter, DB connection, or registry entry is added/);
      assert.match(decision, /No Production mutation occurs/);
    });
  });
});
