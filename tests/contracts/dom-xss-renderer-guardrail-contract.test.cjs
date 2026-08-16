/**
 * DOM XSS Renderer Guardrail Contract Test
 *
 * Static inventory of all DOM XSS sink locations in js/.
 * New sinks added without updating this allowlist → FAIL.
 *
 * Security utilities: js/utils/security.js
 *   - LoveBudSecurity.escapeHtml(): escapes & < > " '
 *   - LoveBudSecurity.sanitizeUrl(): http/https only
 *
 * Guardrail approach:
 *   Each JS file under js/ has a signed sink count. If a file's sink
 *   count changes (new sink added or removed), the test fails and
 *   the developer must update the allowlist, documenting the reason.
 *
 * This is a COUNTER guardrail — it detects changes in sink count
 * per file, which is more stable than line-level matching across
 * code changes.
 *
 * v20260525-2
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const JS_DIR = path.join(ROOT, 'js');

// ─── SINK DETECTION ─────────────────────────────────────────────────────────

const SINK_REGEX = /\.(innerHTML\s*=|insertAdjacentHTML\s*\(|outerHTML\s*=)/g;

function findSinks(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = [];
  let match;
  while ((match = SINK_REGEX.exec(content)) !== null) {
    const before = content.lastIndexOf('\n', match.index) + 1;
    const after = content.indexOf('\n', match.index);
    const lineNum = content.slice(0, match.index).split('\n').length;
    const lineText = (after >= 0 ? content.slice(before, after) : content.slice(before)).trim();
    matches.push({ line: lineNum, text: lineText, type: match[1].trim() });
  }
  return matches;
}

function collectJsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(full));
    } else if (entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

function relPath(absolutePath) {
  return path.relative(ROOT, absolutePath).replace(/\\/g, '/');
}

// ─── ALLOWLIST ──────────────────────────────────────────────────────────────
//
// Per-file sink count allowlist. Each entry records the expected number
// of DOM XSS sink occurrences in that file and a classification.
//
// When adding a new file or updating a count:
//   1. Run: grep -rn '\.innerHTML\s*=\|\.insertAdjacentHTML\s*(\|\.outerHTML\s*=' js/<file>
//   2. Count results
//   3. Add/update the entry below
//   4. Document the reason for any NEW sink in the commit message
//
// Classification:
//   "safe" = all sinks have documented safety (escapeHtml, sanitizeUrl,
//            static-only, clear-container, approved template renderer)
//   "review_needed" = one or more sinks without user-content escaping
//                      Need separate PR to fix

/* eslint-disable no-unused-vars */
const FILE_ALLOWLIST = {
  // ── Auth ───────────────────────────────────────────────────────────
  'js/auth/auth-login-page.js': {
    count: 1, classification: 'safe',
    reason: 'clear-container: innerHTML = empty string'
  },
  'js/auth/auth-firebase.js': {
    count: 2, classification: 'safe',
    reason: 'buildUserDropdown template (uses escapeHtml internally); static skeleton div'
  },
  'js/auth/auth-ui.js': {
    count: 3, classification: 'safe',
    reason: 'userHtml/loginHtml from buildUserHtml/buildLoginHtml — approved auth templates with escapeHtml'
  },
  'js/auth.js': {
    count: 3, classification: 'safe',
    reason: 'html from buildAuthUI — approved auth template renderer with escapeHtml'
  },

  // ── Detail ─────────────────────────────────────────────────────────
  'js/detail/detail-connected.js': {
    count: 5, classification: 'safe',
    reason: 'buildFlowConnected template renderer — escapeHtml for user content'
  },
  'js/detail/detail-loader.js': {
    count: 1, classification: 'safe',
    reason: 'backButton — config.label is i18n application text, not user content'
  },
  'js/detail/detail-loading-error-boundary.js': {
    count: 1, classification: 'safe',
    reason: 'fallbackHTML — static error template, no user content'
  },
  'js/detail/detail-render.js': {
    count: 10, classification: 'safe',
    reason: 'Template functions use escapeHtml: buildVideoMainMarkup, buildChannelHtml, buildTagsHtml, buildStageOrThemeHtml, buildDateOrEmpty, buildDeleteConfirmHTML; plus 3 clear-container'
  },

  // ── Viewer ─────────────────────────────────────────────────────────
  'js/viewer/public-tree-viewer.js': {
    count: 11, classification: 'safe',
    reason: 'All user content escaped via escapeHtml/sanitizeUrl; clear-container for list; static no-media divs'
  },

  'js/viewer/public-viewer-detail-view-mode-template.js': {
    count: 0, classification: 'safe',
    reason: '#3563 thin public wrapper; mounts via shared builder (no local outerHTML/innerHTML sink)'
  },
  'js/shared/canonical-appreciation-detail-presentation.js': {
    count: 1, classification: 'safe',
    reason: 'mount.outerHTML = buildDetailViewModeHtml(...) — static canonical appreciation shell, no user content'
  },
  'js/viewer/templates/public-viewer-sidebar-template.js': {
    count: 1, classification: 'safe',
    reason: 'mount.outerHTML = template — static public viewer sidebar template, no user content'
  },
  'js/viewer/viewer-init-flow.js': {
    count: 1, classification: 'safe',
    reason: 'Panels.renderPanel — approved template renderer with internal escaping'
  },
  'js/viewer/viewer-shell-render.js': {
    count: 1, classification: 'safe',
    reason: 'buildShellHtml(data) — approved template renderer with escapeHtml'
  },

  // ── My Trees ──────────────────────────────────────────────────────
  'js/my-trees.js': {
    count: 1, classification: 'safe',
    reason: 'clear-container: innerHTML = empty string'
  },
  'js/my-trees/my-trees-actions.js': {
    count: 5, classification: 'safe',
    reason: 'material-icons + i18n safeText; restoreHeaderText/EmptyText are previously captured safe innerHTML; visibilityField uses array join of safe option HTML'
  },
  'js/my-trees/my-trees-batch-render.js': {
    count: 2, classification: 'safe',
    reason: 'clear-container (×2): grid.innerHTML = empty string for initial load + resetBatchState; #3944 pagination rebuild uses replaceChildren() and does not introduce an additional innerHTML sink'
  },
  'js/my-trees/my-trees-i18n-refresh.js': {
    count: 5, classification: 'safe',
    reason: 'Static i18n heading text + material icons; outerHTML read for icon preservation'
  },
  'js/my-trees/my-trees-preview-hub.js': {
    count: 12, classification: 'safe',
    reason: '#3578 Phase 1 removed the hub Edit button innerHTML sink (edit action no longer rendered in hub); remaining sinks use escapeHtml-bound counts and static markup; social counts now set via textContent with finite-only values (#3563 removed public-view action sink); owner-passive social-shell template is static markup'
  },
  'js/my-trees/my-trees-preview-state.js': {
    count: 3, classification: 'safe',
    reason: 'Created moment preview hydration uses escapeHtml for hydrated memory labels and tree title/count empty-state markup; Step 5 follow-up uses DOM APIs for the interactive <button data-my-trees-flow-toggle> and replaceChildren() for clear-container paths'
  },
  'js/my-trees/my-trees-ui.js': {
    count: 3, classification: 'safe',
    reason: 'card.innerHTML from buildTreeCard — approved template renderer with escapeHtml; 2 clear-container'
  },

  // ── Import (YouTube playlist preview) ──────────────────────────────
  'js/import/youtube-playlist-preview-ui.js': {
    count: 4, classification: 'safe',
    reason: 'resultEl.innerHTML bound to approved template renderers (renderLoading, renderPlaylist, renderError) that escapeHtml() every user-controlled field (playlist title, channel title, item titles/descriptions/channels/states, order index, source URLs); plus one clear-container reset (innerHTML = empty string) on popover close. Thumbnail load-failure fallback uses src/class/textContent only. No unescaped user content.'
  },

  // ── Search ─────────────────────────────────────────────────────────
  'js/search/search-card-renderer.js': {
    count: 1, classification: 'safe',
    reason: 'htmlToNode — innerHTML from adapter-owned sanitized renderRepresentativeMedia/metadataHtml output only; NOT a generic HTML slot'
  },
  'js/search/search-copy-ui.js': {
    count: 1, classification: 'safe',
    reason: 'renderCopyButton(treeId) — treeId is application-generated UUID, not user content'
  },
  'js/search/search-index.js': {
    count: 5, classification: 'safe',
    reason: 'CardRenderer.* and state.growingTrees use approved template renderers with escapeHtml; clear-container'
  },
  'js/search/index.js': {
    count: 3, classification: 'safe',
    reason: 'CardRenderer.* and state.growingTrees use approved template renderers with escapeHtml; renderGrowingError clear-container innerHTML'
  },
  'js/search.js': {
    count: 5, classification: 'safe',
    reason: 'CardRenderer.* and state.growingTrees use approved template renderers with escapeHtml; clear-container'
  },
  'js/search/search-preview-renderer.js': {
    count: 27, classification: 'safe',
    reason: 'escapeHtml for user content (safeTreeTitle, safeSourceUrl, placeholderDescription, emotionTags); sanitizeUrl for iframe src; canonical slot flow/summary/actions renderers use approved template literals with escaped values; clear-container assignments for slot reset and loading state; approved helpers renderPlaceholder, renderPreviewIframe, renderEmotionTags'
  },
  'js/search/search-preview-playable-hub-patch.js': {
    count: 5, classification: 'safe',
    reason: 'escapeHtml for title in summary lines; renderIframe uses sanitizeUrl for embed URL; renderSocialBar approved static template with escapeHtml counts; canonical socialSlot.innerHTML replaces previewDesc.insertAdjacentHTML fallback'
  },
  'js/search/search-preview-hub-dom-patch.js': {
    count: 1, classification: 'safe',
    reason: 'summaryText escaped with escapeHtml before preview-summary-line innerHTML only; social shell removed (now owned by search-share-link.js)'
  },
  'js/search/search-preview-state.js': {
    count: 1, classification: 'safe',
    reason: 'resultsList.innerHTML — template uses escapeHtml for user content in template literal'
  },
  'js/search/search-scroll-load.js': {
    count: 1, classification: 'safe',
    reason: 'static material icon + label span, no user content'
  },
  'js/search/search-ui.js': {
    count: 3, classification: 'safe',
    reason: 'controls/previewDesc/previewContainer — static/loading HTML with i18n locale text, no user content injection'
  },

  // ── Editor ─────────────────────────────────────────────────────────
  'js/editor.js': {
    count: 2, classification: 'safe',
    reason: 'static material-icon + i18n app text for mode toggle buttons (viewBtn.innerHTML, editBtn.innerHTML)'
  },
  'js/editor/editor-shortcuts-help.js': {
    count: 1, classification: 'safe',
    reason: 'static help dialog template, no user content'
  },
  'js/editor/editor-detail-inline-edit.js': {
    count: 4, classification: 'safe',
    reason: 'material-icon + i18n formatI18nText; 3 clear-container'
  },
  'js/editor/editor-detail-sidebar-status-boundary.js': {
    count: 2, classification: 'safe',
    reason: 'flowSummaryEl.innerHTML uses i18n template with title/timeRange passed through escapeHtml before insertion; count is non-user numeric text'
  },
  'js/editor/editor-detail-tree-meta.js': {
    count: 1, classification: 'safe',
    reason: 'clear-container: treeMetaMount.innerHTML = empty string'
  },
  'js/editor/editor-detail-ui.js': {
    count: 3, classification: 'safe',
    reason: 'clear-container sinks only (#3562 no longer clears left-rail tree meta via innerHTML); selected-moment title/memo/tags render via shared appreciation slot DOM (textContent)'
  },
  'js/editor/editor-entry-fallbacks.js': {
    count: 1, classification: 'safe',
    reason: 'canvas.innerHTML = buildCanvasFallback() — approved template with escapeHtml'
  },
  'js/editor/editor-i18n-refresh.js': {
    count: 2, classification: 'safe',
    reason: 'material-icon + i18n tText; panel array join of option HTML with safe text; summary renderer removed in #2970'
  },
  'js/editor/editor-rename-ui.js': {
    count: 1, classification: 'safe',
    reason: 'In-app rename modal uses static modal HTML only; current title is assigned to input.value, not innerHTML'
  },
  'js/editor/editor-memory-actions.js': {
    count: 2, classification: 'safe',
    reason: 'field.innerHTML and grid.innerHTML — template literal with escapeHtml for user content or static HTML only'
  },
  'js/editor/editor-page-helpers.js': {
    count: 1, classification: 'safe',
    reason: 'canvas.innerHTML = buildCanvasFallback() — approved template with escapeHtml'
  },
  'js/editor/editor-rail-collapse.js': {
    count: 2, classification: 'safe',
    reason: '#3585 rail collapse restore buttons: leftRestore.innerHTML and rightRestore.innerHTML — static material icon + i18n label markup, no user content'
  },

  // ── Editor Templates (outerHTML pattern) ──────────────────────────
  'js/editor/templates/editor-add-memory-form-template.js': { count: 1, classification: 'safe', reason: 'mount.outerHTML = template — approved template renderer with escapeHtml' },
  'js/editor/templates/editor-canvas-topbar-template.js': { count: 1, classification: 'safe', reason: 'mount.outerHTML = template — approved template renderer, static markup' },
  'js/editor/templates/editor-detail-edit-mode-template.js': { count: 1, classification: 'safe', reason: 'mount.outerHTML = template — approved template renderer with escapeHtml' },
  'js/editor/templates/editor-detail-empty-state-template.js': { count: 1, classification: 'safe', reason: 'mount.outerHTML = template — static empty state, no user content' },
  'js/editor/templates/editor-detail-panel-shell-template.js': { count: 1, classification: 'safe', reason: 'mount.outerHTML = template — static shell markup' },
  'js/editor/templates/editor-detail-view-mode-template.js': { count: 1, classification: 'safe', reason: 'mount.outerHTML = template — approved template renderer with escapeHtml' },
  'js/editor/templates/editor-empty-guide-template.js': { count: 1, classification: 'safe', reason: 'mount.outerHTML = template — approved template renderer, static guide markup' },
  'js/editor/templates/editor-floating-toolbar-template.js': { count: 1, classification: 'safe', reason: 'mount.outerHTML = template — approved template renderer, static markup' },
  'js/editor/templates/editor-sidebar-template.js': { count: 1, classification: 'safe', reason: 'mount.outerHTML = template — static sidebar markup' },

  // ── i18n ──────────────────────────────────────────────────────────────
  'js/i18n/i18n-core.js': {
    count: 1, classification: 'safe',
    reason: 'el.innerHTML = translated — translated is i18n lookup result (safe application text), not raw user content'
  },

  // ── Settings ─────────────────────────────────────────────────────────
  'js/settings.js': {
    count: 2, classification: 'safe',
    reason: 'material-icon + i18n safeText for browse title and logout button'
  },

  // ── Shared Header ────────────────────────────────────────────────────
  'js/shared-header.js': {
    count: 1, classification: 'safe',
    reason: 'buildHeaderHTML() — approved template renderer, static navigation markup'
  },

  // ── Public Canvas Init ───────────────────────────────────────────────
  'js/viewer/public-canvas-init.js': {
    count: 1, classification: 'safe',
    reason: 'sidebarSummaryEl.innerHTML — uses escapeHtml for user-provided description/summary content'
  },

  // ── UI Utils ─────────────────────────────────────────────────────────
  'js/utils/ui.js': {
    count: 1, classification: 'safe',
    reason: 'toast.innerHTML — template literal with escapeHtml for toast message content'
  },

  // ── Shared ─────────────────────────────────────────────────────────
  'js/shared/tree-card-composition.js': {
    count: 1, classification: 'safe',
    reason: 'htmlToFragment — innerHTML from trusted metrics output only (LoveBudTreeCardMetrics.renderTreeReactionMetrics); NOT a generic public API'
  },

  // ── Visitor Viewer ───────────────────────────────────────────────────
  'js/visitor-viewer/visitor-viewer.js': {
    count: 3, classification: 'safe',
    reason: 'panelHtml from panelHandler — approved template renderer with escapeHtml; container.innerHTML from buildInitialShell (escapeHtml)'
  },
  'js/visitor-viewer/visitor-viewer-render-tree.js': {
    count: 2, classification: 'safe',
    reason: 'container.innerHTML from renderMemoryTree — approved template renderer with escapeHtml'
  },

  // ── Prototype / Mock ─────────────────────────────────────────────────
  'js/chat-first-workspace.js': {
    count: 5, classification: 'mock',
    reason: 'PROTOTYPE/MOCK FILE — not used in production. 2 clear-container, 2 user-content sinks without escaping (lines 132, 271), 1 clear-container'
  },
  'js/product/youtube-segment-player-poc.js': {
    count: 1, classification: 'mock',
    reason: 'POC FILE — not used in production. clear-container: innerHTML = empty string'
  },

  // ── Knowledge ────────────────────────────────────────────────────────
  'js/editor/editor-knowledge-link-ui.js': {
    count: 7, classification: 'safe',
    reason: 'autocomplete dropdown template + entity chips with escapeHtml for user content'
  },
  'js/entity.js': {
    count: 3, classification: 'safe',
    reason: 'entity detail renderer — escapeHtml for all user-facing content'
  },
};

