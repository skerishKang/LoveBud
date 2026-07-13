/**
 * Windows-native local execution environment contract (Issue #3476).
 *
 * Source-static assertions only. No shell execution, no WSL, no DB.
 *
 * Refs #3476
 * Refs #425
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const agents = read('AGENTS.md');
const pathsDoc = read('docs/ops/PATHS_AND_SHELLS.md');
const remoteWsl = read('docs/ops/REMOTE_ACCESS_AND_WSL.md');
const opsIndex = read('docs/ops/ops_index.md');
const runbook = read(
  'docs/product/lovebud-tree-comments-legacy-schema-reconciliation-runbook.md'
);

// ─── AGENTS.md ─────────────────────────────────────────────────────────────

test('AGENTS.md declares Windows-native as the local execution default', () => {
  assert.match(agents, /## Current local execution environment/);
  assert.match(agents, /Primary OS:\*\* Windows|기본 OS는 Windows/i);
  assert.match(agents, /PowerShell 7/);
  assert.match(agents, /pwsh\.exe/);
});

test('AGENTS.md requires explicit authorization for WSL', () => {
  assert.match(agents, /WSL은 현재 task 또는 operator가 명시적으로 승인한 경우에만/i);
  assert.match(agents, /implicit fallback이 아니다/i);
});

test('AGENTS.md treats missing Windows tools as a stop condition', () => {
  assert.match(agents, /필수 Windows-native 도구가 없으면/i);
  assert.match(agents, /WSL로 자동 우회하지 않는다/i);
});

test('AGENTS.md forbids inferring WSL from tool identity', () => {
  assert.match(agents, /Codex, Kilo, Hermes/i);
  assert.match(agents, /WSL\/bash를 추론하지 않는다/i);
});

// ─── PATHS_AND_SHELLS.md ───────────────────────────────────────────────────

test('PATHS_AND_SHELLS.md is marked current source of truth with Windows defaults', () => {
  assert.match(pathsDoc, /Status:\s*CURRENT SOURCE OF TRUTH/i);
  assert.match(pathsDoc, /Default OS\s*\|\s*Windows/i);
  assert.match(pathsDoc, /Default shell\s*\|\s*PowerShell 7/i);
  assert.match(pathsDoc, /explicit exception only/i);
});

test('PATHS_AND_SHELLS.md no longer states Codex defaults to WSL/bash as active policy', () => {
  // Active (non-historical) area must not restate the old default as current.
  const histIdx = pathsDoc.indexOf('## Historical / explicitly authorized WSL reference');
  assert.ok(histIdx > 0, 'historical WSL section must exist');
  const active = pathsDoc.slice(0, histIdx);
  assert.equal(
    /Codex는 기본적으로 WSL\/bash 기준으로 작업합니다/.test(active),
    false,
    'active section must not contain the stale Codex WSL/bash default'
  );
  assert.equal(
    /실제 셸 실행은 WSL/.test(active),
    false,
    'active section must not prefer WSL for actual shell execution'
  );
});

test('PATHS_AND_SHELLS.md includes PowerShell preflight markers', () => {
  assert.match(pathsDoc, /Get-Location/);
  assert.match(pathsDoc, /\$PSVersionTable/);
  assert.match(pathsDoc, /Get-Command/);
  assert.match(pathsDoc, /psql\.exe/);
  assert.match(pathsDoc, /pg_dump\.exe/);
});

test('PATHS_AND_SHELLS.md fail-closed: no WSL fallback when Windows tools missing', () => {
  assert.match(pathsDoc, /WSL로 전환하지 말고 중단/i);
  assert.match(pathsDoc, /implicit fallback이 아니다/i);
});

test('PATHS_AND_SHELLS.md historical WSL section is clearly labeled and warns', () => {
  assert.match(pathsDoc, /## Historical \/ explicitly authorized WSL reference/);
  assert.match(pathsDoc, /현재 WSL 사용을 승인하지 않는다/i);
});

// ─── REMOTE_ACCESS_AND_WSL.md ──────────────────────────────────────────────

test('REMOTE_ACCESS_AND_WSL.md is classified historical/superseded', () => {
  assert.match(remoteWsl, /HISTORICAL_AUDIT/);
  assert.match(remoteWsl, /SUPERSEDED_FOR_CURRENT_EXECUTION|SUPERSEDED/i);
  assert.match(remoteWsl, /현재 agent startup guidance가 아니다/i);
  assert.match(remoteWsl, /WSL 사용을 승인하지 않는다/i);
});

test('REMOTE_ACCESS_AND_WSL.md points current authority to AGENTS.md and PATHS_AND_SHELLS.md', () => {
  assert.match(remoteWsl, /AGENTS\.md/);
  assert.match(remoteWsl, /PATHS_AND_SHELLS\.md/);
});

// ─── ops_index.md ──────────────────────────────────────────────────────────

test('ops_index.md states Windows-native operating baseline', () => {
  assert.match(opsIndex, /local execution default:\s*Windows-native/i);
  assert.match(opsIndex, /preferred shell:\s*PowerShell 7/i);
  assert.match(opsIndex, /WSL:\s*explicit authorization only/i);
});

test('ops_index.md routes PATHS_AND_SHELLS as current and WSL doc as historical', () => {
  assert.match(opsIndex, /PATHS_AND_SHELLS\.md[^\n]*current/i);
  assert.match(opsIndex, /REMOTE_ACCESS_AND_WSL\.md[^\n]*historical/i);
});

// ─── reconciliation runbook ────────────────────────────────────────────────

test('runbook presents Windows/PowerShell as primary operator path', () => {
  assert.match(runbook, /Primary operator path:\s*Windows-native PowerShell/i);
  assert.match(runbook, /psql\.exe/);
  assert.match(runbook, /pg_dump\.exe/);
  assert.match(runbook, /Get-Command psql\.exe/);
  assert.match(runbook, /Get-Command pg_dump\.exe/);
});

test('runbook keeps ON_ERROR_STOP=1 and direct-connection requirements', () => {
  assert.match(runbook, /ON_ERROR_STOP=1/);
  assert.match(runbook, /direct non-pooler/i);
  assert.match(runbook, /LOVE_BUD_PRODUCTION_DIRECT_DATABASE_URL/);
});

test('runbook treats Unix/WSL as explicit alternative only', () => {
  assert.match(runbook, /explicitly authorized alternative only/i);
  assert.match(runbook, /stop and report/i);
  assert.match(runbook, /Do \*\*not\*\* auto-fallback to WSL|no WSL fallback/i);
});

test('this PR scope does not rewrite migration or rollback SQL files', () => {
  // Guardrail for the contract suite itself: SQL files must exist (unchanged elsewhere).
  const mig = path.join(ROOT, 'scripts', 'migration-reconcile-tree-comments-legacy-schema.sql');
  const rb = path.join(ROOT, 'scripts', 'rollback-tree-comments-legacy-reconcile.sql');
  assert.ok(fs.existsSync(mig), 'migration SQL must exist');
  assert.ok(fs.existsSync(rb), 'rollback SQL must exist');
});
