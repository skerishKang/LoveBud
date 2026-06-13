const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const bindingsPath = 'js/editor/editor-bindings.js';
const detailUiPath = 'js/editor/editor-detail-ui.js';

test('editor memory nodes support direct edit gestures without changing single-select flow', () => {
  const source = fs.readFileSync(bindingsPath, 'utf8');

  assert.match(source, /bindCanvasNodeDirectEdit/, 'must bind direct node edit gestures through editor bindings');
  assert.match(source, /dblclick/, 'desktop direct edit must use double-click');
  assert.match(source, /touchend/, 'touch direct edit must use tap completion');
  assert.match(source, /doubleTapDelay\s*=\s*360/, 'touch direct edit must use an explicit forgiving double-tap window');
  assert.match(source, /requestDirectNodeEdit/, 'must route both double-click and double-tap through one edit request helper');
  assert.match(source, /nodeEl\.click\(\)/, 'direct edit must keep selection behavior by selecting the node first');
  assert.match(source, /enterEditMode\(\{ type: 'directNodeEdit'/, 'direct edit must reuse the existing edit mode path');
});

test('selected moment view supports user-initiated inline playback from stored media URLs', () => {
  const source = fs.readFileSync(detailUiPath, 'utf8');

  assert.match(source, /bindDetailMediaPlayback/, 'detail UI must bind the preview play button');
  assert.match(source, /buildInlinePlayerElement/, 'detail UI must build a safe inline player element');
  assert.match(source, /www\.youtube-nocookie\.com\/embed/, 'YouTube playback must use the privacy-enhanced embed host');
  assert.match(source, /data\.sourceUrl \|\|\s*\n\s*data\.source_url/, 'playback must prefer existing memory source URL fields');
  assert.match(source, /data-editor-detail-player/, 'inserted players must be identifiable and removable on selection change');
  assert.match(source, /params\.set\('autoplay', '1'\)/, 'autoplay must be attached only inside the user-triggered player builder');
  assert.match(source, /moment_inline_player_unavailable/, 'missing or unsupported media URLs must fail safely');
});

test('direct edit and inline playback stay editor-frontend-only', () => {
  const combined = fs.readFileSync(bindingsPath, 'utf8') + '\n' + fs.readFileSync(detailUiPath, 'utf8');

  assert.doesNotMatch(combined, /youtube\.googleapis|googleapis\.com\/youtube|YouTube\s*API/i, 'must not add YouTube API or feed integration');
  assert.doesNotMatch(combined, /Scout|LLM|provider/i, 'must not add Scout/provider/AI behavior');
  assert.doesNotMatch(combined, /CREATE\s+TABLE|ALTER\s+TABLE|migration/i, 'must not add schema or migration work');
});
