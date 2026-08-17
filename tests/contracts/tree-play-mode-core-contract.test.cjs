/**
 * Tree Play Mode Queue Core — deterministic contract tests
 * Issue #4064
 *
 * Pure, Node-only execution. No YouTube network calls, no browser real API,
 * no window/document. The core is a provider/UI-independent state machine.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CORE_PATH = path.resolve(__dirname, '..', '..', 'js', 'playback', 'tree-play-mode-core.js');
const POC_JS_PATH = path.resolve(__dirname, '..', '..', 'js', 'product', 'youtube-segment-player-poc.js');
const POC_HTML_PATH = path.resolve(__dirname, '..', '..', 'pages', 'youtube-segment-player-poc.html');

const { createTreePlayModeCore, STATES, COMMANDS, UNAVAILABLE_REASONS } = require(CORE_PATH);

function makeCore(opts) {
  return createTreePlayModeCore(opts || {});
}

// --- 1. empty queue ---------------------------------------------------------
test('1. empty queue -> EMPTY state, no commands', () => {
  const core = makeCore();
  const r = core.load([]);
  assert.equal(r.state, STATES.EMPTY);
  assert.equal(r.command, null);
  assert.equal(core.getState().occurrenceCount, 0);
  assert.equal(core.getState().hasCurrent, false);
});

// --- 2. one playable item ---------------------------------------------------
test('2. one playable item loads and is current', () => {
  const core = makeCore();
  const r = core.load([{ mediaId: 'VID', title: 'Only', startSeconds: 0, endSeconds: 10 }]);
  assert.equal(r.state, STATES.LOADED);
  assert.equal(r.currentIndex, 0);
  assert.equal(r.command.type, COMMANDS.LOAD_OCCURRENCE);
  assert.equal(core.getState().occurrence.mediaId, 'VID');
});

// --- 3. ordered 3-item queue ------------------------------------------------
test('3. ordered 3-item queue preserves canonical order', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q);
  const queue = core.getQueue();
  assert.equal(queue.length, 3);
  assert.equal(queue[0].mediaId, 'A');
  assert.equal(queue[1].mediaId, 'B');
  assert.equal(queue[2].mediaId, 'C');
  assert.deepEqual(queue.map((o) => o.sourceIndex), [0, 1, 2]);
});

// --- 4. duplicate same media ID remain distinct -----------------------------
test('4. duplicate same mediaId occurrences remain distinct', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'XYZ', title: 'Occ A', startSeconds: 10, endSeconds: 20 },
    { mediaId: 'XYZ', title: 'Occ B', startSeconds: 42, endSeconds: 58 }
  ];
  core.load(q);
  const queue = core.getQueue();
  assert.equal(queue.length, 2);
  assert.equal(queue[0].mediaId, 'XYZ');
  assert.equal(queue[1].mediaId, 'XYZ');
  assert.notEqual(queue[0].occurrenceKey, queue[1].occurrenceKey);
  assert.equal(queue[0].occurrenceKey, 'occ-0');
  assert.equal(queue[1].occurrenceKey, 'occ-1');
  assert.equal(queue[0].startSeconds, 10);
  assert.equal(queue[1].startSeconds, 42);
});

// --- 5. start first playable ------------------------------------------------
test('5. start at first playable occurrence (skips leading unplayable)', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'U1', title: 'Unplayable', playable: false, unavailableReason: 'DELETED' },
    { mediaId: 'P1', title: 'First Playable', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'P2', title: 'Second', startSeconds: 0, endSeconds: 5 }
  ];
  const r = core.load(q);
  assert.equal(r.state, STATES.LOADED);
  assert.equal(r.currentIndex, 1);
  assert.equal(core.getState().occurrence.mediaId, 'P1');
});

// --- 6. explicit start from selected occurrence ----------------------------
test('6. explicit start from selected (playable) occurrence', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  const r = core.load(q, { selectedIndex: 2 });
  assert.equal(r.state, STATES.LOADED);
  assert.equal(r.currentIndex, 2);
  assert.equal(core.getState().occurrence.mediaId, 'C');

  // selected by occurrenceKey also works
  const core2 = makeCore();
  core2.load(q, { selectedOccurrenceKey: 'occ-1' });
  assert.equal(core2.getState().currentIndex, 1);
});

// --- 6b. explicit start from selected UNPLAYABLE -> explicit non-playable ---
test('6b. explicit start from selected unplayable -> SELECTED_UNPLAYABLE (no silent skip)', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'U', title: 'Unplayable', playable: false, unavailableReason: 'PRIVATE' },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  const r = core.load(q, { selectedIndex: 1 });
  assert.equal(r.state, STATES.SELECTED_UNPLAYABLE);
  assert.equal(r.command, null);
  assert.equal(r.currentIndex, 1);
  assert.equal(core.getState().occurrence.mediaId, 'U');
  assert.equal(core.getState().occurrence.playable, false);
});

// --- 7. previous ------------------------------------------------------------
test('7. previous moves to the previous occurrence', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 2 });
  const r = core.previous();
  assert.equal(r.state, STATES.LOADED);
  assert.equal(r.currentIndex, 1);
  assert.equal(core.getState().occurrence.mediaId, 'B');
});

// --- 8. next ---------------------------------------------------------------
test('8. next moves to the next occurrence', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  const r = core.next();
  assert.equal(r.state, STATES.LOADED);
  assert.equal(r.currentIndex, 1);
  assert.equal(r.command.type, COMMANDS.LOAD_OCCURRENCE);
  assert.equal(core.getState().occurrence.mediaId, 'B');
});

// --- 9. no wrap at first/last ----------------------------------------------
test('9. no wrap at last (next -> QUEUE_COMPLETE) and at first (previous -> BEGINNING)', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 2 });
  const last = core.next();
  assert.equal(last.state, STATES.QUEUE_COMPLETE);
  assert.equal(last.currentIndex, 2); // unchanged, no wrap
  assert.equal(last.command.type, COMMANDS.QUEUE_COMPLETE);

  const core2 = makeCore();
  core2.load(q, { selectedIndex: 0 });
  const first = core2.previous();
  assert.equal(first.state, STATES.BEGINNING);
  assert.equal(first.currentIndex, 0); // unchanged, no wrap
});

// --- 10. queue complete -----------------------------------------------------
test('10. queue completes when last playable item finishes', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  core.play();
  core.markPlaying();
  const r = core.markItemCompleted();
  assert.equal(r.state, STATES.AUTO_PLAY_PENDING);
  assert.equal(r.currentIndex, 1);
  const done = core.markItemCompleted();
  assert.equal(done.state, STATES.QUEUE_COMPLETE);
});

// --- 11. valid startSeconds only -------------------------------------------
test('11. valid startSeconds only -> playable', () => {
  const core = makeCore();
  core.load([{ mediaId: 'X', title: 'X', startSeconds: 10 }]);
  const occ = core.getQueue()[0];
  assert.equal(occ.playable, true);
  assert.equal(occ.startSeconds, 10);
  assert.equal(occ.endSeconds, null);
});

// --- 12. valid start/end range ---------------------------------------------
test('12. valid start/end range -> playable', () => {
  const core = makeCore();
  core.load([{ mediaId: 'X', title: 'X', startSeconds: 10, endSeconds: 20 }]);
  const occ = core.getQueue()[0];
  assert.equal(occ.playable, true);
  assert.equal(occ.startSeconds, 10);
  assert.equal(occ.endSeconds, 20);
});

// --- 13. negative start rejection ------------------------------------------
test('13. negative start -> fail-closed unplayable (INVALID_SEGMENT)', () => {
  const core = makeCore();
  const r = core.validateSegment(-5, 10);
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'NEGATIVE_START');

  core.load([{ mediaId: 'X', title: 'X', startSeconds: -5, endSeconds: 10 }]);
  const occ = core.getQueue()[0];
  assert.equal(occ.playable, false);
  assert.equal(occ.unavailableReason, UNAVAILABLE_REASONS.INVALID_SEGMENT);
});

// --- 14. end <= start rejection --------------------------------------------
test('14. end <= start -> fail-closed unplayable', () => {
  const core = makeCore();
  const r = core.validateSegment(20, 10);
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'END_NOT_AFTER_START');

  core.load([{ mediaId: 'X', title: 'X', startSeconds: 20, endSeconds: 10 }]);
  const occ = core.getQueue()[0];
  assert.equal(occ.playable, false);
  assert.equal(occ.unavailableReason, UNAVAILABLE_REASONS.INVALID_SEGMENT);
});

// --- 15. NaN / Infinity / non-numeric rejection ----------------------------
test('15. NaN / Infinity / string -> fail-closed unplayable (no silent coercion)', () => {
  const core = makeCore();
  assert.equal(core.validateSegment(NaN, 10).valid, false);
  assert.equal(core.validateSegment(0, Infinity).valid, false);
  assert.equal(core.validateSegment('10', 20).valid, false); // string rejected, not coerced

  core.load([{ mediaId: 'X', title: 'X', startSeconds: NaN, endSeconds: 10 }]);
  assert.equal(core.getQueue()[0].playable, false);

  core.load([{ mediaId: 'Y', title: 'Y', startSeconds: 0, endSeconds: Infinity }]);
  assert.equal(core.getQueue()[0].playable, false);
});

// --- 16. unavailable item preserved in queue -------------------------------
test('16. unavailable item preserved in queue (order intact)', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'U', title: 'Unavailable', playable: false, unavailableReason: 'DELETED' },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  const queue = core.getQueue();
  assert.equal(queue.length, 3); // not deleted
  assert.equal(queue[1].mediaId, 'U');
  assert.equal(queue[1].playable, false);
  assert.equal(queue[1].unavailableReason, 'DELETED');
  assert.equal(core.getState().currentIndex, 0);
});

// --- 17. automatic skip reports SKIPPED_UNPLAYABLE --------------------------
test('17. auto-advance skips unplayable and reports it as skipped', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'U', title: 'Unavailable', playable: false, unavailableReason: 'DELETED' },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  core.play();
  core.markPlaying();
  const r = core.markItemCompleted();
  assert.equal(r.state, STATES.AUTO_PLAY_PENDING);
  assert.equal(r.currentIndex, 2);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].occurrenceKey, 'occ-1');
  assert.equal(r.skipped[0].playable, false);
  // queue still contains the skipped item
  assert.equal(core.getQueue().length, 3);
});

// --- 18. multiple consecutive unavailable items ----------------------------
test('18. multiple consecutive unavailable items all reported as skipped', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'U1', title: 'U1', playable: false, unavailableReason: 'DELETED' },
    { mediaId: 'U2', title: 'U2', playable: false, unavailableReason: 'PRIVATE' },
    { mediaId: 'U3', title: 'U3', playable: false, unavailableReason: 'NON_EMBEDDABLE' },
    { mediaId: 'E', title: 'E', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  core.play();
  core.markPlaying();
  const r = core.markItemCompleted();
  assert.equal(r.currentIndex, 4);
  assert.equal(r.skipped.length, 3);
  assert.deepEqual(r.skipped.map((o) => o.occurrenceKey), ['occ-1', 'occ-2', 'occ-3']);
});

// --- 19. all items unavailable -> stable terminal --------------------------
test('19. all items unavailable -> stable terminal NO_PLAYABLE_ITEM (no loop)', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'U1', title: 'U1', playable: false, unavailableReason: 'DELETED' },
    { mediaId: 'U2', title: 'U2', playable: false, unavailableReason: 'PRIVATE' }
  ];
  const r = core.load(q);
  assert.equal(r.state, STATES.NO_PLAYABLE_ITEM);
  assert.equal(r.queueComplete, false);
  assert.equal(core.getState().hasCurrent, false);
  // Deterministic, bounded: next/previous do not throw or loop.
  assert.equal(core.next().state, STATES.NO_PLAYABLE_ITEM);
  assert.equal(core.previous().state, STATES.NO_PLAYABLE_ITEM);
});

// --- 20. auto-advance selects next but does NOT claim play -----------------
test('20. auto-advance selects next but does not claim PLAYING', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  const r = core.markItemCompleted();
  assert.equal(r.state, STATES.AUTO_PLAY_PENDING);
  assert.notEqual(r.state, STATES.PLAYING);
  assert.equal(core.getState().playbackState, STATES.AUTO_PLAY_PENDING);
  assert.equal(core.getState().autoplayBlocked, false);
  assert.equal(r.command.type, COMMANDS.LOAD_OCCURRENCE);
  assert.equal(r.command.autoplay, true);
});

// --- 21. autoplay blocked -> MANUAL_CONTINUE_REQUIRED ----------------------
test('21. autoplay blocked -> MANUAL_CONTINUE_REQUIRED', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  core.play(); // AUTO_PLAY_PENDING
  const blocked = core.markAutoplayBlocked();
  assert.equal(blocked.state, STATES.MANUAL_CONTINUE_REQUIRED);
  assert.equal(blocked.command.type, COMMANDS.MANUAL_CONTINUE_REQUIRED);
  assert.equal(core.getState().autoplayBlocked, true);
});

// --- 22. manual continuation clears blocked state only after confirmed -----
test('22. manual continuation clears blocked state only after confirmed transition', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  core.play();
  core.markAutoplayBlocked();
  // Before confirmation the blocked state persists.
  assert.equal(core.getState().autoplayBlocked, true);
  assert.equal(core.getState().playbackState, STATES.MANUAL_CONTINUE_REQUIRED);
  // Confirmed transition clears it.
  const resumed = core.markPlaying();
  assert.equal(resumed.state, STATES.PLAYING);
  assert.equal(core.getState().autoplayBlocked, false);
  assert.equal(core.getState().playbackState, STATES.PLAYING);
});

// --- 23. caller input queue not mutated ------------------------------------
test('23. caller input queue array/order not mutated', () => {
  const raw = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  const core = makeCore();
  core.load(raw);
  assert.equal(raw.length, 2);
  assert.equal(raw[0].mediaId, 'A');
  assert.equal(raw[1].mediaId, 'B');
  // We must not have attached internal fields to caller objects.
  assert.equal(raw[0].occurrenceKey, undefined);
  assert.equal(raw[0].playable, undefined);
});

// --- 24. caller item objects not mutated -----------------------------------
test('24. caller item objects not mutated (no silent coercion/addition)', () => {
  const raw = [{ mediaId: 'X', title: 'X', startSeconds: 10, endSeconds: 20, loop: true }];
  const core = makeCore();
  core.load(raw);
  assert.equal(raw[0].startSeconds, 10);
  assert.equal(raw[0].endSeconds, 20);
  assert.equal(raw[0].loop, true);
  assert.equal(raw[0].occurrenceKey, undefined);
  assert.equal(raw[0].playable, undefined);
  assert.equal(raw[0].unavailableReason, undefined);
});

// --- 25. returned state mutation does not corrupt internal state ----------
test('25. mutating returned snapshot does not corrupt internal state', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  const snapshot = core.getState();
  // Attempt to corrupt the returned snapshot.
  snapshot.currentIndex = 999;
  if (snapshot.occurrence) snapshot.occurrence.mediaId = 'MUTATED';
  if (snapshot.lastSkipped) snapshot.lastSkipped.length = 0;
  // Fresh snapshot must be unaffected.
  const fresh = core.getState();
  assert.equal(fresh.currentIndex, 0);
  assert.equal(fresh.occurrence.mediaId, 'A');

  // getQueue copy isolation.
  const queue = core.getQueue();
  queue[0].mediaId = 'MUT';
  assert.equal(core.getQueue()[0].mediaId, 'A');
});

// --- 26. reset removes prior playback state --------------------------------
test('26. reset removes prior playback / autoplay-block state (no leakage)', () => {
  const core = makeCore();
  const q1 = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q1, { selectedIndex: 0 });
  core.play();
  core.markPlaying();
  core.markItemCompleted();
  core.markAutoplayBlocked();

  const q2 = [
    { mediaId: 'X', title: 'X', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'Y', title: 'Y', startSeconds: 0, endSeconds: 5 }
  ];
  const r = core.reset(q2);
  const s = core.getState();
  assert.equal(s.currentIndex, 0);
  assert.equal(s.occurrence.mediaId, 'X');
  assert.equal(s.autoplayBlocked, false);
  assert.equal(s.playbackState, STATES.LOADED);
  assert.equal(s.completionCount, 0);
  assert.equal(s.lastSkipped.length, 0);
  assert.equal(r.command.type, COMMANDS.LOAD_OCCURRENCE);
});

// --- 27. repeat reset deterministic ----------------------------------------
test('27. repeat reset is deterministic', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  const a = core.reset(q);
  const b = core.reset(q);
  assert.deepEqual(
    [a.state, a.currentIndex, a.command && a.command.type],
    [b.state, b.currentIndex, b.command && b.command.type]
  );
  assert.deepEqual(core.getState().occurrence.mediaId, 'A');
});

// --- 28. existing PoC remains loadable / syntactically valid ---------------
test('28. existing segment-player PoC remains syntactically valid and references core', () => {
  // node --check on the PoC JS (syntax only; no execution, no browser globals).
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ['--check', POC_JS_PATH], { stdio: 'pipe' });
  });
  const fs = require('node:fs');
  const html = fs.readFileSync(POC_HTML_PATH, 'utf8');
  // The PoC page still exists and references its runtime.
  assert.match(html, /youtube-segment-player-poc\.js/);
  // Core module file exists.
  assert.doesNotThrow(() => fs.accessSync(CORE_PATH));
});

// --- ONE_ACTIVE_PLAYER invariant -------------------------------------------
test('INVARIANT. only one active occurrence is ever referenced', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  const ops = [core.next(), core.previous(), core.play(), core.markItemCompleted(), core.next()];
  for (const r of ops) {
    if (r.command && r.command.occurrence) {
      assert.ok(!Array.isArray(r.command.occurrence), 'command must reference a single occurrence');
    }
  }
  // At all times exactly one current index.
  assert.ok(core.getState().currentIndex >= 0);
  assert.equal(core.getQueue().filter((o) => o.playable).length >= 1, true);
});

// --- core has no forbidden runtime dependencies -----------------------------
test('ISOLATION. core does not depend on window/document/fetch/YT', () => {
  // The module loaded fine in Node without any of those globals.
  const mod = require(CORE_PATH);
  assert.equal(typeof mod.createTreePlayModeCore, 'function');
});

// --- 29. manual-continue user action alone never claims PLAYING ------------
test('29. manual-continue user action alone does not claim PLAYING', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  core.play();
  core.markAutoplayBlocked(); // MANUAL_CONTINUE_REQUIRED
  // The user clicks Play. A correct adapter only issues a playback request
  // (player.playVideo / core.play); it never calls markPlaying on the gesture.
  const request = core.play();
  assert.notEqual(request.state, STATES.PLAYING, 'user action alone must not claim PLAYING');
  assert.equal(request.state, STATES.AUTO_PLAY_PENDING, 'request stays in pending authority');
  assert.equal(core.getState().playbackState, STATES.AUTO_PLAY_PENDING);
  // Blocked authority persists until explicit adapter/player confirmation.
  assert.equal(core.getState().autoplayBlocked, true);
});

// --- 30. blocked/pending authority persists until explicit confirmation ----
test('30. MANUAL_CONTINUE_REQUIRED/pending authority persists until explicit confirmation', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  core.play();
  core.markAutoplayBlocked();
  assert.equal(core.getState().playbackState, STATES.MANUAL_CONTINUE_REQUIRED);
  // Re-requesting playback still does not reach PLAYING.
  core.play();
  assert.notEqual(core.getState().playbackState, STATES.PLAYING);
  assert.equal(core.getState().autoplayBlocked, true);
  // Only the explicit confirmation clears blocked state and reaches PLAYING.
  const confirmed = core.markPlaying();
  assert.equal(confirmed.state, STATES.PLAYING);
  assert.equal(core.getState().playbackState, STATES.PLAYING);
  assert.equal(core.getState().autoplayBlocked, false);
});

// --- 31. no non-confirmation operation reaches PLAYING ----------------------
test('31. PLAYING reachable only via explicit adapter confirmation (markPlaying)', () => {
  const core = makeCore();
  const q = [
    { mediaId: 'A', title: 'A', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'B', title: 'B', startSeconds: 0, endSeconds: 5 },
    { mediaId: 'C', title: 'C', startSeconds: 0, endSeconds: 5 }
  ];
  core.load(q, { selectedIndex: 0 });
  core.play();
  core.markAutoplayBlocked();
  // Every non-confirmation operation from blocked/pending authority must not
  // produce PLAYING.
  const ops = [
    core.play(),
    core.pause(),
    core.play(),
    core.next(),
    core.previous(),
    core.seek(1),
    core.markItemCompleted()
  ];
  for (const r of ops) {
    assert.notEqual(r.state, STATES.PLAYING, 'non-confirmation op must not claim PLAYING');
  }
  assert.notEqual(core.getState().playbackState, STATES.PLAYING);
  // Confirmation is the single path to PLAYING.
  const confirmed = core.markPlaying();
  assert.equal(confirmed.state, STATES.PLAYING);
  assert.equal(core.getState().playbackState, STATES.PLAYING);
});

// --- ADAPTER CONFIRMATION BOUNDARY (source-static PoC regression) ----------
test('ADAPTER_CONFIRMATION. PoC adapter claims PLAYING only from real YT PLAYING callback', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(POC_JS_PATH, 'utf8');
  const stripLineComments = (s) => s.replace(/\/\/[^\n]*/g, '');

  // Exactly one executable core.markPlaying() call site in the whole adapter:
  // the YT.PlayerState.PLAYING branch of onPlayerStateChange.
  const srcNoComments = stripLineComments(src);
  const callSites = srcNoComments.match(/core\.markPlaying\(\)/g) || [];
  assert.equal(callSites.length, 1, 'exactly one executable markPlaying call site');

  const scStart = src.indexOf('function onPlayerStateChange');
  const scEnd = src.indexOf('function onPlayerError');
  assert.ok(scStart >= 0 && scEnd > scStart, 'onPlayerStateChange must exist');
  const stateChangeBody = stripLineComments(src.slice(scStart, scEnd));
  assert.ok(/YT\.PlayerState\.PLAYING/.test(stateChangeBody), 'PLAYING branch must exist');
  assert.equal(
    (stateChangeBody.match(/core\.markPlaying\(\)/g) || []).length,
    1,
    'the single markPlaying call must live in the YT PLAYING callback'
  );

  // The Play click handler (manual MANUAL_CONTINUE_REQUIRED -> Play path)
  // only issues a playback request; it never claims PLAYING on user gesture.
  const clickStart = src.indexOf("btnPlay.addEventListener('click'");
  const clickEnd = src.indexOf("btnPause.addEventListener('click'");
  assert.ok(clickStart >= 0 && clickEnd > clickStart, 'Play click handler must exist');
  const playHandler = stripLineComments(src.slice(clickStart, clickEnd));
  assert.ok(
    !/core\.markPlaying\(\)/.test(playHandler),
    'manual-continue Play click must not call markPlaying'
  );
  assert.ok(/player\.playVideo\(\)/.test(playHandler), 'Play click only issues a playback request');
  assert.ok(
    /STATES\.MANUAL_CONTINUE_REQUIRED/.test(playHandler),
    'manual-continue branch remains present'
  );
});
