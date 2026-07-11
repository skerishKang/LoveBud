#!/usr/bin/env node
/**
 * LoveBud — Legacy Orphan Tree Entity Repair Package (corrected)
 * Issue #3455 / PR #3456
 *
 * Private-input validation, dry-run, and plan preparation for orphan tree
 * entities identified by the #3441 browser recovery audit.
 *
 * Modes:
 *   --validate <mapping.json>
 *   --dry-run <mapping.json> --preflight <preflight.json>
 *   --prepare-plan <mapping.json> --preflight <preflight.json> --out <plan.json>
 *
 * Safety guarantees:
 *   - All inputs/outputs must be repository-external (symlink-safe check)
 *   - No raw treeId, ownerId, title, or payload values in output
 *   - Duplicate/conflict errors use index+code only (no raw values)
 *   - Owner inference from memory/social data is prohibited
 *   - --apply is unconditionally rejected before any input is read
 *   - TEXT IDs are preserved exactly (UUID shape is valid TEXT)
 *   - Public-first default; private requires explicit evidence classification
 *   - Browse eligibility separated from tree entity identity
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ─── Constants ─────────────────────────────────────────────────────────────

const PACKAGE_VERSION = '1.0.0';
const SUPPORTED_SCHEMA_VERSION = 1;
const REPO_ROOT = path.resolve(__dirname, '..');
const REPO_REAL_ROOT = (() => {
  try {
    return fs.realpathSync(REPO_ROOT);
  } catch {
    return path.resolve(REPO_ROOT);
  }
})();

const ALLOWED_SOURCE_CLASSIFICATIONS = [
  'AUTHORITATIVE_BROWSER_RECOVERY_SOURCE_FOUND',
  'PARTIAL_BROWSER_RECOVERY_SOURCE_FOUND',
];

const REJECTED_SOURCE_CLASSIFICATIONS = [
  'STALE_OR_CONFLICTING_BROWSER_RECOVERY_SOURCE',
  'NO_BROWSER_RECOVERY_DATA_FOUND',
  'BLOCKED_PRIVATE_BROWSER_ACCESS',
  'FABRICATED',
  'FALLBACK',
];

const ALLOWED_VISIBILITY = ['public', 'private'];

const ALLOWED_PRIVATE_EVIDENCE = [
  'PLUS_ENTITLEMENT_CONFIRMED',
  'GRANDFATHERED_PRIVATE_CONFIRMED',
];

const REQUIRED_PROVENANCE = 'AUTHORITATIVE_SERVER_RETURNED_FIELD';

const MAX_TREE_ID_LENGTH = 1024;
const MAX_OWNER_ID_LENGTH = 1024;
const MAX_TITLE_LENGTH = 4096;
const MAX_KEYWORD_LENGTH = 256;
const MAX_KEYWORDS_COUNT = 50;

// ─── Path safety ───────────────────────────────────────────────────────────

function resolveReal(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function isParentOf(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function isExternalPath(inputPath, allowMissing) {
  let resolved;
  try {
    resolved = resolveReal(inputPath);
  } catch {
    if (allowMissing) {
      const parent = resolveReal(path.dirname(inputPath));
      return !isParentOf(REPO_REAL_ROOT, parent) && parent !== REPO_REAL_ROOT;
    }
    return false;
  }

  // Must be outside repo root (using REPO_REAL_ROOT for all comparisons)
  if (isParentOf(REPO_REAL_ROOT, resolved) || resolved === REPO_REAL_ROOT) {
    return false;
  }

  // On Windows: case-insensitive comparison
  const resolvedLower = resolved.toLowerCase();
  const repoLower = REPO_REAL_ROOT.toLowerCase();
  if (resolvedLower.startsWith(repoLower + path.sep.toLowerCase()) || resolvedLower === repoLower) {
    return false;
  }

  // Check for symlink/reparse point pointing into repo
  try {
    const stat = fs.lstatSync(inputPath);
    if (stat.isSymbolicLink()) {
      return false;
    }
  } catch {
    if (!allowMissing) {
      return false;
    }
  }

  return true;
}

function checkExternalWithSymlinkGuard(inputPath, label) {
  if (!isExternalPath(inputPath, false)) {
    console.error(`❌ ${label}: Input path must be outside the repository directory`);
    process.exit(1);
  }
  // Symlink guard: if lstat says symlink, reject
  try {
    const stat = fs.lstatSync(inputPath);
    if (stat.isSymbolicLink()) {
      console.error(`❌ ${label}: Path is a symlink pointing into repository`);
      process.exit(1);
    }
  } catch {
    // File might not exist yet for output pre-check
  }
}

function checkOutputPathExternal(outputPath) {
  const parentDir = path.dirname(path.resolve(outputPath));
  if (!isExternalPath(parentDir, true)) {
    console.error('❌ Output parent directory must be outside the repository');
    process.exit(1);
  }
  // If output already exists and is a symlink, reject
  try {
    const stat = fs.lstatSync(outputPath);
    if (stat.isSymbolicLink()) {
      console.error('❌ Output path is a symlink');
      process.exit(1);
    }
  } catch {
    // OK — output doesn't exist yet
  }
}

// ─── Validation helpers ────────────────────────────────────────────────────

function isBlank(s) {
  return typeof s === 'string' && s.trim().length === 0;
}

function validateMapping(mapping) {
  const errors = [];

  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    errors.push({ index: null, field: 'root', code: 'MUST_BE_OBJECT' });
    return errors;
  }

  // schemaVersion
  if (mapping.schemaVersion === undefined || mapping.schemaVersion === null) {
    errors.push({ index: null, field: 'schemaVersion', code: 'MISSING_SCHEMA_VERSION' });
  } else if (mapping.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push({ index: null, field: 'schemaVersion', code: 'UNSUPPORTED_SCHEMA_VERSION' });
  }

  // sourceClassification
  if (!mapping.sourceClassification) {
    errors.push({ index: null, field: 'sourceClassification', code: 'MISSING_SOURCE_CLASSIFICATION' });
  } else if (REJECTED_SOURCE_CLASSIFICATIONS.includes(mapping.sourceClassification)) {
    errors.push({ index: null, field: 'sourceClassification', code: 'REJECTED_SOURCE_CLASSIFICATION' });
  } else if (!ALLOWED_SOURCE_CLASSIFICATIONS.includes(mapping.sourceClassification)) {
    errors.push({ index: null, field: 'sourceClassification', code: 'UNKNOWN_SOURCE_CLASSIFICATION' });
  }

  // records
  if (!Array.isArray(mapping.records)) {
    errors.push({ index: null, field: 'records', code: 'MUST_BE_ARRAY' });
    return errors;
  }
  if (mapping.records.length === 0) {
    errors.push({ index: null, field: 'records', code: 'EMPTY_ARRAY' });
    return errors;
  }

  const seenIds = new Map();

  mapping.records.forEach((record, idx) => {
    // Guard: reject non-object records (null, number, string, array)
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push({ index: idx, field: 'record', code: 'INVALID_RECORD_TYPE' });
      return;
    }

    // treeId
    if (!record.treeId) {
      errors.push({ index: idx, field: 'treeId', code: 'MISSING_TREE_ID' });
    } else if (typeof record.treeId !== 'string') {
      errors.push({ index: idx, field: 'treeId', code: 'INVALID_TREE_ID_TYPE' });
    } else if (isBlank(record.treeId)) {
      errors.push({ index: idx, field: 'treeId', code: 'BLANK_TREE_ID' });
    } else if (record.treeId.length > MAX_TREE_ID_LENGTH) {
      errors.push({ index: idx, field: 'treeId', code: 'TREE_ID_TOO_LONG' });
    } else if (/[\x00-\x1f]/.test(record.treeId)) {
      errors.push({ index: idx, field: 'treeId', code: 'CONTROL_CHAR_IN_TREE_ID' });
    } else {
      // Duplicate check — no raw ID in error
      if (seenIds.has(record.treeId)) {
        errors.push({ index: idx, field: 'treeId', code: 'DUPLICATE_TREE_ID' });
      } else {
        seenIds.set(record.treeId, idx);
      }
    }

    // ownerId
    if (!record.ownerId) {
      errors.push({ index: idx, field: 'ownerId', code: 'MISSING_OWNER_ID' });
    } else if (typeof record.ownerId !== 'string') {
      errors.push({ index: idx, field: 'ownerId', code: 'INVALID_OWNER_ID_TYPE' });
    } else if (isBlank(record.ownerId)) {
      errors.push({ index: idx, field: 'ownerId', code: 'BLANK_OWNER_ID' });
    } else if (record.ownerId.length > MAX_OWNER_ID_LENGTH) {
      errors.push({ index: idx, field: 'ownerId', code: 'OWNER_ID_TOO_LONG' });
    }

    // title
    if (!record.title) {
      errors.push({ index: idx, field: 'title', code: 'MISSING_TITLE' });
    } else if (typeof record.title !== 'string') {
      errors.push({ index: idx, field: 'title', code: 'INVALID_TITLE_TYPE' });
    } else if (isBlank(record.title)) {
      errors.push({ index: idx, field: 'title', code: 'BLANK_TITLE' });
    } else if (record.title.length > MAX_TITLE_LENGTH) {
      errors.push({ index: idx, field: 'title', code: 'TITLE_TOO_LONG' });
    }

    // ownerProvenance (required)
    if (!record.ownerProvenance) {
      errors.push({ index: idx, field: 'ownerProvenance', code: 'MISSING_OWNER_PROVENANCE' });
    } else if (record.ownerProvenance !== REQUIRED_PROVENANCE) {
      errors.push({ index: idx, field: 'ownerProvenance', code: 'INVALID_OWNER_PROVENANCE' });
    }

    // titleProvenance (required)
    if (!record.titleProvenance) {
      errors.push({ index: idx, field: 'titleProvenance', code: 'MISSING_TITLE_PROVENANCE' });
    } else if (record.titleProvenance !== REQUIRED_PROVENANCE) {
      errors.push({ index: idx, field: 'titleProvenance', code: 'INVALID_TITLE_PROVENANCE' });
    }

    // visibility
    if (!record.visibility) {
      errors.push({ index: idx, field: 'visibility', code: 'MISSING_VISIBILITY' });
    } else if (!ALLOWED_VISIBILITY.includes(record.visibility)) {
      errors.push({ index: idx, field: 'visibility', code: 'INVALID_VISIBILITY' });
    } else if (record.visibility === 'private') {
      if (!record.privateEvidenceClassification) {
        errors.push({ index: idx, field: 'privateEvidenceClassification', code: 'MISSING_PRIVATE_EVIDENCE' });
      } else if (!ALLOWED_PRIVATE_EVIDENCE.includes(record.privateEvidenceClassification)) {
        errors.push({ index: idx, field: 'privateEvidenceClassification', code: 'INVALID_PRIVATE_EVIDENCE' });
      }
    }

    // ── Strict pair validation: metadata null/absent → provenance null/absent ──
    if ((record.groupName === undefined || record.groupName === null) && record.groupNameProvenance !== undefined && record.groupNameProvenance !== null) {
      errors.push({ index: idx, field: 'groupNameProvenance', code: 'PROVENANCE_WITHOUT_VALUE' });
    }
    if ((record.keywords === undefined || record.keywords === null) && record.keywordsProvenance !== undefined && record.keywordsProvenance !== null) {
      errors.push({ index: idx, field: 'keywordsProvenance', code: 'PROVENANCE_WITHOUT_VALUE' });
    }
    if ((record.createdAt === undefined || record.createdAt === null) && record.createdAtProvenance !== undefined && record.createdAtProvenance !== null) {
      errors.push({ index: idx, field: 'createdAtProvenance', code: 'PROVENANCE_WITHOUT_VALUE' });
    }
    if ((record.updatedAt === undefined || record.updatedAt === null) && record.updatedAtProvenance !== undefined && record.updatedAtProvenance !== null) {
      errors.push({ index: idx, field: 'updatedAtProvenance', code: 'PROVENANCE_WITHOUT_VALUE' });
    }

    // groupName: null or nonblank string
    if (record.groupName !== undefined && record.groupName !== null) {
      if (typeof record.groupName !== 'string') {
        errors.push({ index: idx, field: 'groupName', code: 'INVALID_GROUP_NAME_TYPE' });
      } else if (isBlank(record.groupName)) {
        errors.push({ index: idx, field: 'groupName', code: 'BLANK_GROUP_NAME' });
      }
      // provenance required when value present
      if (!record.groupNameProvenance || record.groupNameProvenance !== REQUIRED_PROVENANCE) {
        errors.push({ index: idx, field: 'groupNameProvenance', code: 'INVALID_GROUP_NAME_PROVENANCE' });
      }
    }

    // keywords: null or string array, no blank/duplicate
    if (record.keywords !== undefined && record.keywords !== null) {
      if (!Array.isArray(record.keywords)) {
        errors.push({ index: idx, field: 'keywords', code: 'INVALID_KEYWORDS_TYPE' });
      } else if (record.keywords.length > MAX_KEYWORDS_COUNT) {
        errors.push({ index: idx, field: 'keywords', code: 'KEYWORDS_TOO_MANY' });
      } else {
        const seenKw = new Set();
        record.keywords.forEach((kw, ki) => {
          if (typeof kw !== 'string') {
            errors.push({ index: idx, field: `keywords[${ki}]`, code: 'INVALID_KEYWORD_TYPE' });
          } else if (isBlank(kw)) {
            errors.push({ index: idx, field: `keywords[${ki}]`, code: 'BLANK_KEYWORD' });
          } else if (kw.length > MAX_KEYWORD_LENGTH) {
            errors.push({ index: idx, field: `keywords[${ki}]`, code: 'KEYWORD_TOO_LONG' });
          } else if (seenKw.has(kw)) {
            errors.push({ index: idx, field: `keywords[${ki}]`, code: 'DUPLICATE_KEYWORD' });
          }
          seenKw.add(kw);
        });
      }
      // provenance required when value present
      if (!record.keywordsProvenance || record.keywordsProvenance !== REQUIRED_PROVENANCE) {
        errors.push({ index: idx, field: 'keywordsProvenance', code: 'INVALID_KEYWORDS_PROVENANCE' });
      }
    }

    // createdAt: null or canonical ISO-8601 timestamp
    if (record.createdAt !== undefined && record.createdAt !== null) {
      if (typeof record.createdAt !== 'string') {
        errors.push({ index: idx, field: 'createdAt', code: 'INVALID_CREATED_AT_TYPE' });
      } else {
        const d = new Date(record.createdAt);
        if (isNaN(d.getTime())) {
          errors.push({ index: idx, field: 'createdAt', code: 'INVALID_CREATED_AT_DATE' });
        }
      }
      // provenance required when value present
      if (!record.createdAtProvenance || record.createdAtProvenance !== REQUIRED_PROVENANCE) {
        errors.push({ index: idx, field: 'createdAtProvenance', code: 'INVALID_CREATED_AT_PROVENANCE' });
      }
    }

    // updatedAt: null or canonical ISO-8601 timestamp
    if (record.updatedAt !== undefined && record.updatedAt !== null) {
      if (typeof record.updatedAt !== 'string') {
        errors.push({ index: idx, field: 'updatedAt', code: 'INVALID_UPDATED_AT_TYPE' });
      } else {
        const d = new Date(record.updatedAt);
        if (isNaN(d.getTime())) {
          errors.push({ index: idx, field: 'updatedAt', code: 'INVALID_UPDATED_AT_DATE' });
        }
      }
      // provenance required when value present
      if (!record.updatedAtProvenance || record.updatedAtProvenance !== REQUIRED_PROVENANCE) {
        errors.push({ index: idx, field: 'updatedAtProvenance', code: 'INVALID_UPDATED_AT_PROVENANCE' });
      }
    }

    // createdAt/updatedAt chronology: if both present, updatedAt >= createdAt
    if (record.createdAt !== undefined && record.createdAt !== null &&
        record.updatedAt !== undefined && record.updatedAt !== null) {
      const created = new Date(record.createdAt);
      const updated = new Date(record.updatedAt);
      if (!isNaN(created.getTime()) && !isNaN(updated.getTime()) && updated.getTime() < created.getTime()) {
        errors.push({ index: idx, field: 'updatedAt', code: 'UPDATED_BEFORE_CREATED' });
      }
    }

    // contradictory: public record with privateEvidenceClassification
    if (record.visibility === 'public' && record.privateEvidenceClassification) {
      errors.push({ index: idx, field: 'privateEvidenceClassification', code: 'CONTRADICTORY_PRIVATE_EVIDENCE_ON_PUBLIC' });
    }
  });

  // Conflicting duplicate check (different ownerId for same treeId)
  // Guard: skip non-object records (already reported by main loop)
  const ownerMap = new Map();
  mapping.records.forEach((record, idx) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return;
    if (record.treeId && !isBlank(record.treeId) && record.ownerId && !isBlank(record.ownerId)) {
      if (ownerMap.has(record.treeId)) {
        const firstOwner = ownerMap.get(record.treeId);
        if (firstOwner !== record.ownerId) {
          errors.push({ index: idx, field: 'ownerId', code: 'CONFLICTING_OWNER_MAPPING' });
        }
      } else {
        ownerMap.set(record.treeId, record.ownerId);
      }
    }
  });

  return errors;
}

function validatePreflight(preflight, mappingRecordIds) {
  const errors = [];

  if (!preflight || typeof preflight !== 'object' || Array.isArray(preflight)) {
    errors.push({ index: null, field: 'root', code: 'MUST_BE_OBJECT' });
    return errors;
  }

  if (preflight.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push({ index: null, field: 'schemaVersion', code: 'UNSUPPORTED_SCHEMA_VERSION' });
  }

  if (preflight.sourceClassification !== 'PRODUCTION_READ_ONLY_PREFLIGHT') {
    errors.push({ index: null, field: 'sourceClassification', code: 'UNEXPECTED_CLASSIFICATION' });
  }

  if (!Array.isArray(preflight.records)) {
    errors.push({ index: null, field: 'records', code: 'MUST_BE_ARRAY' });
    return errors;
  }

  if (preflight.records.length === 0) {
    errors.push({ index: null, field: 'records', code: 'EMPTY_ARRAY' });
    return errors;
  }

  const mappingIdSet = new Set(mappingRecordIds);
  const preflightIdSet = new Set();
  const seenIds = new Set();

  preflight.records.forEach((record, idx) => {
    // Guard: reject non-object records (null, number, string, array)
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push({ index: idx, field: 'record', code: 'INVALID_RECORD_TYPE' });
      return;
    }

    if (!record.treeId || typeof record.treeId !== 'string') {
      errors.push({ index: idx, field: 'treeId', code: 'MISSING_OR_INVALID_TREE_ID' });
    } else {
      if (seenIds.has(record.treeId)) {
        errors.push({ index: idx, field: 'treeId', code: 'DUPLICATE_PREFLIGHT_ENTITY' });
      }
      seenIds.add(record.treeId);
      preflightIdSet.add(record.treeId);

      if (!mappingIdSet.has(record.treeId)) {
        errors.push({ index: idx, field: 'treeId', code: 'UNMATCHED_PREFLIGHT_ENTITY' });
      }
    }

    // entityExists required: must be boolean, not null, not string, not 0/1
    if (record.entityExists === undefined || record.entityExists === null) {
      errors.push({ index: idx, field: 'entityExists', code: 'MISSING_ENTITY_EXISTS' });
    } else if (typeof record.entityExists !== 'boolean') {
      errors.push({ index: idx, field: 'entityExists', code: 'INVALID_ENTITY_EXISTS_TYPE' });
    }

    // publicMomentCount required: must be integer >= 0, not string, not null, not float, not negative
    if (record.publicMomentCount === undefined || record.publicMomentCount === null) {
      errors.push({ index: idx, field: 'publicMomentCount', code: 'MISSING_PUBLIC_MOMENT_COUNT' });
    } else if (typeof record.publicMomentCount !== 'number' || !Number.isInteger(record.publicMomentCount) || record.publicMomentCount < 0) {
      errors.push({ index: idx, field: 'publicMomentCount', code: 'INVALID_MOMENT_COUNT' });
    }
  });

  // Check mapping IDs missing from preflight
  for (const mappingId of mappingRecordIds) {
    if (!preflightIdSet.has(mappingId)) {
      // Don't expose the raw ID
      errors.push({ index: null, field: 'records', code: 'MAPPING_ID_MISSING_FROM_PREFLIGHT' });
      break; // One error is enough
    }
  }

  return errors;
}

// ─── Join mapping and preflight ────────────────────────────────────────────

function joinRecords(mappingRecords, preflightRecords) {
  const preflightMap = new Map();
  preflightRecords.forEach(r => preflightMap.set(r.treeId, r));

  return mappingRecords.map(mr => {
    const pr = preflightMap.get(mr.treeId);
    return {
      treeId: mr.treeId,
      ownerId: mr.ownerId,
      title: mr.title,
      visibility: mr.visibility,
      groupName: mr.groupName !== undefined ? mr.groupName : null,
      keywords: mr.keywords !== undefined ? mr.keywords : null,
      createdAt: mr.createdAt !== undefined ? mr.createdAt : null,
      updatedAt: mr.updatedAt !== undefined ? mr.updatedAt : null,
      ownerProvenance: mr.ownerProvenance,
      titleProvenance: mr.titleProvenance,
      groupNameProvenance: mr.groupNameProvenance !== undefined ? mr.groupNameProvenance : null,
      keywordsProvenance: mr.keywordsProvenance !== undefined ? mr.keywordsProvenance : null,
      createdAtProvenance: mr.createdAtProvenance !== undefined ? mr.createdAtProvenance : null,
      updatedAtProvenance: mr.updatedAtProvenance !== undefined ? mr.updatedAtProvenance : null,
      privateEvidenceClassification: mr.privateEvidenceClassification || null,
      // No defaults: use validated exact fields only
      entityExists: pr ? pr.entityExists : null,
      publicMomentCount: pr ? pr.publicMomentCount : null,
    };
  });
}

// ─── Aggregate calculation ────────────────────────────────────────────────

function calculateAggregate(joined, mapping, preflight) {
  const totalMapping = mapping.records.length;
  const totalPreflight = preflight.records.length;

  const validJoined = joined.length;
  const publicRecords = joined.filter(r => r.visibility === 'public').length;
  const explicitPrivate = joined.filter(r => r.visibility === 'private').length;

  // Browse-eligible: visibility = public AND publicMomentCount >= 3
  const browseEligible = joined.filter(
    r => r.visibility === 'public' && typeof r.publicMomentCount === 'number' && r.publicMomentCount >= 3
  ).length;

  // Growing: visibility = public AND publicMomentCount between 0 and 2
  // This is an operational aggregate for internal classification only.
  // It does NOT imply a "Growing section" exists in Browse/Search.
  const growing = joined.filter(
    r => r.visibility === 'public' && typeof r.publicMomentCount === 'number' && r.publicMomentCount >= 0 && r.publicMomentCount <= 2
  ).length;

  const existingConflicts = joined.filter(r => r.entityExists === true).length;
  const plannedInserts = joined.filter(r => r.entityExists !== true).length;

  return {
    totalMapping,
    totalPreflight,
    validJoined,
    publicRecords,
    explicitPrivate,
    browseEligible,
    growing,
    existingConflicts,
    plannedInserts,
  };
}

// ─── Print aggregate (no raw values) ───────────────────────────────────────

function printAggregate(agg) {
  console.log(`\n📊 Aggregate summary:`);
  console.log(`  Mapping records:          ${agg.totalMapping}`);
  console.log(`  Preflight records:        ${agg.totalPreflight}`);
  console.log(`  Valid joined records:     ${agg.validJoined}`);
  console.log(`  Public records:           ${agg.publicRecords}`);
  console.log(`  Explicit-private records: ${agg.explicitPrivate}`);
  console.log(`  Browse-eligible records:  ${agg.browseEligible}`);
  console.log(`  Growing records:          ${agg.growing}`);
  console.log(`  Existing-row conflicts:   ${agg.existingConflicts}`);
  console.log(`  Planned inserts:          ${agg.plannedInserts}`);
  console.log(`\nℹ️  Browse-eligible requires visibility=public AND publicMomentCount>=3`);
  console.log(`ℹ️  Public trees with publicMomentCount 0-2 remain public but`);
  console.log(`ℹ️  are not listed in Browse/Search until they reach 3 public moments.`);
  console.log(`ℹ️  Private records are excluded from Browse/growing counts`);
  console.log(`ℹ️  No raw tree ID, owner ID, or title values are displayed.`);
}

// ─── Plan generation ───────────────────────────────────────────────────────

function generatePlan(mapping, preflight, joined, agg, planPath, mappingInputSha256, preflightInputSha256) {
  const planRecords = joined
    .filter(r => r.entityExists !== true)
    .map(r => ({
      treeId: r.treeId,
      ownerId: r.ownerId,
      title: r.title,
      visibility: r.visibility,
      groupName: r.groupName,
      keywords: r.keywords,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      publicMomentCount: r.publicMomentCount,
      ownerProvenance: r.ownerProvenance,
      titleProvenance: r.titleProvenance,
      groupNameProvenance: r.groupNameProvenance,
      keywordsProvenance: r.keywordsProvenance,
      createdAtProvenance: r.createdAtProvenance,
      updatedAtProvenance: r.updatedAtProvenance,
      privateEvidenceClassification: r.privateEvidenceClassification || null,
    }));

  const plan = {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    mappingInputSha256: mappingInputSha256,
    preflightInputSha256: preflightInputSha256,
    createdByPackageVersion: PACKAGE_VERSION,
    recordCount: planRecords.length,
    publicCount: agg.publicRecords,
    privateCount: agg.explicitPrivate,
    browseEligibleCount: agg.browseEligible,
    growingCount: agg.growing,
    existingConflicts: agg.existingConflicts,
    plannedInserts: agg.plannedInserts,
    records: planRecords,
  };

  const planJson = JSON.stringify(plan, null, 2);

  // Atomic no-clobber: write temp with exclusive create, then hard-link publish
  const tmpPath = planPath + '.tmp.' + process.pid;
  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx', 0o600);
    fs.writeFileSync(fd, planJson, { encoding: 'utf8' });
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    // Exclusive hard-link publication: linkSync fails with EEXIST if planPath exists
    fs.linkSync(tmpPath, planPath);
    fs.unlinkSync(tmpPath);
  } catch (err) {
    // Clean up temp file on failure
    try { if (fd !== null) fs.closeSync(fd); } catch { /* ignore */ }
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    console.error('❌ Output write failed');
    process.exit(1);
  }

  // Compute plan hash after writing
  const planRaw = fs.readFileSync(planPath, 'utf8');
  const planHash = crypto.createHash('sha256').update(planRaw).digest('hex');

  return planHash;
}

