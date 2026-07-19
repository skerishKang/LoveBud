/**
 * LoveBud — My Trees Preview Hub metric-transition runtime contract
 * Issue #3578 Phase 1 follow-up (stale hub metrics)
 *
 * Executes the real my-trees-preview-hub.js in node:vm against a faithful
 * faux DOM. The faux DOM parses innerHTML into a live node tree so the social
 * shell created by createMyTreesSocialShell() is reachable via
 * querySelector('[data-...]') and closest('.preview-social-action').
 *
 * Asserts that switching selected trees never leaves the previous tree's
 * metric counts behind.
 *
 * Three-state semantics (from shared tree-card-metrics helper):
 *   - finite 0              → render '0', item visible
 *   - finite positive       → render number, item visible
 *   - null/undefined/absent/non-finite → empty, item hidden (never '0')
 *
 * Scenarios:
 *   A. rich → unknown (stale leak regression)
 *   B. unknown → zero (authoritative zero stays visible)
 *   C. partial (mixed available/unknown, no lingering prior values)
 *   D. hidden → visible recovery (reselect rich tree)
 *   E. non-finite (NaN / Infinity / negative treated as unknown)
 *
 * Primary: EXECUTED_FAKE — runs hub in node:vm with faux DOM
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* ── Faithful faux DOM ──
   Minimal but real enough for the hub:
   - innerHTML setter parses a restricted HTML subset into FauxNode children
     (div/button/strong/span tags; class=, data-*=, aria-*=, type=, role=,
     disabled attributes including valueless boolean attributes; text nodes)
   - querySelector supports [data-x], .class, tag (descendant search)
   - closest('.class') walks up parentNode
   - hidden is a real boolean property
*/
function parseAttrs(attrStr) {
  const attrs = {};
  const re = /([\w-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = m[2];
  }
  // Capture valueless boolean attributes (e.g. data-my-trees-social-views,
  // disabled) by removing matched pairs first then scanning the remainder.
  const remainder = attrStr.replace(/[\w-]+\s*=\s*"[^"]*"/g, ' ').trim();
  const bareRe = /([\w-]+)/g;
  while ((m = bareRe.exec(remainder)) !== null) {
    if (attrs[m[1]] === undefined) attrs[m[1]] = '';
  }
  return attrs;
}

const VOID_TAGS = ['img', 'br', 'hr', 'input', 'meta', 'link'];

function parseHtml(html, ownerDoc) {
  const tokens = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i);
      if (end === -1) break;
      const raw = html.slice(i + 1, end);
      if (raw.charAt(0) === '/') {
        tokens.push({ type: 'close', name: raw.slice(1).trim().toLowerCase() });
      } else {
        const selfClose = raw.charAt(raw.length - 1) === '/';
        const body = selfClose ? raw.slice(0, -1) : raw;
        const spaceIdx = body.search(/\s/);
        let name, attrStr;
        if (spaceIdx === -1) { name = body.trim().toLowerCase(); attrStr = ''; }
        else { name = body.slice(0, spaceIdx).trim().toLowerCase(); attrStr = body.slice(spaceIdx + 1); }
        tokens.push({ type: 'open', name, attrs: parseAttrs(attrStr), selfClose });
      }
      i = end + 1;
    } else {
      const next = html.indexOf('<', i);
      const text = html.slice(i, next === -1 ? html.length : next).replace(/\s+/g, ' ').trim();
      if (text) tokens.push({ type: 'text', text });
      i = next === -1 ? html.length : next;
    }
  }
  const root = { children: [] };
  const stack = [root];
  for (const tok of tokens) {
    if (tok.type === 'text') {
      stack[stack.length - 1].children.push({ type: 'text', text: tok.text });
    } else if (tok.type === 'open') {
      const node = new FauxNode(tok.name);
      for (const k of Object.keys(tok.attrs)) node.attrs[k] = tok.attrs[k];
      stack[stack.length - 1].children.push(node);
      if (!tok.selfClose && !VOID_TAGS.includes(tok.name)) {
        stack.push(node);
      }
    } else if (tok.type === 'close') {
      for (let j = stack.length - 1; j > 0; j--) {
        if (stack[j].tagName === tok.name.toUpperCase()) { stack.length = j; break; }
      }
    }
  }
  // Attach parentNode for parsed children.
  (function linkParents(nodes, parent) {
    for (const n of nodes) {
      if (n instanceof FauxNode) {
        n.parentNode = parent;
        linkParents(n.children, n);
      }
    }
  })(root.children, ownerDoc || null);
  return root.children;
}

