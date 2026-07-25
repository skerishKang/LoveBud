'use strict';

/**
 * Focused SOURCE_STATIC contract test: precondition registry source validation (#3659).
 *
 * Exercises scripts/migration-precondition-registry-validator-core.cjs using
 * ONLY synthetic JavaScript objects. No DB, PostgreSQL, Docker, SQL fixture,
 * network, or environment secret is used.
 *
 * Refs #3659
 * Refs #3657
 * Refs #3658
 * Refs #3652
 * Refs #3650
 * Refs #3646
 *
 * Refs #3458 — Keep OPEN.
 * Refs #3425 — Keep OPEN.
 * Refs #3435 — Keep OPEN.
 * Refs #3437 — Keep OPEN.
 * Refs #1882 — Keep OPEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VALIDATOR_PATH = path.join(REPO_ROOT, 'scripts', 'migration-precondition-registry-validator-core.cjs');

const {
  validatePreconditionRegistry,
  validateRegistryManifestBinding,
  validatePlainObjectShape,
  isNonProxyObject,
  isDenseArray,
  MIGRATION_ID_PATTERN,
  KEBAB_CASE_PATTERN,
  ALLOWED_TOP_LEVEL_KEYS,
  ALLOWED_ENTRY_KEYS,
  ALLOWED_CHECK_KEYS,
  FORBIDDEN_AUTHORITY_KEYS,
  VALID_FORMAT_VERSION,
  VALID_STATUSES
} = require(VALIDATOR_PATH);

// --- Authoritative valid fixtures ---
const VALID_MIGRATION_ID = '20260725000000_example-migration';
const VALID_CHECK_ID = 'check-1';
const VALID_QUERY_REF = 'example-readonly-query-v1';

function validRegistry(overrides) {
  return {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    entries: [],
    ...overrides
  };
}

function activeRegistry(entries) {
  return {
    format_version: '1.0',
    status: 'ACTIVE',
    entries: entries || [
      {
        migration_id: VALID_MIGRATION_ID,
        checks: [
          {
            check_id: VALID_CHECK_ID,
            query_reference: VALID_QUERY_REF,
            expected: true
          }
        ]
      }
    ]
  };
}

function adopterRequiredManifest() {
  return {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    canonical_directory: 'db/migrations',
    migrations: []
  };
}

function activeManifest(migrations) {
  return {
    format_version: '1.0',
    status: 'ACTIVE',
    canonical_directory: 'db/migrations',
    migrations: migrations || [
      {
        id: VALID_MIGRATION_ID,
        name: 'example migration',
        path: 'db/migrations/' + VALID_MIGRATION_ID + '.sql',
        checksum: 'sha256:' + 'a'.repeat(64),
        depends_on: [],
        risk_class: 'ADDITIVE',
        transaction_mode: 'REQUIRED',
        expected_preconditions: [],
        expected_postconditions: [],
        rollback_support: 'none',
        destructive_operations: [],
        owner_domain: 'db',
        approval_reference: 'issue:9999'
      }
    ]
  };
}

describe('DB precondition registry source validation contract (#3659)', () => {

  describe('1. Public surface', () => {
    it('1. validatePreconditionRegistry is a function', () => {
      assert.strictEqual(typeof validatePreconditionRegistry, 'function');
    });

    it('2. validateRegistryManifestBinding is a function', () => {
      assert.strictEqual(typeof validateRegistryManifestBinding, 'function');
    });

    it('3. ALLOWED_TOP_LEVEL_KEYS is frozen', () => {
      assert.ok(Object.isFrozen(ALLOWED_TOP_LEVEL_KEYS));
    });

    it('4. ALLOWED_ENTRY_KEYS is frozen', () => {
      assert.ok(Object.isFrozen(ALLOWED_ENTRY_KEYS));
    });

    it('5. ALLOWED_CHECK_KEYS is frozen', () => {
      assert.ok(Object.isFrozen(ALLOWED_CHECK_KEYS));
    });

    it('6. FORBIDDEN_AUTHORITY_KEYS is frozen', () => {
      assert.ok(Object.isFrozen(FORBIDDEN_AUTHORITY_KEYS));
    });

    it('7. MIGRATION_ID_PATTERN is correct', () => {
      assert.ok(MIGRATION_ID_PATTERN.test(VALID_MIGRATION_ID));
      assert.ok(!MIGRATION_ID_PATTERN.test('test'));
      assert.ok(!MIGRATION_ID_PATTERN.test('20260725_test'));
      assert.ok(!MIGRATION_ID_PATTERN.test('20260725000000_Test'));
      assert.ok(!MIGRATION_ID_PATTERN.test('20260725000000_test_name'));
      assert.ok(!MIGRATION_ID_PATTERN.test('20260725000000_-test'));
      assert.ok(!MIGRATION_ID_PATTERN.test(' 20260725000000_test'));
      assert.ok(!MIGRATION_ID_PATTERN.test('20260725000000_test '));
    });

    it('8. KEBAB_CASE_PATTERN is correct', () => {
      assert.ok(KEBAB_CASE_PATTERN.test('example-readonly-query-v1'));
      assert.ok(!KEBAB_CASE_PATTERN.test('c_1'));
      assert.ok(!KEBAB_CASE_PATTERN.test('Check-1'));
      assert.ok(!KEBAB_CASE_PATTERN.test('check 1'));
      assert.ok(!KEBAB_CASE_PATTERN.test('-check'));
      assert.ok(!KEBAB_CASE_PATTERN.test('check-'));
      assert.ok(!KEBAB_CASE_PATTERN.test(' check'));
    });
  });

  describe('2. Current committed inactive registry', () => {
    it('9. ADOPTION_REQUIRED + empty entries -> ok', () => {
      const result = validatePreconditionRegistry(validRegistry());
      assert.ok(result.ok);
      assert.deepStrictEqual(result.errors, []);
    });

    it('10. ADOPTION_REQUIRED manifest + ADOPTION_REQUIRED registry -> binding ok', () => {
      const registry = validRegistry();
      const manifest = adopterRequiredManifest();
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(result.ok);
    });
  });

  describe('3. Schema validation', () => {
    it('11. format_version must be "1.0"', () => {
      const result = validatePreconditionRegistry(validRegistry({ format_version: '2.0' }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('FORMAT_VERSION')));
    });

    it('12. invalid status rejected', () => {
      const result = validatePreconditionRegistry(validRegistry({ status: 'INVALID' }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('STATUS')));
    });

    it('13. status must be ADOPTION_REQUIRED or ACTIVE', () => {
      let r = validatePreconditionRegistry(validRegistry({ status: 'ADOPTION_REQUIRED' }));
      assert.ok(r.ok);
      r = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(r.ok);
    });

    it('14. entries must be an array', () => {
      const result = validatePreconditionRegistry(validRegistry({ entries: 'not-array' }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ENTRIES_NOT_ARRAY')));
    });

    it('15. ADOPTION_REQUIRED + non-empty entries -> FAIL', () => {
      const result = validatePreconditionRegistry(validRegistry({
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }]
      }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ADOPTION_REQUIRED_NONEMPTY_ENTRIES')));
    });

    it('16. ACTIVE + empty entries -> FAIL', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE', entries: []
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ACTIVE_EMPTY_ENTRIES')));
    });
  });

  describe('4. ACTIVE empty checks', () => {
    it('17. ACTIVE + valid migration_id + checks=[] -> ok false', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECKS_EMPTY')));
    });
  });

  describe('5. Entry validation', () => {
    it('18. duplicate migration_id rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [
          { migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] },
          { migration_id: VALID_MIGRATION_ID, checks: [{ check_id: 'check-2', query_reference: VALID_QUERY_REF, expected: false }] }
        ]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('DUPLICATE_MIGRATION_ID')));
    });

    it('19. entry extra key rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [], extra: 'bad' }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ENTRY_INVALID_KEYS')));
    });

    it('20. entry symbol key rejected', () => {
      const entry = { migration_id: VALID_MIGRATION_ID, checks: [] };
      entry[Symbol('bad')] = 'value';
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE', entries: [entry]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ENTRY_INVALID_KEYS')));
    });

    it('21. entry getter rejected', () => {
      const entry = Object.create({}, {
        migration_id: { get() { return VALID_MIGRATION_ID; }, enumerable: true },
        checks: { value: [], enumerable: true }
      });
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE', entries: [entry]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ENTRY_INVALID_KEYS')));
    });
  });

  describe('6. Check validation', () => {
    it('22. expected must be boolean', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: 'not-boolean' }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('EXPECTED_NOT_BOOLEAN')));
    });

    it('23. duplicate check_id rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [
          { check_id: 'dup-1', query_reference: VALID_QUERY_REF, expected: true },
          { check_id: 'dup-1', query_reference: VALID_QUERY_REF, expected: false }
        ]}]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('DUPLICATE_ID')));
    });

    it('24. check extra key rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true, extra: 'bad' }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECK_INVALID_KEYS')));
    });

    it('25. check symbol key rejected', () => {
      const check = { check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true };
      check[Symbol('bad')] = 'value';
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [check] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECK_INVALID_KEYS')));
    });

    it('26. check getter rejected', () => {
      const check = Object.create({}, {
        check_id: { get() { return VALID_CHECK_ID; }, enumerable: true },
        query_reference: { value: VALID_QUERY_REF, enumerable: true },
        expected: { value: true, enumerable: true }
      });
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [check] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECK_INVALID_KEYS')));
    });
  });

  describe('7. Forbidden authority keys', () => {
    for (const forbiddenKey of FORBIDDEN_AUTHORITY_KEYS) {
      it(`27. forbidden check key "${forbiddenKey}" rejected`, () => {
        const check = { check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true };
        check[forbiddenKey] = 'some value';
        const result = validatePreconditionRegistry({
          format_version: '1.0', status: 'ACTIVE',
          entries: [{ migration_id: VALID_MIGRATION_ID, checks: [check] }]
        });
        assert.ok(!result.ok);
        assert.ok(result.errors.some(e => e.includes('FORBIDDEN_AUTHORITY_KEY') || e.includes('CHECK_INVALID_KEYS')));
      });
    }
  });

  describe('8. Manifest binding', () => {
    it('28. ADOPTION_REQUIRED manifest rejects ACTIVE registry', () => {
      const registry = activeRegistry();
      const manifest = adopterRequiredManifest();
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('REGISTRY_BINDING_MANIFEST_INACTIVE_REGISTRY_ACTIVE')));
    });

    it('29. ACTIVE manifest rejects ADOPTION_REQUIRED registry', () => {
      const registry = validRegistry();
      const manifest = activeManifest();
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('REGISTRY_BINDING_MANIFEST_ACTIVE_REGISTRY_NOT_ACTIVE')));
    });

    it('30. orphan registry entry rejected (ACTIVE)', () => {
      const registry = activeRegistry([
        { migration_id: '20260725000000_orphan-entry', checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }
      ]);
      const manifest = activeManifest();
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ORPHAN_ENTRY')));
    });

    it('31. migration without registry entry rejected (ACTIVE)', () => {
      const registry = activeRegistry([
        { migration_id: '20260725000000-unrelated', checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }
      ]);
      const manifest = activeManifest();
      const result = validateRegistryManifestBinding(registry, manifest);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('MIGRATION_MISSING_ENTRY')));
    });
  });

  describe('9. Top-level key safety', () => {
    it('32. extra top-level key rejected', () => {
      const result = validatePreconditionRegistry(validRegistry({ extra: 'bad' }));
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('TOP_LEVEL_KEYS_INVALID')));
    });

    it('33. symbol top-level key rejected', () => {
      const registry = { format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] };
      registry[Symbol('bad')] = 'value';
      const result = validatePreconditionRegistry(registry);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('TOP_LEVEL_KEYS_INVALID')));
    });

    it('34. accessor top-level keys rejected', () => {
      const registry = Object.create({}, {
        format_version: { get() { return '1.0'; }, enumerable: true },
        status: { value: 'ADOPTION_REQUIRED', enumerable: true },
        entries: { value: [], enumerable: true }
      });
      const result = validatePreconditionRegistry(registry);
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('TOP_LEVEL_KEYS_INVALID')));
    });
  });

  describe('A. Proxy safety', () => {
    it('A1. top-level Proxy rejected, all traps 0', () => {
      const traps = { get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, has: 0 };
      const inner = { format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] };
      const proxy = new Proxy(inner, {
        get() { traps.get++; return Reflect.get(...arguments); },
        getPrototypeOf() { traps.getPrototypeOf++; return Reflect.getPrototypeOf(...arguments); },
        ownKeys() { traps.ownKeys++; return Reflect.ownKeys(...arguments); },
        getOwnPropertyDescriptor() { traps.getOwnPropertyDescriptor++; return Reflect.getOwnPropertyDescriptor(...arguments); },
        has() { traps.has++; return Reflect.has(...arguments); }
      });
      const result = validatePreconditionRegistry(proxy);
      assert.ok(!result.ok);
      assert.strictEqual(traps.get, 0);
      assert.strictEqual(traps.getPrototypeOf, 0);
      assert.strictEqual(traps.ownKeys, 0);
      assert.strictEqual(traps.getOwnPropertyDescriptor, 0);
      assert.strictEqual(traps.has, 0);
    });

    it('A2. entry Proxy rejected, all traps 0', () => {
      const traps = { get: 0, ownKeys: 0 };
      const inner = { migration_id: VALID_MIGRATION_ID, checks: [] };
      const proxy = new Proxy(inner, {
        get() { traps.get++; return Reflect.get(...arguments); },
        ownKeys() { traps.ownKeys++; return Reflect.ownKeys(...arguments); }
      });
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [proxy]
      });
      assert.ok(!result.ok);
      assert.strictEqual(traps.get, 0);
      assert.strictEqual(traps.ownKeys, 0);
    });

    it('A3. check Proxy rejected, all traps 0', () => {
      const traps = { get: 0, ownKeys: 0 };
      const inner = { check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true };
      const proxy = new Proxy(inner, {
        get() { traps.get++; return Reflect.get(...arguments); },
        ownKeys() { traps.ownKeys++; return Reflect.ownKeys(...arguments); }
      });
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [proxy] }]
      });
      assert.ok(!result.ok);
      assert.strictEqual(traps.get, 0);
      assert.strictEqual(traps.ownKeys, 0);
    });

    it('A4. revoked Proxy -> invalid', () => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      const result = validatePreconditionRegistry(proxy);
      assert.ok(!result.ok);
    });

    it('A5. manifest Proxy rejected in binding', () => {
      const traps = { get: 0, getPrototypeOf: 0, ownKeys: 0 };
      const inner = { format_version: '1.0', status: 'ADOPTION_REQUIRED', canonical_directory: 'db/migrations', migrations: [] };
      const proxy = new Proxy(inner, {
        get() { traps.get++; return Reflect.get(...arguments); },
        getPrototypeOf() { traps.getPrototypeOf++; return Reflect.getPrototypeOf(...arguments); },
        ownKeys() { traps.ownKeys++; return Reflect.ownKeys(...arguments); }
      });
      const registry = validRegistry();
      const result = validateRegistryManifestBinding(registry, proxy);
      assert.ok(!result.ok);
      assert.strictEqual(traps.get, 0);
      assert.strictEqual(traps.getPrototypeOf, 0);
      assert.strictEqual(traps.ownKeys, 0);
    });

    it('A6. getter on ok in validator result -> getter 0', () => {
      let getterCalls = 0;
      const result = { ok: true };
      // getter는 here 검증하지 않고 adapter에서 검증
      // Pure validator는 getter를 직접 검증하지 않음
      const check = Object.create({}, {
        check_id: { value: VALID_CHECK_ID, enumerable: true },
        query_reference: { value: VALID_QUERY_REF, enumerable: true },
        expected: { get() { getterCalls++; return true; }, enumerable: true }
      });
      const vResult = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [check] }]
      });
      assert.ok(!vResult.ok);
      assert.strictEqual(getterCalls, 0);
    });
  });

  describe('B. Identifier grammar', () => {
    it('B1. migration_id canonical pattern - pass', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(result.ok);
    });

    it('B2. migration_id invalid - no timestamp', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: 'test', checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('MIGRATION_ID_INVALID')));
    });

    it('B3. migration_id invalid - short timestamp', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: '20260725_test', checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('MIGRATION_ID_INVALID')));
    });

    it('B4. migration_id invalid - uppercase', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: '20260725000000_Test', checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('MIGRATION_ID_INVALID')));
    });

    it('B5. migration_id invalid - underscore in slug', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: '20260725000000_test_name', checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('MIGRATION_ID_INVALID')));
    });

    it('B6. check_id kebab-case - pass', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: 'my-check-id-1', query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(result.ok);
    });

    it('B7. check_id invalid - underscore', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: 'c_1', query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECK_ID_INVALID')));
    });

    it('B8. check_id invalid - leading hyphen', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: '-check', query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECK_ID_INVALID')));
    });

    it('B9. query_reference kebab-case - pass', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: 'my-readonly-query-v2', expected: true }] }]
      });
      assert.ok(result.ok);
    });

    it('B10. query_reference invalid - colon', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: 'q:1', expected: true }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('QUERY_REFERENCE_INVALID')));
    });

    it('B11. query_reference invalid - SQL text', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: 'SELECT 1', expected: true }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('QUERY_REFERENCE_INVALID')));
    });

    it('B12. whitespace in migration_id rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: ' 20260725000000_example', checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('MIGRATION_ID_INVALID')));
    });
  });

  describe('C. Dense arrays', () => {
    it('C1. entries sparse array -> FAIL', () => {
      const sparse = [];
      sparse[0] = { migration_id: VALID_MIGRATION_ID, checks: [{ check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true }] };
      sparse[2] = { migration_id: '20260725000000-second-migration', checks: [{ check_id: 'check-2', query_reference: VALID_QUERY_REF, expected: false }] };
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE', entries: sparse
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('ENTRIES_SPARSE')));
    });

    it('C2. checks sparse array -> FAIL', () => {
      const sparse = [];
      sparse[1] = { check_id: VALID_CHECK_ID, query_reference: VALID_QUERY_REF, expected: true };
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: sparse }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECKS_SPARSE')));
    });

    it('C3. isDenseArray returns false for sparse', () => {
      const sparse = [];
      sparse[0] = 1;
      sparse[2] = 3;
      assert.strictEqual(isDenseArray(sparse), false);
    });

    it('C4. isDenseArray returns true for dense', () => {
      assert.strictEqual(isDenseArray([1, 2, 3]), true);
    });
  });

  describe('D. Null/undefined safety', () => {
    it('D1. null registry -> FAIL', () => {
      const result = validatePreconditionRegistry(null);
      assert.ok(!result.ok);
    });

    it('D2. undefined registry -> FAIL', () => {
      const result = validatePreconditionRegistry(undefined);
      assert.ok(!result.ok);
    });

    it('D3. array registry -> FAIL', () => {
      const result = validatePreconditionRegistry([]);
      assert.ok(!result.ok);
    });

    it('D4. string registry -> FAIL', () => {
      const result = validatePreconditionRegistry('bad');
      assert.ok(!result.ok);
    });

    it('D5. number registry -> FAIL', () => {
      const result = validatePreconditionRegistry(42);
      assert.ok(!result.ok);
    });
  });

  describe('E. Entry-level edge cases', () => {
    it('E1. migration_id empty string rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: '', checks: [] }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('MIGRATION_ID_INVALID')));
    });

    it('E2. checks not array rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: 'not-array' }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('CHECKS_NOT_ARRAY')));
    });

    it('E3. entry forbidden authority key rejected', () => {
      const result = validatePreconditionRegistry({
        format_version: '1.0', status: 'ACTIVE',
        entries: [{ migration_id: VALID_MIGRATION_ID, checks: [], sql: 'SELECT 1' }]
      });
      assert.ok(!result.ok);
      assert.ok(result.errors.some(e => e.includes('FORBIDDEN_AUTHORITY_KEY') || e.includes('ENTRY_INVALID_KEYS')));
    });
  });

  describe('F. validatePlainObjectShape', () => {
    it('F1. null rejected', () => {
      assert.strictEqual(validatePlainObjectShape(null, ALLOWED_TOP_LEVEL_KEYS), false);
    });

    it('F2. array rejected', () => {
      assert.strictEqual(validatePlainObjectShape([], ALLOWED_TOP_LEVEL_KEYS), false);
    });

    it('F3. custom prototype rejected', () => {
      function P() {}
      P.prototype.format_version = '1.0';
      assert.strictEqual(validatePlainObjectShape(new P(), ALLOWED_TOP_LEVEL_KEYS), false);
    });

    it('F4. symbol key rejected', () => {
      const o = { format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] };
      o[Symbol('bad')] = 'x';
      assert.strictEqual(validatePlainObjectShape(o, ALLOWED_TOP_LEVEL_KEYS), false);
    });

    it('F5. accessor rejected', () => {
      const o = Object.create({}, {
        format_version: { get() { return '1.0'; }, enumerable: true },
        status: { value: 'ADOPTION_REQUIRED', enumerable: true },
        entries: { value: [], enumerable: true }
      });
      assert.strictEqual(validatePlainObjectShape(o, ALLOWED_TOP_LEVEL_KEYS), false);
    });

    it('F6. Proxy rejected', () => {
      const proxy = new Proxy({ format_version: '1.0', status: 'ADOPTION_REQUIRED', entries: [] }, {});
      assert.strictEqual(validatePlainObjectShape(proxy, ALLOWED_TOP_LEVEL_KEYS), false);
    });
  });
});