// ─── Token-by-token CLI parser ─────────────────────────────────────────────

function printUsage() {
  console.log(`\nLoveBud — Legacy Orphan Tree Entity Repair Package (Issue #3455)

Usage:
  node scripts/prepare-legacy-tree-entity-repair.cjs --validate <mapping.json>
  node scripts/prepare-legacy-tree-entity-repair.cjs --dry-run <mapping.json> --preflight <preflight.json>
  node scripts/prepare-legacy-tree-entity-repair.cjs --prepare-plan <mapping.json> --preflight <preflight.json> --out <plan.json>

Modes:
  --validate       Validate mapping JSON schema and business rules only
  --dry-run        Validate + generate aggregate from joined mapping+preflight
  --prepare-plan   Validate + generate external deterministic repair plan JSON

Options:
  --preflight      Path to production read-only preflight JSON (required for
                   --dry-run and --prepare-plan)
  --out            Output path for --prepare-plan plan JSON (must be external)

Safety:
  - All input/output paths must be outside the repository (symlink-safe)
  - No raw tree ID / owner ID / title in output
  - No production DB connection or mutation
  - No owner inference
  - TEXT IDs preserved exactly (UUID shape is valid TEXT)
  - --apply is unconditionally rejected
`);
}

/**
 * Exact token-by-token CLI parser.
 *
 * Only accepts:
 *   --validate <mapping>
 *   --dry-run <mapping> --preflight <preflight>
 *   --prepare-plan <mapping> --preflight <preflight> --out <plan>
 *
 * Rejects unknown options, extra positionals, duplicates, missing values,
 * mode-incompatible options, and --apply before any input read.
 */
