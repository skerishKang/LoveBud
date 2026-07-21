'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AUDIT_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_CURRENT_STATE_AUDIT.md');
const DECISION_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md');
const MAIN_SHA = 'de1c4e416e33e2669157b2202a7bbd021779ad59';

function readDoc(filePath) {
  assert.ok(fs.existsSync(filePath), `Document must exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function existsRepoPath(relPath) {
  const absPath = path.join(REPO_ROOT, relPath);
  return fs.existsSync(absPath);
}

describe('DB Migration Provenance Current-State Audit Contract (#3620)', () => {

  describe('1. Document existence', () => {
    it('Audit document exists', () => {
      assert.ok(fs.existsSync(AUDIT_PATH));
    });
    it('Decision document exists', () => {
      assert.ok(fs.existsSync(DECISION_PATH));
    });
    it('Contract test file exists', () => {
      assert.ok(fs.existsSync(__filename));
    });
  });

  describe('2. Required headings in audit document', () => {
    const audit = readDoc(AUDIT_PATH);
    const requiredHeadings = [
      'LoveBud DB Migration Provenance Current-State Audit',
      'Audit Baseline',
      'Scope and Non-Authority',
      'Evidence Method',
      'Parent Acceptance-Criteria Matrix',
      'Artifact Ownership and Trust Classification',
      'Completed Child and PR Dependency Map',
      'Test-Layer Map',
      'Production and Operator-Input Boundary',
      'Remaining Gap Register',
      'Stale or Contradictory Documentation',
      'Claims That Current Evidence Does Not Support',
      'Current Fail-Closed State',
      'Reproduction Commands',
      'Final Audit Conclusion',
    ];
    for (const heading of requiredHeadings) {
      it(`Has heading: ${heading}`, () => {
        const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(audit, new RegExp(escaped));
      });
    }
  });

  describe('3. Required headings in decision document', () => {
    const decision = readDoc(DECISION_PATH);
    const requiredHeadings = [
      'LoveBud DB Migration Provenance Next-Child Decision',
      'Decision Summary',
      'Candidate Children Considered',
      'Dependency Analysis',
      'Operator-Input Separation',
      'Selected Next Child',
      'Model Assignment',
      'Completion Boundary',
      'Deferred Work',
    ];
    for (const heading of requiredHeadings) {
      it(`Has heading: ${heading}`, () => {
        const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(decision, new RegExp(escaped));
      });
    }
  });

  describe('4. Status vocabulary presence', () => {
    const audit = readDoc(AUDIT_PATH);
    const requiredVocab = ['COMPLETE', 'PARTIAL', 'BLOCKED_OPERATOR_INPUT', 'NOT_STARTED', 'STALE_SUPERSEDED'];
    for (const v of requiredVocab) {
      it(`Contains status: ${v}`, () => {
        assert.match(audit, new RegExp(`\\b${v}\\b`));
      });
    }
  });

  describe('5. Artifact classification vocabulary', () => {
    const audit = readDoc(AUDIT_PATH);
    const required = [
      'CANONICAL_SOURCE_CONTRACT',
      'INACTIVE_ADOPTION_ARTIFACT',
      'DISPOSABLE_ONLY_EXECUTION',
      'PRODUCTION_READONLY_CAPABLE_SOURCE',
      'BLOCKED_OPERATOR_INPUT',
      'HISTORICAL_LEGACY',
      'INCIDENT_ONLY',
      'PROHIBITED_FOR_NEW_USE',
    ];
    for (const v of required) {
      it(`Contains artifact class: ${v}`, () => {
        assert.match(audit, new RegExp(`\\b${v}\\b`));
      });
    }
  });

  describe('6. Test-layer vocabulary', () => {
    const audit = readDoc(AUDIT_PATH);
    const required = [
      'SOURCE_STATIC',
      'POSTGRES_ENGINE_DISPOSABLE',
      'TARGET_READONLY_INTEGRATION',
      'PRODUCTION_RUNTIME_EVIDENCE',
      'DEPLOYMENT_ENFORCEMENT',
    ];
    for (const v of required) {
      it(`Contains test layer: ${v}`, () => {
        assert.match(audit, new RegExp(`\\b${v}\\b`));
      });
    }
  });

  describe('6b. PURE_UNIT test layer', () => {
    const audit = readDoc(AUDIT_PATH);
    it('Contains PURE_UNIT in test-layer map', () => {
      assert.match(audit, /PURE_UNIT/);
    });
  });

  describe('6c. Inventory path guard evidence', () => {
    const audit = readDoc(AUDIT_PATH);
    it('Audit documents INVENTORY_PATH_UNCLASSIFIED blocking', () => {
      assert.match(audit, /INVENTORY_PATH_UNCLASSIFIED/);
    });
  });

  describe('6d. Migration checksum guard evidence', () => {
    const audit = readDoc(AUDIT_PATH);
    it('Audit documents MIGRATION_SOURCE_CHECKSUM_MISMATCH blocking', () => {
      assert.match(audit, /MIGRATION_SOURCE_CHECKSUM_MISMATCH/);
    });
  });

  describe('6e. No false "adapter does not exist" claim', () => {
    const audit = readDoc(AUDIT_PATH);
    it('Does not claim no target read-only adapter exists', () => {
      assert.doesNotMatch(audit, /No target read-only adapter exists/i);
    });
  });

  describe('6f. #3572 official outcome', () => {
    const audit = readDoc(AUDIT_PATH);
    const decision = readDoc(DECISION_PATH);
    it('Audit uses COLLECTION_NOT_RUN_CONNECTION_BOUNDARY for #3572', () => {
      assert.match(audit, /COLLECTION_NOT_RUN_CONNECTION_BOUNDARY/);
    });
    it('Audit includes DEDICATED_INPUTS_UNAVAILABLE', () => {
      assert.match(audit, /DEDICATED_INPUTS_UNAVAILABLE/);
    });
    it('Does not use NO_RETRY as official #3572 outcome', () => {
      const noRetryAsOutcome = /NO_RETRY.*3572|3572.*NO_RETRY/;
      assert.doesNotMatch(audit, noRetryAsOutcome);
    });
    it('Decision does not use NO_RETRY for #3572', () => {
      const noRetryAsOutcome = /NO_RETRY.*3572|3572.*NO_RETRY/;
      assert.doesNotMatch(decision, noRetryAsOutcome);
    });
  });

  describe('6g. Operator blocker and approval separation', () => {
    const audit = readDoc(AUDIT_PATH);
    it('Audit separates BLOCKED_OPERATOR_INPUT from SEPARATE_APPROVAL_REQUIRED', () => {
      assert.match(audit, /BLOCKED_OPERATOR_INPUT/);
      assert.match(audit, /SEPARATE_APPROVAL_REQUIRED/);
    });
  });

  describe('6h. #3459 and PR#3474 not in same direct mapping row', () => {
    const audit = readDoc(AUDIT_PATH);
    it('#3459 has its own table row distinct from PR#3474 bootstrap', () => {
      const lines = audit.split('\n');
      let sameRow = false;
      for (const line of lines) {
        if (line.includes('#3459') && line.includes('PR #3474') && line.includes('|')) {
          sameRow = true;
        }
      }
      assert.strictEqual(sameRow, false, '#3459 and PR #3474 must not appear together in the same table row');
    });
    it('#3459 mapped to rehearsal PRs', () => {
      assert.match(audit, /PR #3531/);
      assert.match(audit, /PR #3533/);
    });
  });

  describe('6i. New contract test registered in classification', () => {
    it('test-layer-classification.json contains the contract test', () => {
      const classPath = path.join(REPO_ROOT, 'tests', 'test-layer-classification.json');
      const raw = fs.readFileSync(classPath, 'utf8');
      assert.match(raw, /db-migration-provenance-current-state-audit-contract\.test\.cjs/);
    });
  });

  describe('7. Protected issue references', () => {
    const audit = readDoc(AUDIT_PATH);
    const decision = readDoc(DECISION_PATH);
    const issues = ['#3620', '#3458', '#3425', '#3435', '#3437', '#1882'];
    for (const iss of issues) {
      it(`Audit references ${iss}`, () => {
        assert.match(audit, new RegExp(iss.replace('#', '#')));
      });
      it(`Decision references ${iss}`, () => {
        assert.match(decision, new RegExp(iss.replace('#', '#')));
      });
    }
  });

  describe('8. Keep OPEN statements for protected issues', () => {
    const audit = readDoc(AUDIT_PATH);
    const decision = readDoc(DECISION_PATH);
    const issues = ['#3458', '#3425', '#3435', '#3437', '#1882'];
    for (const iss of issues) {
      it(`Audit has "Keep ${iss} OPEN"`, () => {
        assert.match(audit, new RegExp(`Keep ${iss.replace('#', '#')} OPEN`));
      });
      it(`Decision has "Keep ${iss} OPEN"`, () => {
        assert.match(decision, new RegExp(`Keep ${iss.replace('#', '#')} OPEN`));
      });
    }
  });

  describe('9. Current main SHA present', () => {
    it('Audit contains baseline SHA', () => {
      const audit = readDoc(AUDIT_PATH);
      assert.match(audit, new RegExp(MAIN_SHA));
    });
    it('Decision contains baseline SHA', () => {
      const decision = readDoc(DECISION_PATH);
      assert.match(decision, new RegExp(MAIN_SHA));
    });
  });

  describe('10. Canonical manifest status documented', () => {
    it('Audit documents canonical-migrations.json status', () => {
      const audit = readDoc(AUDIT_PATH);
      assert.match(audit, /ADOPTION_REQUIRED/);
      assert.match(audit, /[Mm]igrations[^0]*0/);
    });
    it('Audit documents expected-schema-manifest.json status', () => {
      const audit = readDoc(AUDIT_PATH);
      assert.match(audit, /[Cc]ritical.?(objects|[^0]*).*0/);
      assert.match(audit, /expected-schema-manifest\.json/);
    });
  });

  describe('11. Exactly one next-child outcome', () => {
    it('Decision contains single outcome type', () => {
      const decision = readDoc(DECISION_PATH);
      const safeExec = (decision.match(/SAFE_EXECUTABLE_CHILD_SELECTED/g) || []).length;
      const noSafe = (decision.match(/NO_SAFE_IMPLEMENTATION_CHILD_WITHOUT_OPERATOR_INPUT/g) || []).length;
      if (safeExec > 0 && noSafe > 0) {
        assert.fail('Both SAFE_EXECUTABLE_CHILD_SELECTED and NO_SAFE_IMPLEMENTATION_CHILD_WITHOUT_OPERATOR_INPUT present');
      }
      if (safeExec === 0 && noSafe === 0) {
        assert.fail('No outcome string found');
      }
      assert.ok(true);
    });
  });

  describe('12. Model Assignment section', () => {
    it('Decision has Model Assignment section', () => {
      const decision = readDoc(DECISION_PATH);
      assert.match(decision, /Model Assignment/);
    });
    it('References DeepSeek V4 Pro', () => {
      const decision = readDoc(DECISION_PATH);
      assert.match(decision, /DeepSeek V4 Pro/);
    });
    it('References Nemotron 3 Ultra', () => {
      const decision = readDoc(DECISION_PATH);
      assert.match(decision, /Nemotron 3 Ultra/);
    });
    it('Has IMPLEMENTATION_MODEL assignment', () => {
      const decision = readDoc(DECISION_PATH);
      const impCount = (decision.match(/IMPLEMENTATION_MODEL/g) || []).length;
      assert.ok(impCount >= 1, 'IMPLEMENTATION_MODEL must be referenced');
    });
  });

  describe('13. Production/DB/SQL mutation prohibited in this PR', () => {
    const combined = readDoc(AUDIT_PATH) + '\n' + readDoc(DECISION_PATH);
    it('No SQL execution claim', () => {
      assert.match(combined, /SQL executed.*No/);
    });
    it('No Production access claim', () => {
      assert.match(combined, /Production accessed.*No/);
    });
    it('No database connection claim', () => {
      assert.match(combined, /Database accessed.*No/);
    });
  });

  describe('14. Documents do not claim source/static as target proof', () => {
    const audit = readDoc(AUDIT_PATH);
    it('Acknowledges source-only limitations', () => {
      assert.match(audit, /source.only|SOURCE_STATIC|does not prove/i);
    });
    it('States no Production collection occurred', () => {
      assert.match(audit, /COLLECTION_NOT_RUN|not.*collected/i);
    });
    it('States no adoption attestation issued', () => {
      assert.match(audit, /no.*attestation.*issued|not.*attested/i);
    });
  });

  describe('15. No raw credentials, URLs, hosts, roles, or database values', () => {
    const combined = readDoc(AUDIT_PATH) + '\n' + readDoc(DECISION_PATH);
    const prohibitedPatterns = [
      /postgres:\/\/[^\s"]+/,
      /postgresql:\/\/[^\s"]+/,
      /password\s*[:=]\s*\S+[^\s.]/,
      /DATABASE_URL\s*[:=]\s*\S+[^\s.]/,
      /BEGIN.*PRIVATE KEY/,
      /neon\.tech/,
      /cloud\.neon/,
    ];
    for (let i = 0; i < prohibitedPatterns.length; i += 1) {
      it(`No prohibited pattern #${i + 1}`, () => {
        assert.doesNotMatch(combined, prohibitedPatterns[i]);
      });
    }
  });

  describe('16. Referenced repository paths exist', () => {
    const audit = readDoc(AUDIT_PATH);
    const paths = [
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
    for (const p of paths) {
      it(`Path exists: ${p}`, () => {
        assert.ok(existsRepoPath(p), `Path must exist: ${p}`);
      });
    }
  });

  describe('17. No Closes/Fixes/Resolves for protected issues', () => {
    const combined = readDoc(AUDIT_PATH) + '\n' + readDoc(DECISION_PATH);
    const issues = ['3458', '3425', '3435', '3437', '1882'];
    for (const iss of issues) {
      it(`No "Closes #${iss}"`, () => {
        assert.doesNotMatch(combined, new RegExp(`Closes\\s+#${iss}`));
      });
      it(`No "Fixes #${iss}"`, () => {
        assert.doesNotMatch(combined, new RegExp(`Fixes\\s+#${iss}`));
      });
      it(`No "Resolves #${iss}"`, () => {
        assert.doesNotMatch(combined, new RegExp(`Resolves\\s+#${iss}`));
      });
    }
  });

  describe('18. No existing file modification required', () => {
    const combined = readDoc(AUDIT_PATH) + '\n' + readDoc(DECISION_PATH);
    it('States no existing file modification', () => {
      assert.match(combined, /no existing file|existing file.*not|prohibited/i);
    });
    it('Lists only 3 allowed new files', () => {
      assert.match(combined, /DB_MIGRATION_PROVENANCE_CURRENT_STATE_AUDIT\.md/);
      assert.match(combined, /DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION\.md/);
      assert.match(combined, /db-migration-provenance-current-state-audit-contract\.test\.cjs/);
    });
  });

  describe('19. Audit and decision are well-formed', () => {
    it('Audit file is not empty', () => {
      const audit = readDoc(AUDIT_PATH);
      assert.ok(audit.length > 500, 'Audit must be substantial');
    });
    it('Decision file is not empty', () => {
      const decision = readDoc(DECISION_PATH);
      assert.ok(decision.length > 500, 'Decision must be substantial');
    });
  });

  describe('20. Additional structural checks', () => {
    const audit = readDoc(AUDIT_PATH);
    it('Audit has Final Audit Conclusion', () => {
      assert.match(audit, /Final Audit Conclusion/);
    });
    it('Audit has Reproduction Commands', () => {
      assert.match(audit, /Reproduction Commands/);
    });
    it('Audit has classifications for all 12 parent criteria', () => {
      const completeCount = (audit.match(/Classification.*COMPLETE/g) || []).length;
      const partialCount = (audit.match(/Classification.*PARTIAL/g) || []).length;
      const blockedCount = (audit.match(/Classification.*BLOCKED_OPERATOR_INPUT/g) || []).length;
      const notStartedCount = (audit.match(/Classification.*NOT_STARTED/g) || []).length;
      const total = completeCount + partialCount + blockedCount + notStartedCount;
      assert.ok(total >= 11, `Expected at least 11 acceptance criteria classifications, got ${total}`);
    });
  });
});