// ─── KNOWN ISSUE ALLOWLIST ──────────────────────────────────────────────────
// Sinks that pass the count check but are flagged for future review.
// These are pre-existing issues that should be fixed in follow-up PRs.

const KNOWN_ISSUES = new Set([
  // chat-first-workspace.js — prototype file, lines 132, 271
  // User content (mom.type/text/date) concatenated into innerHTML without escaping
  'js/chat-first-workspace.js',
]);

// ─── TEST ──────────────────────────────────────────────────────────────────

test('DOM XSS renderer guardrail: per-file sink count signed', () => {
  const jsFiles = collectJsFiles(JS_DIR);
  const unlistedFiles = [];
  const mismatchedFiles = [];

  for (const filePath of jsFiles) {
    const rel = relPath(filePath);
    const sinks = findSinks(filePath);
    const actualCount = sinks.length;

    // Skip files that are never deployed (scripts/, etc.)
    if (rel.startsWith('scripts/') || rel.startsWith('product/') || rel.startsWith('utils/')) {
      if (rel.startsWith('utils/') && rel !== 'js/utils/ui.js' && rel !== 'js/utils/security.js') continue;
    }

    if (sinks.length === 0) continue; // no sinks in this file

    const expected = FILE_ALLOWLIST[rel];

    if (!expected) {
      unlistedFiles.push({
        file: rel,
        count: actualCount,
        sinks: sinks.map(s => `  L${s.line}: ${s.text.slice(0, 80)}`).join('\n'),
      });
    } else if (expected.count !== actualCount) {
      mismatchedFiles.push({
        file: rel,
        expected: expected.count,
        actual: actualCount,
        sinks: sinks.map(s => `  L${s.line}: ${s.text.slice(0, 80)}`).join('\n'),
      });
    }
  }

  // Build error report
  const errors = [];
  if (unlistedFiles.length > 0) {
    errors.push(
      `\n=== FILES NOT IN ALLOWLIST ===\n` +
      unlistedFiles.map(f =>
        `\n📁 ${f.file} (${f.count} sink(s))\n${f.sinks}`
      ).join('\n') +
      `\n\nAdd entries to FILE_ALLOWLIST in this test file with classification and reason.`
    );
  }

  if (mismatchedFiles.length > 0) {
    errors.push(
      `\n=== SINK COUNT MISMATCH ===\n` +
      mismatchedFiles.map(f =>
        `\n📁 ${f.file}: expected ${f.expected} sinks, found ${f.actual}\n${f.sinks}`
      ).join('\n') +
      `\n\nUpdate the count in FILE_ALLOWLIST. If adding a new sink, document the reason.`
    );
  }

  if (errors.length > 0) {
    assert.fail(errors.join('\n\n'));
  }

  // Report known issues
  const knownFound = [];
  for (const filePath of jsFiles) {
    const rel = relPath(filePath);
    if (KNOWN_ISSUES.has(rel)) {
      knownFound.push(rel);
    }
  }

  if (knownFound.length > 0) {
    console.log('\n⚠️  KNOWN ISSUES (review needed in follow-up PRs):');
    for (const file of knownFound) {
      const expected = FILE_ALLOWLIST[file];
      console.log(`   📁 ${file} (${expected.reason})`);
    }
  }

  // Summary
  const totalSinks = Object.values(FILE_ALLOWLIST).reduce((sum, e) => sum + e.count, 0);
  const safeCount = Object.entries(FILE_ALLOWLIST).filter(([, v]) => v.classification === 'safe').length;
  const reviewCount = Object.entries(FILE_ALLOWLIST).filter(([, v]) => v.classification === 'review_needed').length;
  const mockCount = Object.entries(FILE_ALLOWLIST).filter(([, v]) => v.classification === 'mock').length;

  console.log(`\n✅ DOM XSS guardrail passed.`);
  console.log(`   Total documented sinks: ${totalSinks} across ${Object.keys(FILE_ALLOWLIST).length} files`);
  console.log(`   - Safe: ${safeCount} files`);
  console.log(`   - Review needed: ${reviewCount} files`);
  console.log(`   - Mock/prototype: ${mockCount} files`);
  console.log(`   All ${Object.keys(FILE_ALLOWLIST).length} file counts match.`);
});

test('DOM XSS guardrail: known issues documented', () => {
  // Ensure KNOWN_ISSUES entries exist in FILE_ALLOWLIST
  for (const file of KNOWN_ISSUES) {
    assert.ok(
      FILE_ALLOWLIST[file] !== undefined,
      `KNOWN_ISSUES entry "${file}" must exist in FILE_ALLOWLIST`
    );
    assert.ok(
      FILE_ALLOWLIST[file].classification === 'review_needed' || FILE_ALLOWLIST[file].classification === 'mock',
      `KNOWN_ISSUES "${file}" must be classified as review_needed or mock`
    );
  }
});