function matchSelectorPart(el, part) {
  if (!(el instanceof FauxNode)) return false;
  if (part.charAt(0) === '[') {
    const a = part.slice(1, -1);
    return el.attrs[a] !== undefined;
  }
  if (part.charAt(0) === '.') {
    return el.attrs.class && el.attrs.class.split(/\s+/).indexOf(part.slice(1)) !== -1;
  }
  return el.tagName === part.toUpperCase();
}

function selectorToParts(sel) {
  return sel.match(/\[[^\]]+\]|\.[\w-]+|[\w-]+/g) || [];
}

function matchCompound(el, parts) {
  return parts.every((p) => matchSelectorPart(el, p));
}

function findIn(nodes, parts) {
  for (const n of nodes) {
    if (n instanceof FauxNode) {
      if (matchCompound(n, parts)) return n;
      const deep = findIn(n.children, parts);
      if (deep) return deep;
    }
  }
  return null;
}

function findAllIn(nodes, parts, out) {
  for (const n of nodes) {
    if (n instanceof FauxNode) {
      if (matchCompound(n, parts)) out.push(n);
      findAllIn(n.children, parts, out);
    }
  }
}

class FauxNode {
  constructor(tagName) {
    this.tagName = (tagName || 'div').toUpperCase();
    this.nodeName = this.tagName;
    this.attrs = {};
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this._hidden = false;
    this._textContent = '';
    this._innerHTML = '';
    this._classList = null;
  }
  get hidden() { return this._hidden; }
  set hidden(v) { this._hidden = !!v; }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = String(v); }
  get className() { return this.attrs.class || ''; }
  set className(v) { if (v) this.attrs.class = String(v); else delete this.attrs.class; }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    this.children = parseHtml(String(v), this);
  }
  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = String(v); }
  getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return this.attrs[k] !== undefined; }
  appendChild(c) {
    if (c.parentNode) c.parentNode.removeChild(c);
    this.children.push(c);
    c.parentNode = this;
    return c;
  }
  removeChild(c) { const i = this.children.indexOf(c); if (i !== -1) this.children.splice(i, 1); c.parentNode = null; return c; }
  replaceChildren() { this.children.length = 0; }
  after() {}
  remove() {}
  cloneNode() { return new FauxNode(this.tagName); }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  removeEventListener() {}
  get classList() {
    if (!this._classList) {
      const self = this;
      this._classList = {
        add(...cs) {
          const cur = (self.attrs.class || '').split(/\s+/).filter(Boolean);
          for (const c of cs) if (!cur.includes(c)) cur.push(c);
          self.attrs.class = cur.join(' ');
        },
        remove(...cs) {
          const cur = (self.attrs.class || '').split(/\s+/).filter(Boolean);
          self.attrs.class = cur.filter((c) => !cs.includes(c)).join(' ');
        },
        toggle(c) { if (this.contains(c)) { this.remove(c); return false; } this.add(c); return true; },
        contains(c) { return (self.attrs.class || '').split(/\s+/).includes(c); }
      };
    }
    return this._classList;
  }
  set classNameProp(v) { this.className = v; }
  querySelector(sel) {
    const parts = selectorToParts(sel);
    return findIn(this.children, parts);
  }
  querySelectorAll(sel) {
    const parts = selectorToParts(sel);
    const out = [];
    findAllIn(this.children, parts, out);
    return out;
  }
  closest(sel) {
    const parts = selectorToParts(sel);
    let node = this;
    while (node) {
      if (node instanceof FauxNode && matchCompound(node, parts)) return node;
      node = node.parentNode;
    }
    return null;
  }
}

