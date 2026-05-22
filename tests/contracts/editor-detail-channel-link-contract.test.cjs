const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function createDetailChannelContext(options = {}) {
  const elements = new Map();

  function createElement(tagName) {
    const children = [];
    const element = {
      tagName: String(tagName).toUpperCase(),
      id: '',
      className: '',
      style: {},
      attributes: {},
      children,
      parentElement: null,
      textContent: '',
      href: '',
      target: '',
      rel: '',
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      appendChild(child) {
        child.parentElement = this;
        children.push(child);
        if (child.id) elements.set(child.id, child);
        return child;
      },
      remove() {
        if (this.parentElement) {
          const index = this.parentElement.children.indexOf(this);
          if (index >= 0) this.parentElement.children.splice(index, 1);
        }
        if (this.id) elements.delete(this.id);
      },
      insertAdjacentElement(position, child) {
        child.parentElement = this.parentElement;
        if (child.id) elements.set(child.id, child);
        if (!this.parentElement || position !== 'afterend') return child;
        const index = this.parentElement.children.indexOf(this);
        this.parentElement.children.splice(index + 1, 0, child);
        return child;
      }
    };
    return element;
  }

  const title = createElement('h4');
  title.id = 'detailCurrentMomentTitle';
  elements.set(title.id, title);

  const parent = createElement('div');
  parent.appendChild(title);

  const context = {
    URL,
    window: {
      createEditorDetailUI: options.createEditorDetailUI || (() => ({
        updateDetailPanel: () => {}
      }))
    },
    document: {
      createElement,
      getElementById: (id) => elements.get(id) || null
    }
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-detail-channel-link.js'), 'utf8'), context);

  return {
    context,
    title,
    getChannelRow: () => elements.get('detailCurrentMomentChannel') || null
  };
}

test('editor detail channel link renders safe YouTube handle link after title', () => {
  const harness = createDetailChannelContext();

  harness.context.window.LoveBudEditorDetailChannelLink.renderDetailChannelLink({
    channelId: '@woowayoung',
    channelName: '@woowayoung',
    channelUrl: 'https://www.youtube.com/@woowayoung'
  });

  const row = harness.getChannelRow();
  assert.ok(row);
  assert.equal(row.children[1].textContent, 'from');
  assert.equal(row.children[2].tagName, 'A');
  assert.equal(row.children[2].href, 'https://www.youtube.com/@woowayoung');
  assert.equal(row.children[2].target, '_blank');
  assert.equal(row.children[2].rel, 'noopener noreferrer');
  assert.equal(row.children[2].textContent, '@woowayoung');
});

test('editor detail channel link does not use unsafe explicit channel URL', () => {
  const harness = createDetailChannelContext();

  harness.context.window.LoveBudEditorDetailChannelLink.renderDetailChannelLink({
    channelId: '@woowayoung',
    channelName: '@woowayoung',
    channelUrl: 'javascript:alert(1)'
  });

  const row = harness.getChannelRow();
  assert.ok(row, 'safe channelId fallback should still render');
  assert.equal(row.children[2].href, 'https://www.youtube.com/@woowayoung');
});

test('editor detail channel link removes stale row when selected memory lacks channel data', () => {
  const harness = createDetailChannelContext();

  harness.context.window.LoveBudEditorDetailChannelLink.renderDetailChannelLink({
    channelId: '@woowayoung',
    channelName: '@woowayoung',
    channelUrl: 'https://www.youtube.com/@woowayoung'
  });
  assert.ok(harness.getChannelRow());

  harness.context.window.LoveBudEditorDetailChannelLink.renderDetailChannelLink({
    title: 'No channel memory'
  });

  assert.equal(harness.getChannelRow(), null);
});

test('editor detail channel link patch wraps updateDetailPanel without replacing original behavior', () => {
  let originalCalled = false;
  const harness = createDetailChannelContext({
    createEditorDetailUI: () => ({
      updateDetailPanel: () => { originalCalled = true; }
    })
  });

  const detailUI = harness.context.window.createEditorDetailUI({});
  detailUI.updateDetailPanel({
    channelId: '@woowayoung',
    channelName: '@woowayoung',
    channelUrl: 'https://www.youtube.com/@woowayoung'
  });

  assert.equal(originalCalled, true);
  assert.ok(harness.getChannelRow());
});
