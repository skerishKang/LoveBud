const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-channel-records-as-sources.md');
const doc = fs.readFileSync(DOC_PATH, 'utf8');

test('channel records are defined as sources, not normal moments', () => {
  assert.match(doc, /source records for future moments/);
  assert.match(doc, /not as normal video-backed moments/);
  assert.match(doc, /순간의 출처/);
  assert.match(doc, /Channel source record = a remembered source\/place/);
});

test('channel source placement is tree-scoped and not a canvas moment card by default', () => {
  assert.match(doc, /tree-scoped source records/);
  assert.match(doc, /not global accounts/);
  assert.match(doc, /not canvas moment cards by default/);
  assert.match(doc, /do not render them as normal `\.memory-node` moment cards by default/);
});

test('youtube channel and video url shapes stay distinct', () => {
  assert.match(doc, /https:\/\/www\.youtube\.com\/@SomeChannel/);
  assert.match(doc, /https:\/\/www\.youtube\.com\/channel\/UC/);
  assert.match(doc, /https:\/\/www\.youtube\.com\/c\/SomeChannel/);
  assert.match(doc, /https:\/\/www\.youtube\.com\/user\/SomeChannel/);
  assert.match(doc, /https:\/\/www\.youtube\.com\/watch\?v=/);
  assert.match(doc, /https:\/\/youtu\.be\//);
  assert.match(doc, /video-backed moment candidate, not a channel source record/);
});

test('first slice is network-free, schema-free, and non-automatic', () => {
  assert.match(doc, /no YouTube API calls/);
  assert.match(doc, /no channel feed reads/);
  assert.match(doc, /no video list imports/);
  assert.match(doc, /no automatic moment creation/);
  assert.match(doc, /no Scout\/live\/provider work/);
  assert.match(doc, /no DB\/API schema changes/);
  assert.match(doc, /no Browse\/Search changes/);
  assert.match(doc, /no #1661 work/);
});

test('confirmation copy keeps channel recording intentional', () => {
  assert.match(doc, /이 채널을 순간의 출처로 기록할까요\?/);
  assert.match(doc, /\[채널 기록하기\] \[취소\]/);
  assert.match(doc, /If the user cancels, no source record or moment should be created/);
});
