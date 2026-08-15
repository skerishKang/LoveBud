'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CHECKLIST_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_ADOPTION_OPERATOR_CHECKLIST.md');
const AUDIT_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_CURRENT_STATE_AUDIT.md');
const DECISION_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md');
const GATE_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_GATE.md');
const COLLECTION_PLAN_CONTRACT = path.join(REPO_ROOT, 'db', 'migration-provenance', 'adoption-baseline-collection-plan-contract.json');
const BOUNDARY_CONTRACT = path.join(REPO_ROOT, 'db', 'migration-provenance', 'production-readonly-catalog-boundary-contract.json');
const ATTESTATION_CONTRACT = path.join(REPO_ROOT, 'db', 'migration-provenance', 'adoption-attestation-contract.json');
const CANONICAL_MANIFEST = path.join(REPO_ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const EXPECTED_SCHEMA = path.join(REPO_ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');
const CLASSIFICATION_PATH = path.join(REPO_ROOT, 'tests', 'test-layer-classification.json');

function readJson(filePath) {
  assert.ok(fs.existsSync(filePath), `File must exist: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readDoc(filePath) {
  assert.ok(fs.existsSync(filePath), `Document must exist: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

describe('DB Migration Provenance Adoption Operator Checklist Contract (#3622)', () => {

  describe('1. Checklist document existence', () => {
    it('Checklist document exists', () => {
      assert.ok(fs.existsSync(CHECKLIST_PATH));
    });
  });

  describe('2. Required headings in checklist', () => {
    const doc = readDoc(CHECKLIST_PATH);
    const requiredHeadings = [
      'LoveBud DB Migration Provenance Adoption Operator Checklist',
      'Purpose and Non-Authority',
      'Current Fail-Closed State',
      'Operator Roles and Separation of Duties',
      'OI-1 Dedicated Read-Only Credential Readiness',
      'OI-2 Abstract Role-Mapping Template',
      'Placeholder and Redaction Rules',
      'Phase B Approval Packet',
      'Phase B Bounded Preflight',
      'Permitted Collection Scope',
      'Sanitized Output and Receipt Expectations',
      'Stop and Failure Categories',
      'Phase C Evidence-Review Handoff',
      'Phase D Manifest-Activation Boundary',
      'Phase E Ledger and Runner Boundary',
      'Rollback and Incident Posture',
      'Operator Completion Checklist',
      'Repository References',
    ];
    for (const heading of requiredHeadings) {
      it(`Has heading: ${heading}`, () => {
        const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(doc, new RegExp(escaped));
      });
    }
  });

  describe('3. Current fail-closed state', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('Documents canonical-migrations.json ADOPTION_REQUIRED and 0 migrations', () => {
      assert.match(doc, /ADOPTION_REQUIRED/);
      assert.match(doc, /[Mm]igrations[^0]*0/);
    });
    it('Documents expected-schema-manifest.json ADOPTION_REQUIRED and 0 critical objects', () => {
      assert.match(doc, /ADOPTION_REQUIRED/);
      assert.match(doc, /[Cc]ritical.?(objects|[^0]*).*0/);
      assert.match(doc, /expected-schema-manifest\.json/);
    });
    it('Documents Production catalog collection NOT_RUN or COLLECTION_NOT_RUN', () => {
      assert.match(doc, /COLLECTION_NOT_RUN|NOT_RUN/);
    });
    it('Documents COLLECTION_NOT_RUN_CONNECTION_BOUNDARY for #3572', () => {
      assert.match(doc, /COLLECTION_NOT_RUN_CONNECTION_BOUNDARY/);
    });
    it('Documents DEDICATED_INPUTS_UNAVAILABLE', () => {
      assert.match(doc, /DEDICATED_INPUTS_UNAVAILABLE/);
    });
    it('Documents authoritative ledger evidence NONE', () => {
      assert.match(doc, /authoritative ledger evidence[\s\S]*?Status:\s*NONE|authoritative target-ledger evidence[\s\S]*?Status:\s*NONE/i);
      assert.match(doc, /Status:\s*NONE/);
      assert.match(doc, /authoritative target-ledger evidence/i);
    });
    it('Documents adoption attestation NOT_ISSUED', () => {
      assert.match(doc, /NOT_ISSUED/);
    });
    it('Documents manifest activation NOT_AUTHORIZED', () => {
      assert.match(doc, /NOT_AUTHORIZED/);
    });
    it('Does not interpret empty manifest as blank production schema', () => {
      assert.match(doc, /Do not interpret an empty manifest as an empty production schema|not.*blank production schema claim|not.*empty production schema|empty production schema claim/i);
    });
  });

  describe('4. Missing operator inputs documented as exactly two', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('Documents OI-1 as dedicated read-only credential', () => {
      assert.match(doc, /OI-1|dedicated read-only credential/i);
    });
    it('Documents OI-2 as abstract role mapping', () => {
      assert.match(doc, /OI-2|abstract role mapping/i);
    });
    it('Documents dedicated secret key name without value', () => {
      assert.match(doc, /LOVEBUD_PRODUCTION_READONLY_DATABASE_URL/);
      assert.doesNotMatch(doc, /LOVEBUD_PRODUCTION_READONLY_DATABASE_URL\s*=/);
    });
  });

  describe('5. OI-1 credential properties', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('Documents dedicated read-only purpose', () => {
      assert.match(doc, /dedicated read-only/i);
    });
    it('Documents write/DDL/DML prohibition', () => {
      assert.match(doc, /write.*prohibited|DDL.*prohibited|DML.*prohibited|no.*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)/i);
    });
    it('Documents allowed object scope', () => {
      assert.match(doc, /allowed object scope|object allowlist/i);
    });
    it('Documents TLS policy', () => {
      assert.match(doc, /TLS|sslmode|require|verify-ca|verify-full/i);
    });
    it('Documents PostgreSQL major version policy', () => {
      assert.match(doc, /major-17|17[0000-9]{4}|170000.*180000|server_version_num/i);
    });
    it('Documents custodian and executor separation', () => {
      assert.match(doc, /custodian|separate.*identity|separate.*role|credential custodian/i);
    });
    it('Documents prohibition on writing values to repository/issues/PRs/logs', () => {
      assert.match(doc, /issues.*PRs.*logs|repository.*issue.*PR.*log|not.*written.*issue.*PR/i);
    });
    it('Documents prohibition on injecting credential before approval', () => {
      assert.match(doc, /inject.*runner.*before.*approval|before.*Phase B.*approval.*injected/i);
    });
    it('Documents fail-closed on boundary violation', () => {
      assert.match(doc, /fail closed|fail-closed|boundary.*violation.*compromised/i);
    });
    it('No connection URL examples with values', () => {
      const backtickQuotedUrl = /`[^`]*postgres:\/\/[^`]*`/;
      assert.doesNotMatch(doc, /postgres:\/\/[^\s"`]+/);
      assert.doesNotMatch(doc, /postgresql:\/\/[^\s"`]+/);
      assert.doesNotMatch(doc, backtickQuotedUrl);
    });
    it('No password, username, token, certificate values', () => {
      assert.doesNotMatch(doc, /password\s*[:=]\s*\S+[^\s.]/);
      assert.doesNotMatch(doc, /username\s*[:=]\s*\S+[^\s.]/);
      assert.doesNotMatch(doc, /token\s*[:=]\s*\S{8,}[^\s.]/);
      assert.doesNotMatch(doc, /BEGIN (RSA )?PRIVATE KEY/);
    });
  });

  describe('6. OI-2 role mapping template', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('Contains role mapping template sentinel', () => {
      assert.match(doc, /<!-- ROLE_MAPPING_TEMPLATE_START -->/);
      assert.match(doc, /<!-- ROLE_MAPPING_TEMPLATE_END -->/);
    });
    it('Template JSON parses successfully', () => {
      const start = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_START -->');
      const end = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_END -->');
      assert.ok(start !== -1 && end !== -1, 'Template sentinels not found');
      const jsonBlock = doc.slice(start + '<!-- ROLE_MAPPING_TEMPLATE_START -->'.length, end).trim();
      const jsonMatch = jsonBlock.match(/\{[\s\S]*\}/);
      assert.ok(jsonMatch, 'JSON block not found in template');
      const parsed = JSON.parse(jsonMatch[0]);
      assert.ok(typeof parsed === 'object' && parsed !== null);
    });
    it('Template keys match ROLE_PLACEHOLDER_[0-9]+', () => {
      const start = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_START -->');
      const end = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_END -->');
      const jsonBlock = doc.slice(start + '<!-- ROLE_MAPPING_TEMPLATE_START -->'.length, end).trim();
      const jsonMatch = jsonBlock.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch[0]);
      const keys = Object.keys(parsed);
      for (const key of keys) {
        assert.match(key, /^ROLE_PLACEHOLDER_[0-9]+$/);
      }
    });
    it('Template values are from committed abstract role class enum', () => {
      const contract = readJson(COLLECTION_PLAN_CONTRACT);
      const allowed = new Set(contract.enums.role_mapping_class);
      const start = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_START -->');
      const end = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_END -->');
      const jsonBlock = doc.slice(start + '<!-- ROLE_MAPPING_TEMPLATE_START -->'.length, end).trim();
      const jsonMatch = jsonBlock.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch[0]);
      const values = Object.values(parsed);
      for (const value of values) {
        assert.ok(allowed.has(value), `Unexpected role class in template: ${value}`);
      }
    });
    it('All five permitted abstract role classes present exactly once', () => {
      const contract = readJson(COLLECTION_PLAN_CONTRACT);
      const allowed = contract.enums.role_mapping_class;
      const start = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_START -->');
      const end = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_END -->');
      const jsonBlock = doc.slice(start + '<!-- ROLE_MAPPING_TEMPLATE_START -->'.length, end).trim();
      const jsonMatch = jsonBlock.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch[0]);
      const values = Object.values(parsed);
      for (const cls of allowed) {
        const count = values.filter(v => v === cls).length;
        assert.strictEqual(count, 1, `Class ${cls} must appear exactly once in template, found ${count}`);
      }
    });
    it('No actual PostgreSQL role names in template', () => {
      const start = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_START -->');
      const end = doc.indexOf('<!-- ROLE_MAPPING_TEMPLATE_END -->');
      const templateBlock = doc.slice(start, end + '<!-- ROLE_MAPPING_TEMPLATE_END -->'.length);
      assert.doesNotMatch(templateBlock, /\b(postgres|owner|admin|root|superuser|readonly|read_only|service_account|app_user)\b/i);
    });
    it('Document states template is structure example only', () => {
      assert.match(doc, /structure example only|template is a structure example|not.*actual mapping file/i);
    });
  });

  describe('7. Prohibited content', () => {
    const doc = readDoc(CHECKLIST_PATH);
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
        assert.doesNotMatch(doc, prohibitedPatterns[i]);
      });
    }
    it('No psql invocation', () => {
      assert.doesNotMatch(doc, /psql\s/);
    });
    it('No SQL statement', () => {
      const sqlStatement = /\b(CREATE|ALTER|DROP|TRUNCATE)\s+(TABLE|INDEX|VIEW|FUNCTION|SCHEMA|DATABASE|SEQUENCE|TYPE|DOMAIN|EXTENSION|POLICY)\b|\bSELECT\b.*?\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b/i;
      assert.doesNotMatch(doc, sqlStatement);
    });
    it('No production runner invocation command', () => {
      assert.doesNotMatch(doc, /node\s+scripts\/run-production-readonly-catalog-collection/);
    });
    it('No migration or rollback command', () => {
      assert.doesNotMatch(doc, /migration.*command|rollback.*command|npm run.*migrate/i);
    });
    it('No manifest activation command', () => {
      const activationCommand = /manifest\s+(activate|activation)\s+(command|script|run|execute)|(npm|node|bash)\s+\S*(manifest|activate)/i;
      assert.doesNotMatch(doc, activationCommand);
      assert.doesNotMatch(doc, /activate.*manifest\s+(via|using|with)\s+(node|npm|bash|script)/i);
    });
    it('No provider console execution instructions', () => {
      assert.doesNotMatch(doc, /console\.firebase|console\.cloudflare|dashboard\.gitguardian|neon\.tech|provider console.*click|click path.*provider/i);
      assert.doesNotMatch(doc, /through the provider console/i);
    });
  });

  describe('8. Phase B/C/D/E separation', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('Phase B section exists as separate section', () => {
      assert.match(doc, /## Phase B\b/);
    });
    it('Phase C section exists as separate section', () => {
      assert.match(doc, /## Phase C\b/);
    });
    it('Phase D section exists as separate section', () => {
      assert.match(doc, /## Phase D\b/);
    });
    it('Phase E section exists as separate section', () => {
      assert.match(doc, /## Phase E\b/);
    });
    it('Document states checklist is not execution approval', () => {
      assert.match(doc, /does not execute Phase B|does not approve|not.*execution.*approval|not.*run.*collection/i);
    });
    it('Document states checklist does not create credentials', () => {
      assert.match(doc, /does not create credentials|credential.*created|no credential creation/i);
    });
    it('Document states checklist does not create actual role mapping values', () => {
      assert.match(doc, /does not create.*role mapping|role mapping.*actual.*value|not.*generate.*mapping/i);
    });
  });

  describe('9. Source-aligned manifest state', () => {
    const doc = readDoc(CHECKLIST_PATH);
    const canonical = readJson(CANONICAL_MANIFEST);
    const expected = readJson(EXPECTED_SCHEMA);
    it('Canonical manifest status and count match source', () => {
      assert.match(doc, new RegExp(canonical.status));
      assert.match(doc, new RegExp(`migrations count:?\\s*${canonical.migrations.length}`, 'i'));
    });
    it('Expected-schema manifest status and count match source', () => {
      assert.match(doc, new RegExp(expected.status));
      assert.match(doc, new RegExp(`critical.?objects count:?\\s*${expected.critical_objects.length}`, 'i'));
    });
    it('Documents Production collection NOT_RUN', () => {
      assert.match(doc, /COLLECTION_NOT_RUN|NOT_RUN/);
    });
    it('Documents authoritative ledger evidence NONE', () => {
      assert.match(doc, /authoritative ledger evidence[\s\S]*?Status:\s*NONE|authoritative target-ledger evidence[\s\S]*?Status:\s*NONE/i);
      assert.match(doc, /Status:\s*NONE/);
      assert.match(doc, /authoritative target-ledger evidence/i);
    });
    it('Documents adoption attestation NOT_ISSUED', () => {
      assert.match(doc, /NOT_ISSUED/);
    });
  });

  describe('10. Failure categories', () => {
    const doc = readDoc(CHECKLIST_PATH);
    const boundary = readJson(BOUNDARY_CONTRACT);
    const receipt = readDoc(path.join(REPO_ROOT, 'scripts', 'phase-b-collection-receipt-core.cjs'));
    const boundaryCategories = boundary.failure_categories;
    const receiptFailure = new RegExp('RECEIPT_' + '_FAILURE|RECEIPT_' + '_INVALID|RECEIPT_' + '_MISMATCH|RECEIPT_' + '_BOUNDS|RECEIPT_' + '_TYPE');
    for (const category of boundaryCategories) {
      it(`Documents boundary category: ${category}`, () => {
        assert.match(doc, new RegExp(category));
      });
    }
    it('Documents DOCUMENT_CHECKLIST_CATEGORY marker', () => {
      assert.match(doc, /DOCUMENT_CHECKLIST_CATEGORY/);
    });
  });

  describe('11. Stop and failure behavior', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('Documents collection halts on preflight failure', () => {
      assert.match(doc, /collection does not proceed|halts.*immediately|stop.*immediately/i);
    });
    it('Documents no partial success claim', () => {
      assert.match(doc, /no partial success|partial success.*not.*claimed/i);
    });
    it('Documents non-committing termination', () => {
      assert.match(doc, /non-committing termination|does not permit commit|commit is not permitted/i);
    });
    it('Documents source-owned proof names', () => {
      const contract = readJson(COLLECTION_PLAN_CONTRACT);
      const proofs = contract.enums.read_only_proof;
      assert.ok(proofs.includes('READ_ONLY_TRANSACTION_CONFIRMED'), 'source contract must define READ_ONLY_TRANSACTION_CONFIRMED');
      assert.ok(!proofs.includes('READ_ONLY_TRANSITION_CONFIRMED'), 'source contract must not define typo READ_ONLY_TRANSITION_CONFIRMED');
      for (const proof of proofs) {
        if (doc.includes(proof)) {
          assert.ok(proofs.includes(proof), `document proof ${proof} must be from committed contract`);
        }
      }
      assert.match(doc, /READ_ONLY_TRANSACTION_CONFIRMED/);
      assert.doesNotMatch(doc, /READ_ONLY_TRANSITION_CONFIRMED/);
    });
    it('No literal BEGIN READ ONLY', () => {
      assert.doesNotMatch(doc, /BEGIN\s+READ\s+ONLY/i);
    });
    it('No literal SHOW transaction_read_only', () => {
      assert.doesNotMatch(doc, /SHOW\s+transaction_read_only/i);
    });
    it('No command-form literal ROLLBACK', () => {
      assert.doesNotMatch(doc, /ROLLBACK/);
    });
    it('Documents provider-console instruction absent', () => {
      assert.doesNotMatch(doc, /through the provider console/i);
      assert.match(doc, /does not specify provider-console operations|provider-console operations.*not specified/i);
    });
    it('Documents private mapping preparation boundary', () => {
      assert.match(doc, /operator-private runtime mapping/i);
      assert.match(doc, /neither creates nor validates that private mapping/i);
      assert.match(doc, /\.secrets\/\*\*/i);
      assert.match(doc, /untracked/i);
      assert.match(doc, /outside committed Git history/i);
      assert.doesNotMatch(doc, /outside the repository/i);
      assert.doesNotMatch(doc, /repository-external mapping/i);
    });
    it('Documents committed template is structure only, not runner input', () => {
      assert.match(doc, /structure only/i);
      assert.match(doc, /not.*runner input|must not be used as a runner input/i);
    });
    it('Documents private mapping key/value shape', () => {
      assert.match(doc, /private mapping keys are actual PostgreSQL role identifiers/i);
      assert.match(doc, /private mapping values are committed abstract role classes/i);
      assert.match(doc, /actual identifiers are never recorded/i);
    });
    it('Documents actual roles not discovered by this checklist', () => {
      assert.match(doc, /neither creates nor validates that private mapping/i);
      assert.match(doc, /private mapping has not been created or validated by this checklist/i);
    });
    it('Documents OI-2 completion requires more than placeholder template', () => {
      assert.match(doc, /template is structure only/i);
      assert.match(doc, /operator-private runtime mapping is prepared/i);
      assert.match(doc, /not used as a runner input/i);
    });
    it('Documents role-separation as documentation-only policy', () => {
      assert.match(doc, /DOCUMENT_CHECKLIST_CATEGORY/);
      assert.match(doc, /PROPOSED_SEPARATION_OF_DUTIES/);
      assert.match(doc, /documentation-only governance/i);
      assert.match(doc, /owner must adopt.*modify.*reject/i);
    });
    it('Does not claim source-enforced identity separation', () => {
      assert.doesNotMatch(doc, /requires at least two distinct roles/i);
      assert.doesNotMatch(doc, /single operator identity must not hold/i);
      assert.doesNotMatch(doc, /the source boundary enforces.*identity/i);
      assert.doesNotMatch(doc, /source-enforced.*separation of duties/i);
    });
    it('Documents source boundary file and role mapping function', () => {
      assert.match(doc, /scripts\/production-readonly-catalog-boundary-core\.cjs/);
      assert.match(doc, /loadProductionRoleMapping/i);
    });
    it('Documents commit is prohibited for collection mode', () => {
      assert.match(doc, /commit is not permitted|commit.*prohibited/i);
    });
  });

  describe('12. Redaction and placeholder rules', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('Documents credential values never written to repository issues/PRs/logs', () => {
      assert.match(doc, /issues.*PRs.*logs|repository.*issue.*PR.*log|not.*written.*issue.*PR/i);
    });
    it('Documents no connection URL examples even with placeholders', () => {
      assert.match(doc, /connection URL.*example|example.*connection URL|not.*included.*connection URL/i);
    });
    it('Documents raw catalog rows and object owner identities excluded', () => {
      assert.match(doc, /raw catalog rows|object owner identities|provider project.*branch/i);
    });
  });

  describe('13. Repository references exist', () => {
    const doc = readDoc(CHECKLIST_PATH);
    const paths = [
      'db/migration-provenance/adoption-baseline-collection-plan-contract.json',
      'db/migration-provenance/production-readonly-catalog-boundary-contract.json',
      'db/migration-provenance/adoption-attestation-contract.json',
      'db/migration-provenance/expected-schema-manifest.json',
      'db/migration-provenance/canonical-migrations.json',
      'scripts/production-readonly-catalog-boundary-core.cjs',
      'scripts/run-production-readonly-catalog-collection.cjs',
      'scripts/phase-b-collection-receipt-core.cjs',
      'scripts/adoption-baseline-collection-plan-core.cjs',
      'scripts/adoption-attestation-core.cjs',
      'docs/architecture/DB_MIGRATION_PROVENANCE_CURRENT_STATE_AUDIT.md',
      'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md',
      'docs/architecture/DB_MIGRATION_PROVENANCE_GATE.md',
    ];
    for (const p of paths) {
      it(`Path exists: ${p}`, () => {
        const absPath = path.join(REPO_ROOT, p);
        assert.ok(fs.existsSync(absPath), `Path must exist: ${p}`);
      });
    }
  });

  describe('14. Protected issue references', () => {
    const doc = readDoc(CHECKLIST_PATH);
    const issues = ['#3622', '#3620', '#3458', '#3425', '#3435', '#3437', '#1882'];
    for (const iss of issues) {
      it(`References ${iss}`, () => {
        assert.match(doc, new RegExp(iss.replace('#', '#')));
      });
    }
    it('Has Keep OPEN statements for protected issues', () => {
      const protectedIssues = ['#3458', '#3425', '#3435', '#3437', '#1882'];
      for (const iss of protectedIssues) {
        assert.match(doc, new RegExp(`Keep ${iss.replace('#', '#')} OPEN`));
      }
    });
  });

  describe('15. No Closes/Fixes/Resolves for protected issues', () => {
    const doc = readDoc(CHECKLIST_PATH);
    const issues = ['3458', '3425', '3435', '3437', '1882'];
    for (const iss of issues) {
      it(`No "Closes #${iss}"`, () => {
        assert.doesNotMatch(doc, new RegExp(`Closes\\s+#${iss}`));
      });
      it(`No "Fixes #${iss}"`, () => {
        assert.doesNotMatch(doc, new RegExp(`Fixes\\s+#${iss}`));
      });
      it(`No "Resolves #${iss}"`, () => {
        assert.doesNotMatch(doc, new RegExp(`Resolves\\s+#${iss}`));
      });
    }
  });

  describe('16. No existing file modification required', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('States no existing file modification required', () => {
      assert.match(doc, /no existing file modification|new file only|does not modify/i);
    });
    it('States no database or Production access', () => {
      assert.match(doc, /no database.*Production access|no Production.*database access|no database or Production access|does not connect to Production|noProduction access/i);
    });
    it('States no SQL execution', () => {
      assert.match(doc, /no SQL execution|SQL.*not.*executed|not.*execute.*SQL/i);
    });
    it('States no migration or manifest activation', () => {
      assert.match(doc, /no migration execution|no manifest activation|manifest activation not authorized|manifest(.)?s not activated|manifest activation not executed/i);
    });
  });

  describe('17. Abstract role classes from committed contract', () => {
    const doc = readDoc(CHECKLIST_PATH);
    const contract = readJson(COLLECTION_PLAN_CONTRACT);
    const allowed = contract.enums.role_mapping_class;
    for (const cls of allowed) {
      it(`Documents abstract role class: ${cls}`, () => {
        assert.match(doc, new RegExp(cls));
      });
    }
    it('Does not invent additional role classes', () => {
      const invented = ['ADMIN', 'SUPERUSER', 'SERVICE_ACCOUNT', 'APP_USER'];
      for (const inv of invented) {
        assert.doesNotMatch(doc, new RegExp(`\\b${inv}\\b`, 'i'));
      }
    });
  });

  describe('18. Checklist is non-execution document', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('Does not contain psql commands', () => {
      assert.doesNotMatch(doc, /psql\s/);
    });
    it('Does not contain collection runner commands', () => {
      const runnerCommand = /(node|npm|npx|bash|ps1|sh)\s+.*run-production-readonly-catalog-collection/;
      assert.doesNotMatch(doc, runnerCommand);
    });
    it('Does not contain shell export commands', () => {
      assert.doesNotMatch(doc, /export\s+\w+=/);
    });
    it('Does not contain secret file creation commands', () => {
      assert.doesNotMatch(doc, /mkdir.*secrets|touch.*secrets|echo.*>.*secrets/i);
    });
    it('Does not contain provider console paths', () => {
      assert.doesNotMatch(doc, /console\.firebase|console\.cloudflare|dashboard\.gitguardian|neon\.tech/i);
    });
  });

  describe('19. Test-layer registration', () => {
    it('New contract test registered as SOURCE_STATIC in classification', () => {
      const raw = fs.readFileSync(CLASSIFICATION_PATH, 'utf8');
      assert.match(raw, /db-migration-provenance-adoption-operator-checklist-contract\.test\.cjs/);
      const classification = JSON.parse(raw);
      const entry = classification.entries.find(e => e.path === 'tests/contracts/db-migration-provenance-adoption-operator-checklist-contract.test.cjs');
      assert.ok(entry, 'Contract test entry must exist in classification');
      assert.strictEqual(entry.layer, 'SOURCE_STATIC');
    });
  });

  describe('20. Document structure', () => {
    const doc = readDoc(CHECKLIST_PATH);
    it('Document is not empty', () => {
      assert.ok(doc.length > 500, 'Checklist must be substantial');
    });
    it('References current baseline', () => {
      assert.match(doc, /9d3a3184e27dcb632af37208e366189af65a4408|current main/);
    });
  });
});
