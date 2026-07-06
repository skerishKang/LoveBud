import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const KNOWN_ROOT_KEYS = [
  'version',
  'mode',
  'implementation_slots',
  'verification_slots',
  'auto-eligible lanes',
  'human-required lanes',
  'allowed-statuses',
  'default-human-status',
  'human-status-overrides',
  'merge',
  'issue mutation',
  'pr mutation',
  'worktree mutation'
];

const SCALAR_KEYS = new Set([
  'version',
  'mode',
  'implementation_slots',
  'verification_slots',
  'default-human-status'
]);

const LIST_KEYS = new Set([
  'auto-eligible lanes',
  'human-required lanes',
  'allowed-statuses',
  'human-status-overrides',
  'merge',
  'issue mutation',
  'pr mutation',
  'worktree mutation'
]);

function hasLeadingWhitespace(rawLine) {
  return rawLine.length > 0 && (rawLine[0] === ' ' || rawLine[0] === '\t');
}

function parseYamlConfig(text) {
  const result = {};
  const lines = text.split('\n');

  let currentListKey = null;
  let currentListIndent = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();

    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
      currentListKey = null;
      currentListIndent = null;
      continue;
    }

    if (hasLeadingWhitespace(rawLine)) {
      throw new Error('POLICY_CONFIG_INVALID');
    }

    if (trimmedLine.startsWith('- ')) {
      if (currentListKey === null) {
        throw new Error('POLICY_CONFIG_INVALID');
      }
      const indent = rawLine.length - trimmedLine.length;
      if (currentListIndent !== null && indent !== currentListIndent) {
        throw new Error('POLICY_CONFIG_INVALID');
      }
      currentListIndent = indent;
      const itemValue = trimmedLine.slice(2).trim();
      if (itemValue === '') {
        throw new Error('POLICY_CONFIG_INVALID');
      }
      if (typeof result[currentListKey] === 'undefined') {
        throw new Error('POLICY_CONFIG_INVALID');
      }
      result[currentListKey].push(itemValue);
      continue;
    }

    currentListKey = null;
    currentListIndent = null;

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) {
      throw new Error('POLICY_CONFIG_INVALID');
    }

    const key = trimmedLine.slice(0, colonIndex).trim();
    if (key === '') {
      throw new Error('POLICY_CONFIG_INVALID');
    }

    if (Object.prototype.hasOwnProperty.call(result, key)) {
      throw new Error('POLICY_CONFIG_INVALID');
    }

    if (!KNOWN_ROOT_KEYS.includes(key)) {
      throw new Error('POLICY_CONFIG_INVALID');
    }

    const valuePart = trimmedLine.slice(colonIndex + 1).trim();

    if (valuePart === '') {
      if (!LIST_KEYS.has(key)) {
        throw new Error('POLICY_CONFIG_INVALID');
      }
      result[key] = [];
      currentListKey = key;
    } else {
      if (!SCALAR_KEYS.has(key)) {
        throw new Error('POLICY_CONFIG_INVALID');
      }
      result[key] = valuePart;
    }
  }

  for (const key of KNOWN_ROOT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      throw new Error('POLICY_CONFIG_INVALID');
    }
  }

  return result;
}

function validatePolicy(raw) {
  if (raw.mode !== 'dry-run-only') {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  if (raw.implementation_slots !== '1') {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  if (raw.verification_slots !== '1') {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  const autoLanes = raw['auto-eligible lanes'];
  const humanLanes = raw['human-required lanes'];

  if (!Array.isArray(autoLanes) || autoLanes.length === 0) {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  if (!Array.isArray(humanLanes) || humanLanes.length === 0) {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  const autoSet = new Set(autoLanes);
  if (autoSet.size !== autoLanes.length) {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  const humanSet = new Set(humanLanes);
  if (humanSet.size !== humanLanes.length) {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  for (const lane of autoLanes) {
    if (humanSet.has(lane)) {
      throw new Error('POLICY_CONFIG_INVALID');
    }
  }

  const allowedStatuses = raw['allowed-statuses'];
  if (!Array.isArray(allowedStatuses) || allowedStatuses.length === 0) {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  const statusSet = new Set(allowedStatuses);
  if (statusSet.size !== allowedStatuses.length) {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  const requiredStatuses = ['NO_AUTO', 'CI_DATA_MISSING', 'CI_STATE_UNTRUSTED', 'CI_UNKNOWN_STATUS'];
  for (const s of requiredStatuses) {
    if (!statusSet.has(s)) {
      throw new Error('POLICY_CONFIG_INVALID');
    }
  }

  if (!allowedStatuses.includes(raw['default-human-status'])) {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  const overrides = raw['human-status-overrides'];
  if (!Array.isArray(overrides)) {
    throw new Error('POLICY_CONFIG_INVALID');
  }
  const seenOverrideLanes = new Set();
  for (const entry of overrides) {
    if (typeof entry !== 'string') {
      throw new Error('POLICY_CONFIG_INVALID');
    }
    const eqIdx = entry.indexOf('=');
    if (eqIdx === -1 || eqIdx === 0 || eqIdx === entry.length - 1) {
      throw new Error('POLICY_CONFIG_INVALID');
    }
    const overrideLane = entry.slice(0, eqIdx);
    const overrideStatus = entry.slice(eqIdx + 1);
    if (!humanSet.has(overrideLane)) {
      throw new Error('POLICY_CONFIG_INVALID');
    }
    if (!statusSet.has(overrideStatus)) {
      throw new Error('POLICY_CONFIG_INVALID');
    }
    if (seenOverrideLanes.has(overrideLane)) {
      throw new Error('POLICY_CONFIG_INVALID');
    }
    seenOverrideLanes.add(overrideLane);
  }

  const mutationKeys = ['merge', 'issue mutation', 'pr mutation', 'worktree mutation'];
  for (const mk of mutationKeys) {
    const val = raw[mk];
    if (!Array.isArray(val) || val.length !== 1 || val[0] !== 'disabled') {
      throw new Error('POLICY_CONFIG_INVALID');
    }
  }
}

function toPolicyObject(raw) {
  const overrides = {};
  for (const entry of raw['human-status-overrides']) {
    const eqIdx = entry.indexOf('=');
    const lane = entry.slice(0, eqIdx);
    const status = entry.slice(eqIdx + 1);
    overrides[lane] = status;
  }
  return {
    mode: raw.mode,
    implementationSlots: Number(raw.implementation_slots),
    verificationSlots: Number(raw.verification_slots),
    autoEligibleLanes: raw['auto-eligible lanes'],
    humanRequiredLanes: raw['human-required lanes'],
    allowedStatuses: raw['allowed-statuses'],
    defaultHumanStatus: raw['default-human-status'],
    humanStatusOverrides: overrides,
    merge: raw.merge,
    issueMutation: raw['issue mutation'],
    prMutation: raw['pr mutation'],
    worktreeMutation: raw['worktree mutation']
  };
}

function loadPolicy() {
  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  const configPath = resolve(scriptsDir, '..', '..', 'config', 'lovebud-loop.yml');

  if (!existsSync(configPath)) {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  let raw;
  try {
    const content = readFileSync(configPath, 'utf-8');
    raw = parseYamlConfig(content);
  } catch {
    throw new Error('POLICY_CONFIG_INVALID');
  }

  validatePolicy(raw);
  return toPolicyObject(raw);
}

export { loadPolicy, parseYamlConfig, validatePolicy, toPolicyObject };