function createFauxDocument(panelEls) {
  const byId = {};
  for (const id of Object.keys(panelEls)) byId[id] = panelEls[id];
  return {
    createElement: (tag) => new FauxNode(tag),
    createTextNode: (txt) => { const n = new FauxNode('span'); n.textContent = String(txt); return n; },
    getElementById: (id) => byId[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    documentElement: { lang: 'ko' }
  };
}

function createHubContext() {
  const panel = new FauxNode('div');
  panel.id = 'myTreesHubPanel';
  const socialSlot = new FauxNode('div');
  socialSlot.id = 'myTreesHubSocialSlot';
  panel.appendChild(socialSlot);
  const actions = new FauxNode('div');
  actions.id = 'myTreesHubActions';
  panel.appendChild(actions);

  const ids = [
    'myTreesHubHeader', 'myTreesHubBadge', 'myTreesHubPlaceholder', 'myTreesHubContent',
    'myTreesHubTreeTitle', 'myTreesHubMetaBadge', 'myTreesHubFlow', 'myTreesHubFlowLabel',
    'myTreesHubFlowList', 'myTreesHubFlowControls', 'myTreesHubSummary', 'myTreesHubNoMoments',
    'myTreesHubOpenBtn', 'myTreesHubPublicViewBtn', 'myTreesHubShareBtn'
  ];
  const panelEls = { myTreesHubPanel: panel, myTreesHubSocialSlot: socialSlot, myTreesHubActions: actions };
  for (const id of ids) {
    const tag = (id === 'myTreesHubOpenBtn' || id === 'myTreesHubPublicViewBtn') ? 'a' : (id === 'myTreesHubShareBtn' ? 'button' : 'div');
    const e = new FauxNode(tag);
    e.id = id;
    panelEls[id] = e;
    panel.appendChild(e);
  }

  const ctx = {
    console: { warn() {}, log() {}, error() {} },
    Math, Number, Array, Object, String, Boolean, JSON, Date, isNaN,
    setTimeout: () => 0, clearTimeout: () => {},
    URL, encodeURIComponent: (s) => global.encodeURIComponent(s),
    navigator: { clipboard: { writeText: async () => {} } },
    location: { href: 'https://lovebud.pages.dev/pages/my-trees', origin: 'https://lovebud.pages.dev', pathname: '/pages/my-trees', search: '' }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.top = ctx;
  ctx.innerWidth = 1024;
  ctx.document = createFauxDocument(panelEls);
  ctx.t = (k) => k;
  ctx.i18n = { currentLang: 'ko' };
  ctx.LoveBudPath = { getBasePath: () => 'pages/' };
  ctx.LoveBudSecurity = { escapeHtml: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') };
  ctx.LoveBudMyTreesPreviewMedia = null;
  ctx.LoveBudMyTreesEntryTargetResolver = {
    resolveMyTreesEntryTargets: (t) => ({
      treeId: t && t.id || null,
      accessState: (t && t.visibility === 'public') ? 'public' : 'private',
      primary: t && t.id ? { available: true, href: 'editor?treeId=' + encodeURIComponent(t.id), action: 'appreciation', interactionMode: 'appreciation', routeSurface: 'editor' } : null,
      publicView: { available: false, href: null },
      shareTarget: { available: false, href: null }
    })
  };
  ctx.LoveBudMyTreesUI = {
    validateAndResolveEntryTargets: (t) => ({
      treeId: t && t.id || null,
      accessState: (t && t.visibility === 'public') ? 'public' : 'private',
      primary: t && t.id ? ('pages/editor?treeId=' + encodeURIComponent(t.id)) : null,
      publicView: null,
      shareTarget: null
    })
  };
  vm.createContext(ctx);
  vm.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  vm.runInContext(read('js/my-trees/my-trees-preview-hub.js'), ctx);
  return { ctx, Hub: ctx.window.LoveBudMyTreesPreviewHub, panel: panelEls.myTreesHubPanel };
}

function getMetric(panel, sel) {
  const valueEl = panel.querySelector(sel);
  if (!valueEl) return { valueEl: null, item: null, text: null, hidden: null };
  const item = valueEl.closest('.preview-social-action');
  return {
    valueEl,
    item,
    text: valueEl.textContent,
    hidden: item ? item.hidden : null
  };
}

function shellEl(panel) {
  return panel.querySelector('[data-my-trees-social-shell]');
}

/* ── Tests ── */

test('A. rich → unknown: no stale leak of Tree A counts into Tree B', () => {
  const { Hub, panel } = createHubContext();
  const treeA = { id: 'a', title: 'A', visibility: 'private', memoryCount: 0, viewCount: 10, likeCount: 5, commentCount: 3, shareCount: 2 };
  Hub.showContent(treeA);

  const shellBefore = shellEl(panel);
  assert.ok(shellBefore, 'shell must be created');
  assert.equal(shellBefore.hidden, false, 'shell visible when metrics present');

  const aViews = getMetric(panel, '[data-my-trees-social-views]');
  const aLikes = getMetric(panel, '[data-my-trees-social-likes]');
  const aComments = getMetric(panel, '[data-my-trees-social-comments]');
  assert.equal(aViews.text, '10');
  assert.equal(aLikes.text, '5');
  assert.equal(aComments.text, '3');

  // Tree B: all metrics unknown (null / absent / undefined)
  const treeB = { id: 'b', title: 'B', visibility: 'private', memoryCount: 0, viewCount: null, likeCount: undefined /* commentCount absent */ };
  Hub.showContent(treeB);

  // Same shell DOM identity preserved (not recreated).
  const shellAfter = shellEl(panel);
  assert.equal(shellAfter, shellBefore, 'social shell must be reused, not recreated');

  const bViews = getMetric(panel, '[data-my-trees-social-views]');
  const bLikes = getMetric(panel, '[data-my-trees-social-likes]');
  const bComments = getMetric(panel, '[data-my-trees-social-comments]');
  assert.equal(bViews.text, '', 'views must not retain 10');
  assert.equal(bLikes.text, '', 'likes must not retain 5');
  assert.equal(bComments.text, '', 'comments must not retain 3');
  assert.equal(bViews.hidden, true, 'views item hidden when unknown');
  assert.equal(bLikes.hidden, true, 'likes item hidden when unknown');
  assert.equal(bComments.hidden, true, 'comments item hidden when unknown');
  assert.equal(shellAfter.hidden, true, 'shell hidden when all metrics unknown');
});

test('B. unknown → zero: authoritative zero stays visible, not hidden', () => {
  const { Hub, panel } = createHubContext();
  // Start from unknown to ensure prior state is not zero.
  const treeUnknown = { id: 'u', title: 'U', visibility: 'private', memoryCount: 0, viewCount: null, likeCount: undefined };
  Hub.showContent(treeUnknown);

  const treeC = { id: 'c', title: 'C', visibility: 'private', memoryCount: 0, viewCount: 0, likeCount: 0, commentCount: 0 };
  Hub.showContent(treeC);

  assert.equal(shellEl(panel).hidden, false, 'shell visible when metrics are authoritative zeros');
  const v = getMetric(panel, '[data-my-trees-social-views]');
  const l = getMetric(panel, '[data-my-trees-social-likes]');
  const c = getMetric(panel, '[data-my-trees-social-comments]');
  assert.equal(v.text, '0', 'views shows 0');
  assert.equal(l.text, '0', 'likes shows 0');
  assert.equal(c.text, '0', 'comments shows 0');
  assert.equal(v.hidden, false, 'views item visible for authoritative 0');
  assert.equal(l.hidden, false, 'likes item visible for authoritative 0');
  assert.equal(c.hidden, false, 'comments item visible for authoritative 0');
});

test('C. partial: mixed available/unknown, no lingering prior values', () => {
  const { Hub, panel } = createHubContext();
  const treeA = { id: 'a', title: 'A', visibility: 'private', memoryCount: 0, viewCount: 10, likeCount: 5, commentCount: 3 };
  Hub.showContent(treeA);

  const treeD = { id: 'd', title: 'D', visibility: 'private', memoryCount: 0, viewCount: 7 /* likes absent, comments null */ };
  Hub.showContent(treeD);

  assert.equal(shellEl(panel).hidden, false, 'shell visible when at least one metric available');
  const v = getMetric(panel, '[data-my-trees-social-views]');
  const l = getMetric(panel, '[data-my-trees-social-likes]');
  const c = getMetric(panel, '[data-my-trees-social-comments]');
  assert.equal(v.text, '7');
  assert.equal(v.hidden, false);
  assert.equal(l.text, '', 'likes cleared (was 5)');
  assert.equal(l.hidden, true);
  assert.equal(c.text, '', 'comments cleared (was 3)');
  assert.equal(c.hidden, true);
});

test('D. hidden → visible recovery: reselecting a rich tree restores counts', () => {
  const { Hub, panel } = createHubContext();
  const treeA = { id: 'a', title: 'A', visibility: 'private', memoryCount: 0, viewCount: 10, likeCount: 5, commentCount: 3 };
  Hub.showContent(treeA);
  const treeB = { id: 'b', title: 'B', visibility: 'private', memoryCount: 0, viewCount: null, likeCount: undefined };
  Hub.showContent(treeB);
  assert.equal(shellEl(panel).hidden, true);

  // Reselect Tree A.
  Hub.showContent(treeA);

  assert.equal(shellEl(panel).hidden, false);
  const v = getMetric(panel, '[data-my-trees-social-views]');
  const l = getMetric(panel, '[data-my-trees-social-likes]');
  const c = getMetric(panel, '[data-my-trees-social-comments]');
  assert.equal(v.text, '10', 'views restored');
  assert.equal(l.text, '5', 'likes restored');
  assert.equal(c.text, '3', 'comments restored');
  assert.equal(v.hidden, false);
  assert.equal(l.hidden, false);
  assert.equal(c.hidden, false);
});

test('E. non-finite: NaN / Infinity / negative treated as unknown, no lingering prior value', () => {
  const { Hub, panel } = createHubContext();
  const treeA = { id: 'a', title: 'A', visibility: 'private', memoryCount: 0, viewCount: 10, likeCount: 5, commentCount: 3 };
  Hub.showContent(treeA);

  const treeE = { id: 'e', title: 'E', visibility: 'private', memoryCount: 0, viewCount: NaN, likeCount: Infinity, commentCount: -1 };
  Hub.showContent(treeE);

  // Resolver yields null for non-finite/negative, so all metrics unknown.
  assert.equal(shellEl(panel).hidden, true, 'shell hidden when all metrics non-finite');
  const v = getMetric(panel, '[data-my-trees-social-views]');
  const l = getMetric(panel, '[data-my-trees-social-likes]');
  const c = getMetric(panel, '[data-my-trees-social-comments]');
  assert.equal(v.text, '', 'NaN views must not retain 10');
  assert.equal(l.text, '', 'Infinity likes must not retain 5');
  assert.equal(c.text, '', 'negative comments must not retain 3');
  assert.equal(v.hidden, true);
  assert.equal(l.hidden, true);
  assert.equal(c.hidden, true);
});

test('F. shell is not recreated across transitions (identity preserved)', () => {
  const { Hub, panel } = createHubContext();
  const treeA = { id: 'a', title: 'A', visibility: 'private', memoryCount: 0, viewCount: 10, likeCount: 5, commentCount: 3 };
  Hub.showContent(treeA);
  const first = shellEl(panel);
  assert.ok(first);
  Hub.showContent({ id: 'b', title: 'B', visibility: 'private', memoryCount: 0, viewCount: null });
  Hub.showContent({ id: 'c', title: 'C', visibility: 'private', memoryCount: 0, viewCount: 0, likeCount: 0, commentCount: 0 });
  Hub.showContent(treeA);
  const last = shellEl(panel);
  assert.equal(first, last, 'shell DOM identity must be preserved across all transitions');
});
