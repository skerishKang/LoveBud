'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FOUNDATION_DOC_PATH = path.join(
  PROJECT_ROOT,
  'docs/product/lovebud-memory-wiki-ontology-atlas-foundation.md'
);

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function assertIncludesAll(source, values, context) {
  for (const value of values) {
    assert.ok(
      source.includes(value),
      `${context} should include "${value}"`
    );
  }
}

function assertIncludesAllCaseInsensitive(source, values, context) {
  const lowered = source.toLowerCase();
  for (const value of values) {
    assert.ok(
      lowered.includes(value.toLowerCase()),
      `${context} should include "${value}"`
    );
  }
}

describe('LoveBud Memory Wiki and Ontology Atlas Foundation Contract', () => {
  it('has the foundation document and issue anchors', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assert.ok(doc.length > 0, 'foundation document should exist and be non-empty');
    assert.ok(
      doc.includes('# LoveBud Memory Wiki and Ontology Atlas Foundation'),
      'foundation document should have the expected title'
    );
    assertIncludesAll(doc, ['#2489', '#2418', '#1882'], 'foundation document');
    assert.ok(
      doc.includes('LoveBud is where memories become knowledge'),
      'foundation document should include the product positioning line'
    );
  });

  it('keeps external knowledge as optional future enrichment, not the primary foundation', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAllCaseInsensitive(doc, [
      'LoveBud-owned memory evidence',
      'not external web knowledge',
      'External knowledge can become optional future enrichment',
      'not the primary foundation',
    ], 'product direction');
  });

  it('separates authored memory, source, AI-derived, wiki, and ontology concepts', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAllCaseInsensitive(doc, [
      'user-authored memories',
      'LoveBud source records',
      'AI-derived labels',
      'AI-derived relationships',
      'internal wiki pages',
      'ontology/graph nodes',
      'ontology/graph edges',
      'User-authored memory content is the source of truth',
    ], 'concept separation');
  });

  it('defines the initial node vocabulary', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAll(doc, [
      '`memory`',
      '`tree`',
      '`pack`',
      '`video`',
      '`source`',
      '`topic`',
      '`person`',
      '`place`',
      '`event`',
      '`emotion`',
      '`time`',
    ], 'node vocabulary');
  });

  it('defines the initial edge vocabulary', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAll(doc, [
      '`about`',
      '`mentions`',
      '`felt_as`',
      '`happened_at`',
      '`happened_in`',
      '`belongs_to`',
      '`source_of`',
      '`related_to`',
      '`same_topic_as`',
      '`same_source_as`',
      '`follows_from`',
      '`contrasts_with`',
    ], 'edge vocabulary');
  });

  it('requires stable evidence references for derived claims and relationships', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAllCaseInsensitive(doc, [
      'Every derived wiki claim or ontology/graph relationship must be able to point back to LoveBud evidence',
      'memory id',
      'source type',
      'source URL',
      'user-entered title',
      'user-entered note',
      'video metadata',
      'channel/profile metadata',
      'created_at',
      'updated_at',
      'visibility scope',
      'confidence',
      'review status',
    ], 'evidence model');
  });

  it('defines the first internal wiki page types', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAllCaseInsensitive(doc, [
      'topic page',
      'person/source page',
      'event page',
      'emotion page',
      'time-period page',
      'tree/pack page',
      'Which memories support this page, and how are they connected?',
    ], 'internal wiki model');
  });

  it('locks evidence-first AI and Scout behavior', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAllCaseInsensitive(doc, [
      'evidence-first answers from LoveBud memory evidence',
      'non-persistent by default AI-derived labels and relationships',
      'review-before-save',
      'no hidden graph edges',
      'distinguish user-authored memory text from model-derived interpretation',
      'explicit user confirmation',
      'clear uncertainty',
    ], 'AI/Scout behavior contract');
  });

  it('locks privacy and visibility guardrails', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAllCaseInsensitive(doc, [
      'Privacy is part of the foundation',
      'public/private visibility',
      'Do not change public/private visibility',
      'Do not expose private memories',
      'strictest visibility',
      'must not reveal evidence from memories the viewer cannot access',
      'Public Browse/Search behavior is out of scope',
    ], 'privacy guardrails');
  });

  it('keeps the first slice docs/contracts only and forbids implementation scope creep', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAll(doc, [
      'No DB migration.',
      'No production schema change.',
      'No large graph visualization UI.',
      'No editor canvas behavior change.',
      'No Browse/Search sort or social-count work.',
      'No external web crawling or scraping.',
      'No YouTube API calls.',
      'No channel feed import.',
      'No video transcript extraction implementation.',
      'No MCP runtime work.',
      'No live provider/network integration.',
      'No automatic relationship persistence.',
      'No automatic wiki page publication.',
      'No public/private visibility change.',
    ], 'non-goals');
  });

  it('does not close adjacent graph or Scout issues from this foundation', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAll(doc, [
      'Do not close #2418 from this issue.',
      'Do not close #1882 from this issue.',
    ], 'adjacent issue guardrails');
  });

  it('outlines safe later slices without requiring them now', () => {
    const doc = readFileSafe(FOUNDATION_DOC_PATH);

    assertIncludesAllCaseInsensitive(doc, [
      'read-only memory-to-node/edge projection helper',
      'non-persistent Atlas preview',
      'review-before-save relationship suggestions',
      'internal wiki pages generated from saved LoveBud memories',
      'Connect Scout answers to internal evidence references',
    ], 'later slices');
  });
});