function parseArgs(tokens) {
  // Shape definitions: exact token sequences per mode
  const SHAPES = {
    '--validate':      ['MODE', 'MAPPING'],
    '--dry-run':       ['MODE', 'MAPPING', '--preflight', 'PREFLIGHT'],
    '--prepare-plan':  ['MODE', 'MAPPING', '--preflight', 'PREFLIGHT', '--out', 'OUTPUT'],
  };

  // Help-only tokens: exact single --help or -h, nothing else
  if (tokens.length === 1 && (tokens[0] === '--help' || tokens[0] === '-h')) {
    printUsage();
    process.exit(0);
  }

  if (tokens.length === 0) {
    console.error('❌ MISSING_ARGUMENTS');
    process.exit(1);
  }

  // ── Reject --apply unconditionally, before any input read or help output ──
  if (tokens.some(t => t === '--apply')) {
    console.error('❌ APPLY_NOT_AVAILABLE');
    console.error('   Production execution requires separate CTO approval');
    process.exit(1);
  }

  // Exact help tokens are already handled above. Any remaining --help/-h is invalid (has extra args)
  if (tokens[0] === '--help' || tokens[0] === '-h') {
    console.error('❌ UNEXPECTED_ARGUMENTS_WITH_HELP');
    process.exit(1);
  }

  const rawMode = tokens[0];
  const shape = SHAPES[rawMode];

  if (!shape) {
    console.error('❌ UNKNOWN_MODE');
    process.exit(1);
  }

  // Token-by-token consumption
  let mappingPath = null;
  let preflightPath = null;
  let outputPath = null;

  // Helper: check if an argument looks like an option (starts with --)
  function isOption(s) { return typeof s === 'string' && s.startsWith('--'); }

  for (let i = 0; i < shape.length; i++) {
    const expected = shape[i];
    const actual = i < tokens.length ? tokens[i] : undefined;

    if (expected === 'MODE') {
      // Already validated by shape lookup
      continue;
    }

    // Literal option like --preflight or --out
    if (expected.startsWith('--')) {
      if (actual !== expected) {
        if (actual === undefined) {
          console.error('❌ MISSING_OPTION_VALUE');
        } else if (isOption(actual)) {
          console.error('❌ UNEXPECTED_OPTION');
        } else {
          console.error('❌ UNEXPECTED_POSITIONAL');
        }
        process.exit(1);
      }
      // Option matched — next token must be its value (not an option, not missing)
      const nextIdx = i + 1;
      if (nextIdx >= tokens.length) {
        console.error('❌ MISSING_OPTION_VALUE');
        process.exit(1);
      }
      const value = tokens[nextIdx];
      if (value === undefined || isOption(value)) {
        console.error('❌ MISSING_OPTION_VALUE');
        process.exit(1);
      }
      // Assign the value based on the option
      if (expected === '--preflight') {
        preflightPath = value;
      } else if (expected === '--out') {
        outputPath = value;
      }
      i++; // Skip the value token
      continue;
    }

    // Positional value slot like MAPPING, PREFLIGHT, OUTPUT
    if (actual === undefined || isOption(actual)) {
      console.error('❌ MISSING_OPTION_VALUE');
      process.exit(1);
    }
    if (expected === 'MAPPING') mappingPath = actual;
    // PREFLIGHT and OUTPUT are assigned via option handlers above
  }

  // ── After consuming exact shape, reject any remaining tokens ──
  const remaining = tokens.slice(shape.length);
  if (remaining.length > 0) {
    const next = remaining[0];
    if (isOption(next)) {
      console.error('❌ UNEXPECTED_OPTION');
    } else {
      console.error('❌ UNEXPECTED_POSITIONAL');
    }
    process.exit(1);
  }

  // Mode-specific incompatibility checks (shape-enforced, but double-check)
  if (rawMode === '--validate' && (tokens.includes('--preflight') || tokens.includes('--out'))) {
    console.error('❌ UNEXPECTED_OPTION');
    process.exit(1);
  }
  if (rawMode === '--dry-run' && tokens.includes('--out')) {
    console.error('❌ UNEXPECTED_OPTION');
    process.exit(1);
  }

  return { mode: rawMode, mappingPath, preflightPath, outputPath };
}

