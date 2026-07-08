// #3313 contract: active scripts under scripts/ must not depend on
// developer-specific absolute paths. Paths must be env- or repo-relative.
//
// Forbidden tokens are built dynamically so this test file does not
// self-match on literal occurrences.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');

// Build forbidden literals at runtime to avoid self-matching this file.
function buildForbiddenTokens() {
  const sep = '/';
  const tokens = [
    sep + 'root' + sep,          // service-account root
    sep + 'home' + sep,          // per-user home
    'worktrees',                 // local worktree fragment
  ];
  return tokens;
}

// Windows drive absolute path, e.g. C:\ or g:\ — built from a char range.
// Requires a path-like character after the prefix to avoid matching
// template literals such as "${name}/..." (which contain a lone backslash
// only inside ${...} blocks).
function windowsDrivePattern() {
  return /(^|[^A-Za-z0-9_\\])([A-Za-z]:\\)[A-Za-z0-9_.~\/\\-]/;
}

// Strip ${ ... } template-literal blocks so embedded escapes are not scanned.
function stripTemplateLiterals(content) {
  return content.replace(/\$\{[^}]*\}/g, '');
}

function collectScriptFiles() {
  const exts = new Set(['.js', '.cjs', '.mjs', '.ps1', '.bat', '.sh']);
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (exts.has(path.extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
  }
  walk(SCRIPTS_DIR);
  return results;
}

const FORBIDDEN = buildForbiddenTokens();
const WIN_DRIVE = windowsDrivePattern();
const SCRIPT_FILES = collectScriptFiles();

test('#3313 scanned scripts derive from scripts/ and exclude docs/conversation refs', () => {
  assert.ok(SCRIPT_FILES.length > 0, 'expected active script files under scripts/');
  for (const file of SCRIPT_FILES) {
    assert.ok(file.startsWith(SCRIPTS_DIR), `scanned file must live under scripts/: ${file}`);
  }
});

test('#3313 no script depends on per-user home or service-account root paths', () => {
  const offenders = [];
  for (const file of SCRIPT_FILES) {
    const content = stripTemplateLiterals(fs.readFileSync(file, 'utf8'));
    for (const token of FORBIDDEN) {
      if (content.includes(token)) {
        offenders.push(`${path.relative(REPO_ROOT, file)}: contains ${token}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `Found developer-specific path tokens:\n${offenders.join('\n')}`);
});

test('#3313 no script depends on Windows drive absolute paths', () => {
  const offenders = [];
  for (const file of SCRIPT_FILES) {
    const content = stripTemplateLiterals(fs.readFileSync(file, 'utf8'));
    if (WIN_DRIVE.test(content)) {
      offenders.push(path.relative(REPO_ROOT, file));
    }
  }
  assert.deepEqual(offenders, [], `Found Windows drive absolute paths:\n${offenders.join('\n')}`);
});

test('#3313 issue-1069-delete-smoke resolves service account via env or repo-relative path', () => {
  for (const ext of ['.js', '.cjs']) {
    const file = path.join(SCRIPTS_DIR, `issue-1069-delete-smoke${ext}`);
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(
      content.includes('FIREBASE_SERVICE_ACCOUNT_PATH'),
      `issue-1069-delete-smoke${ext} must read FIREBASE_SERVICE_ACCOUNT_PATH`
    );
    assert.ok(
      !content.includes('LoveBud/.secrets'),
      `issue-1069-delete-smoke${ext} must not hard-code a developer-specific secrets path`
    );
    assert.ok(
      !content.includes('AIzaSy'),
      `issue-1069-delete-smoke${ext} must not hard-code a Firebase API key`
    );
    assert.ok(
      content.includes('process.env.FIREBASE_API_KEY'),
      `issue-1069-delete-smoke${ext} must read FIREBASE_API_KEY from env`
    );
  }
});

test('#3313 sync-screenshots.ps1 accepts BrainDir/DestRoot via param or env', () => {
  const file = path.join(SCRIPTS_DIR, 'sync-screenshots.ps1');
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(content.includes('LOVEBUD_SCREENSHOT_BRAIN_DIR'), 'must support $env:LOVEBUD_SCREENSHOT_BRAIN_DIR');
  assert.ok(content.includes('LOVEBUD_SCREENSHOT_DEST_ROOT'), 'must support $env:LOVEBUD_SCREENSHOT_DEST_ROOT');
  assert.ok(!content.includes('Users'), 'must not hard-code a Windows user directory');
  assert.ok(!content.toLowerCase().includes('ddrive'), 'must not hard-code a drive/project destination');
  assert.ok(content.includes('Get-Location'), 'DestRoot should default to a repo-relative location');
});
