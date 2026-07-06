import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
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

function parseArgs() {
  const args = process.argv.slice(2);
  const modeArg = args.find(a => a.startsWith('--mode='));
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

function main() {
  const { mode } = parseArgs();

  let githubState;
  try {
    githubState = collect();
  } catch (err) {
    console.error('LOOP TRIAGE FAILED: collector threw unexpectedly');
    writeFailedReport('COLLECTOR_THREW', 'Unexpected collector error.');
    process.exit(1);
  }

  if (githubState && githubState.error) {
    console.error(`LOOP TRIAGE FAILED: ${githubState.errorKind || githubState.error}`);
    writeFailedReport(githubState.errorKind || githubState.error, githubState.errorMessage);
    process.exit(1);
  }

  const report = build(githubState);

  try {
    validateOutputReport(report);
  } catch (err) {
    console.error(`LOOP TRIAGE FAILED: report validation error - ${err.message}`);
    process.exit(1);
  }

  const outputDir = getOutputDir();
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `queue-${timestamp}.json`;
  const filepath = join(outputDir, filename);

  writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');

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

main();