function main() {
  const args = process.argv.slice(2);

  // ── Token-by-token parse (exits on invalid; --apply checked before anything) ──
  const { mode, mappingPath, preflightPath, outputPath } = parseArgs(args);

  // ── External path enforcement (symlink-safe) ──
  checkExternalWithSymlinkGuard(mappingPath, 'Mapping input');
  if (preflightPath) {
    checkExternalWithSymlinkGuard(preflightPath, 'Preflight input');
  }
  if (outputPath) {
    checkOutputPathExternal(outputPath);
  }

  // ── Read mapping (as Buffer for hash, UTF-8 decode for JSON parse) ──
  let mappingBuffer;
  try {
    mappingBuffer = fs.readFileSync(mappingPath);
  } catch (err) {
    console.error('❌ Cannot read mapping input file');
    process.exit(1);
  }

  let mapping;
  try {
    mapping = JSON.parse(mappingBuffer.toString('utf8'));
  } catch (err) {
    console.error('❌ Mapping: Malformed JSON');
    process.exit(1);
  }

  // ── Validate mapping ──
  const mappingErrors = validateMapping(mapping);

  if (mappingErrors.length > 0) {
    console.error(`\n❌ Mapping validation FAILED: ${mappingErrors.length} error(s)`);
    mappingErrors.forEach(e => {
      const idx = e.index !== null ? `records[${e.index}]` : '';
      console.error(`   ${idx}${e.field}: ${e.code}`);
    });
    process.exit(1);
  }

  console.log('✅ Mapping validation PASSED');

  // ── For --validate only, exit here ──
  if (mode === '--validate') {
    process.exit(0);
  }

  // ── For --dry-run and --prepare-plan: read and validate preflight ──
  let preflightBuffer;
  try {
    preflightBuffer = fs.readFileSync(preflightPath);
  } catch (err) {
    console.error('❌ Cannot read preflight input file');
    process.exit(1);
  }

  let preflight;
  try {
    preflight = JSON.parse(preflightBuffer.toString('utf8'));
  } catch (err) {
    console.error('❌ Preflight: Malformed JSON');
    process.exit(1);
  }

  const mappingRecordIds = mapping.records
    .filter(r => r.treeId && !isBlank(r.treeId))
    .map(r => r.treeId);

  const preflightErrors = validatePreflight(preflight, mappingRecordIds);

  if (preflightErrors.length > 0) {
    console.error(`\n❌ Preflight validation FAILED: ${preflightErrors.length} error(s)`);
    preflightErrors.forEach(e => {
      const idx = e.index !== null ? `preflight[${e.index}]` : '';
      console.error(`   ${idx}${e.field}: ${e.code}`);
    });
    process.exit(1);
  }

  console.log('✅ Preflight validation PASSED');

  // ── Join records ──
  const joined = joinRecords(mapping.records, preflight.records);
  const agg = calculateAggregate(joined, mapping, preflight);

  // ── Existing entity fail-closed ──
  if (agg.existingConflicts > 0) {
    console.error(`\n❌ Existing-row conflicts detected: ${agg.existingConflicts}`);
    console.error('   Resolve conflicts in the private mapping or preflight');
    console.error('   and create a new artifact before proceeding.');
    process.exit(1);
  }

  // ── Dry-run output ──
  if (mode === '--dry-run') {
    printAggregate(agg);
    process.exit(0);
  }

  // ── Prepare plan ──
  if (mode === '--prepare-plan') {
    // Compute input hashes from actual raw Buffer bytes
    const mappingInputSha256 = crypto.createHash('sha256').update(mappingBuffer).digest('hex');
    const preflightInputSha256 = crypto.createHash('sha256').update(preflightBuffer).digest('hex');

    const planHash = generatePlan(mapping, preflight, joined, agg, outputPath, mappingInputSha256, preflightInputSha256);
    console.log(`\n📋 Plan created: YES`);
    console.log(`   Record count: ${agg.plannedInserts}`);
    console.log(`   Plan SHA-256: ${planHash}`);
    console.log(`\nℹ️  Plan contains entityExists=false records only.`);
    console.log(`ℹ️  No raw values or output path displayed.`);
    console.log(`ℹ️  Plan does not contain DB connection, SQL, or apply capability.`);
    process.exit(0);
  }
}

main();
