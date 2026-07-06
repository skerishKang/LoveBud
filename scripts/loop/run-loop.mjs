import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadPolicy } from './policy-loader.mjs';
import { collect } from './collect-github-state.mjs';
import { build } from './build-queue.mjs';
import { validateOutputReport } from './schemas.mjs';

const FORBIDDEN_MODES = ['execute', 'apply', 'merge', 'push', 'create-pr'];

function getOutputDir() {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData && existsSync(localAppData)) {
    return join(localAppData, 'LoveBudLoop', 'reports');
  }
  const home = homedir();
  return join(home, 'LoveBudLoop', 'reports');
}

function writeFailedReport(kind, message) {
  const outputDir = getOutputDir();
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `failed-${timestamp}.json`;
  const filepath = join(outputDir, filename);
  const failedReport = {
    status: 'FAILED',
    kind,
    timestamp: new Date().toISOString(),
    mode: 'dry-run',
    mainSha: null,
    error: kind,
    message
  };
  writeFileSync(filepath, JSON.stringify(failedReport, null, 2), 'utf-8');
  console.log(`Failed report saved to: ${filepath}`);
}

function writeReport(report) {
  const outputDir = getOutputDir();
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `queue-${timestamp}.json`;
  const filepath = join(outputDir, filename);
  writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  return filepath;
}

function parseArgs(args) {
  const argsArr = args || process.argv.slice(2);
  const modeArg = argsArr.find(a => a.startsWith('--mode='));
  if (!modeArg) {
    console.error('Error: --mode is required');
    process.exit(1);
  }
  const mode = modeArg.split('=')[1];
  if (FORBIDDEN_MODES.includes(mode)) {
    console.error(`Error: mode "${mode}" is forbidden in v0. Only --mode=dry-run is allowed.`);
    process.exit(1);
  }
  if (mode !== 'dry-run') {
    console.error(`Error: unknown mode "${mode}". Only --mode=dry-run is allowed.`);
    process.exit(1);
  }
  return { mode };
}

function printReport(report, mode, filepath) {
  const autoEligible = report.queue.filter(i => i.status === 'READY_FOR_PLANNING');
  const blocked = report.queue.filter(i => i.status.startsWith('BLOCKED'));
  const needsDecision = report.queue.filter(i => i.status.startsWith('NEEDS'));
  const noAuto = report.queue.filter(i => i.status === 'NO_AUTO' || i.status.startsWith('CI_') || i.status.startsWith('NEEDS_DEPLOYMENT_APPROVAL'));

  console.log(`LoveBud Loop Triage Report (dry-run)`);
  console.log(`  Mode: ${mode}`);
  console.log(`  Timestamp: ${report.timestamp}`);
  console.log(`  Main SHA: ${report.mainSha}`);
  console.log(`  Total items: ${report.queue.length}`);
  console.log(`  Auto-eligible (READY_FOR_PLANNING): ${autoEligible.length}`);
  console.log(`  Blocked (BLOCKED_BY_CI / BLOCKED_BY_DEPENDENCY): ${blocked.length}`);
  console.log(`  Needs decision (NEEDS_PRODUCT_DECISION / NEEDS_UI_QA / NEEDS_DEPLOYMENT_APPROVAL): ${needsDecision.length}`);
  console.log(`  No auto (NO_AUTO / CI_DATA_MISSING / CI_STATE_UNTRUSTED / CI_UNKNOWN_STATUS): ${noAuto.length}`);
  console.log(`  Report saved to: ${filepath}`);
  console.log(`  Report size: ${JSON.stringify(report).length} bytes`);
  console.log(`  Mutation performed: false`);
}

function execute(deps) {
  const { mode } = deps.args ? parseArgs(deps.args) : parseArgs();

  let policy;
  try {
    policy = (deps.loadPolicy || loadPolicy)();
  } catch (err) {
    const kind = 'POLICY_CONFIG_INVALID';
    console.error(`LOOP TRIAGE FAILED: ${kind}`);
    (deps.writeFailedReport || writeFailedReport)(kind, '');
    return { status: 'FAILED', kind };
  }

  let githubState;
  try {
    githubState = (deps.collect || collect)();
  } catch (err) {
    console.error('LOOP TRIAGE FAILED: collector threw unexpectedly');
    (deps.writeFailedReport || writeFailedReport)('COLLECTOR_THREW', 'Unexpected collector error.');
    return { status: 'FAILED', kind: 'COLLECTOR_THREW' };
  }

  if (githubState && githubState.error) {
    console.error(`LOOP TRIAGE FAILED: ${githubState.errorKind || githubState.error}`);
    (deps.writeFailedReport || writeFailedReport)(githubState.errorKind || githubState.error, githubState.errorMessage);
    return { status: 'FAILED', kind: githubState.errorKind || githubState.error };
  }

  let report;
  try {
    report = (deps.build || build)(githubState, policy);
  } catch (err) {
    const kind = err.message === 'QUEUE_POLICY_VIOLATION' ? 'QUEUE_POLICY_VIOLATION' : 'BUILD_FAILED';
    console.error(`LOOP TRIAGE FAILED: ${kind}`);
    (deps.writeFailedReport || writeFailedReport)(kind, '');
    return { status: 'FAILED', kind };
  }

  try {
    (deps.validateOutputReport || validateOutputReport)(report, policy);
  } catch (err) {
    console.error(`LOOP TRIAGE FAILED: report validation error - ${err.message}`);
    (deps.writeFailedReport || writeFailedReport)('REPORT_VALIDATION_FAILED', err.message);
    return { status: 'FAILED', kind: 'REPORT_VALIDATION_FAILED' };
  }

  const filepath = (deps.writeReport || writeReport)(report);

  (deps.printReport || printReport)(report, mode, filepath);

  return { status: 'OK', report, filepath };
}

function main() {
  const deps = {
    loadPolicy,
    collect,
    build,
    validateOutputReport,
    writeFailedReport,
    writeReport,
    printReport
  };
  const result = execute(deps);
  if (result.status === 'FAILED') {
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] && (process.argv[1].endsWith('run-loop.mjs') || process.argv[1].endsWith('run-loop'))) {
  main();
}

export { execute, main, parseArgs, getOutputDir, writeFailedReport, writeReport, printReport };
