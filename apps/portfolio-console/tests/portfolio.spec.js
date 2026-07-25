import { test, expect } from '@playwright/test';

const DEFINED_PROJECTS = [
  { id: 'lovebud', name: 'LoveBud', tasks: 6 },
  { id: 'living-fiction', name: 'Living Fiction', tasks: 1 },
  { id: 'living-travel', name: 'Living Travel', tasks: 3 },
  { id: 'ai-finder', name: 'AI Finder', tasks: 2 },
  { id: 'personal-edition', name: 'Personal Edition', tasks: 4 },
  { id: 'korean-ai-platform', name: 'Korean AI Platform', tasks: 2 },
  { id: 'personal-video-archive', name: 'Personal Video Archive', tasks: 2 },
  { id: 'ai-revenue-lab', name: 'AI Revenue Lab', tasks: 2 },
  { id: 'lovetree3', name: 'LoveTree 3.0', tasks: 2 }
];

const UNDEFINED_PROJECTS = [
  { id: 'lovebud-gallery', name: 'LoveBud Gallery' },
  { id: 'love-match-making', name: '401 Love Match Making' },
  { id: 'music-composer', name: '238 Music Composer' },
  { id: 'cwtree', name: 'CWTree' }
];

test.describe('Page Load', () => {
  test('loads without page errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Portfolio Console');
    expect(errors).toEqual([]);
  });

  test('loads without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    expect(errors).toEqual([]);
  });

  test('shows correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Portfolio Console');
  });

  test('has no failed local requests', async ({ page }) => {
    const failed = [];
    page.on('requestfailed', r => failed.push(r.url()));
    await page.goto('/');
    expect(failed).toEqual([]);
  });

  test('shows correct project summary counts', async ({ page }) => {
    await page.goto('/');
    const text = await page.locator('p').first().innerText();
    expect(text).toContain('13');
    expect(text).toContain('9');
    expect(text).toContain('4');
  });
});

test.describe('Table', () => {
  test('renders table header', async ({ page }) => {
    await page.goto('/');
    const headers = page.locator('table th');
    const texts = await headers.allInnerTexts();
    expect(texts).toEqual(['#', 'Project', 'Progress', 'Tasks', 'Done', 'Mode', 'Milestone']);
  });

  test('renders 13 project rows plus header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr')).toHaveCount(14);
  });

  test('table row for LoveBud exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(1)).toContainText('LoveBud');
  });

  test('table row for LoveBud shows 6 tasks', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(1)).toContainText('6');
  });

  test('table row for LoveBud Gallery exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(10)).toContainText('LoveBud Gallery');
  });

  test('table row for CWTree exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(13)).toContainText('CWTree');
  });

  test('table shows active-development for LoveBud', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(1)).toContainText('active-development');
  });

  test('table shows draft-pr for Personal Edition', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(5)).toContainText('draft-pr');
  });

  test('table shows milestone for AI Finder', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(4)).toContainText('#1150');
  });

  test('table projects first is LoveBud', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table td:nth-child(2)').first()).toHaveText('LoveBud');
  });

  test('table projects last is CWTree', async ({ page }) => {
    await page.goto('/');
    const cells = await page.locator('table td:nth-child(2)').allInnerTexts();
    expect(cells[cells.length - 1]).toBe('CWTree');
  });
});

test.describe('Defined Project Cards', () => {
  for (const p of DEFINED_PROJECTS) {
    test(`card for ${p.name} renders`, async ({ page }) => {
      await page.goto('/');
      const card = page.locator(`.project-card[data-project-id="${p.id}"]`);
      await expect(card).toBeVisible();
    });

    test(`card for ${p.name} shows ${p.tasks} tasks`, async ({ page }) => {
      await page.goto('/');
      const card = page.locator(`.project-card[data-project-id="${p.id}"]`);
      const tasks = card.locator('.task-list li');
      await expect(tasks).toHaveCount(p.tasks);
    });
  }

  test('LoveBud has 6 specific task IDs', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    const texts = await card.locator('.task-list li').allInnerTexts();
    const ids = texts.map(t => t.split(' — ')[0].replace(/[✅❌]\s*/, '').trim());
    expect(ids).toEqual(['lb-auth-audit', 'lb-migration-ledger', 'lb-provenance-gate', 'lb-auth-css-cache', 'lb-tree-owner-binding', 'lb-scout-target-tree']);
  });

  test('Personal Edition has 4 specific task IDs', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-edition"]');
    const texts = await card.locator('.task-list li').allInnerTexts();
    const ids = texts.map(t => t.split(' — ')[0].replace(/[✅❌]\s*/, '').trim());
    expect(ids).toEqual(['pe-implementation', 'pe-ctoreview', 'pe-merge', 'pe-production']);
  });
});

test.describe('Undefined Project Cards', () => {
  for (const p of UNDEFINED_PROJECTS) {
    test(`card for ${p.name} renders`, async ({ page }) => {
      await page.goto('/');
      const card = page.locator(`.project-card[data-project-id="${p.id}"]`);
      await expect(card).toBeVisible();
    });
  }

  test('undefined section shows 4 cards', async ({ page }) => {
    await page.goto('/');
    const undSection = page.locator('#undefined-section');
    await expect(undSection.locator('h2')).toHaveText('Undefined Projects');
    await expect(undSection.locator('.project-card')).toHaveCount(4);
  });
});

test.describe('Evidence Integrity', () => {
  test('Living Fiction does not reference Issue #139', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).not.toContainText('#139');
  });

  test('Living Fiction references Issue #140', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText('Issue #140');
  });

  test('LoveBud references completed #3451', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card).toContainText('#3451');
  });

  test('LoveBud references completed #3481', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card).toContainText('#3481');
  });

  test('LoveBud references #3425 as OPEN', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card).toContainText('#3425');
    await expect(card).toContainText('OPEN');
  });

  test('LoveBud references #3458 as OPEN', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card).toContainText('#3458');
    await expect(card).toContainText('OPEN');
  });

  test('LoveBud references PR #3531 commit', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card).toContainText('PR #3531');
    await expect(card).toContainText('e0ff1b2');
  });

  test('Personal Edition shows PR #111', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-edition"]');
    await expect(card).toContainText('PR #111');
  });

  test('Personal Edition shows head commit', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-edition"]');
    await expect(card).toContainText('3f44ac7');
  });

  test('AI Finder shows #1150', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="ai-finder"]');
    await expect(card).toContainText('#1150');
  });

  test('AI Finder shows #1080', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="ai-finder"]');
    await expect(card).toContainText('#1080');
  });

  test('AI Finder shows #1181 as deferred', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="ai-finder"]');
    await expect(card).toContainText('deferred');
  });

  test('Living Travel shows issue 107 comment', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="living-travel"]');
    await expect(card).toContainText('5071926646');
  });

  test('Living Travel shows pending status', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="living-travel"]');
    await expect(card).toContainText('pending');
  });

  test('Korean AI Platform shows #138', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="korean-ai-platform"]');
    await expect(card).toContainText('#138');
  });
});

test.describe('Task Status', () => {
  test('LoveBud lb-auth-css-cache is done', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card.locator('.done').first()).toContainText('lb-auth-css-cache');
  });

  test('LoveBud lb-tree-owner-binding is done', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card.locator('.done').nth(1)).toContainText('lb-tree-owner-binding');
  });

  test('LoveBud lb-scout-target-tree is done', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card.locator('.done').nth(2)).toContainText('lb-scout-target-tree');
  });

  test('Living Fiction lf-deployment-reverification is done', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="living-fiction"]');
    await expect(card.locator('.done').first()).toContainText('lf-deployment-reverification');
  });

  test('Living Travel lt-local-provider-spike is done', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="living-travel"]');
    await expect(card.locator('.done').first()).toContainText('lt-local-provider-spike');
  });

  test('Personal Edition pe-implementation is done', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-edition"]');
    await expect(card.locator('.done').first()).toContainText('pe-implementation');
  });

  test('Personal Video Archive pva-storage-setup is done', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-video-archive"]');
    await expect(card.locator('.done').first()).toContainText('pva-storage-setup');
  });

  test('LoveBud lb-auth-audit is pending', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card.locator('.pending').first()).toContainText('lb-auth-audit');
  });

  test('LoveBud lb-migration-ledger is pending', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card.locator('.pending').nth(1)).toContainText('lb-migration-ledger');
  });

  test('Personal Edition pe-ctoreview is pending', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-edition"]');
    await expect(card.locator('.pending').first()).toContainText('pe-ctoreview');
  });

  test('Personal Edition pe-merge is pending', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-edition"]');
    await expect(card.locator('.pending').nth(1)).toContainText('pe-merge');
  });

  test('Personal Edition pe-production is pending', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-edition"]');
    await expect(card.locator('.pending').nth(2)).toContainText('pe-production');
  });
});

test.describe('Progress Bars', () => {
  test('LoveBud shows 50% progress', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(1)).toContainText('50%');
  });

  test('Living Fiction shows 100% progress', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(2)).toContainText('100%');
  });

  test('Personal Edition shows 25% progress', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('table tr').nth(5)).toContainText('25%');
  });

  test('all 13 rows have progress bars', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.progress-fill')).toHaveCount(13);
  });

  test('LoveBud progress bar width is 50%', async ({ page }) => {
    await page.goto('/');
    const fill = page.locator('table tr').nth(1).locator('.progress-fill');
    await expect(fill).toHaveAttribute('style', /width:50%/);
  });
});

test.describe('CSS Classes', () => {
  test('has progress-bar class', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.progress-bar').first()).toBeVisible();
  });

  test('has progress-fill class', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.progress-fill').first()).toBeVisible();
  });

  test('has section class', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.section').first()).toBeVisible();
  });

  test('has project-card class', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card').first()).toBeVisible();
  });

  test('has task-list class', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.task-list').first()).toBeVisible();
  });

  test('has meta class', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.meta').first()).toBeVisible();
  });

  test('has done class', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.done').first()).toBeVisible();
  });

  test('has pending class', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pending').first()).toBeVisible();
  });
});

test.describe('Layout', () => {
  test('no horizontal overflow at desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('no horizontal overflow at tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('no horizontal overflow at mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test('has DOCTYPE declaration', async ({ page }) => {
    await page.goto('/');
    const html = await page.evaluate(() => new XMLSerializer().serializeToString(document));
    expect(html).toContain('<html');
  });

  test('has viewport meta tag', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.evaluate(() => {
      const m = document.querySelector('meta[name="viewport"]');
      return m ? m.getAttribute('content') : null;
    });
    expect(viewport).toContain('width=device-width');
  });
});

test.describe('Content Integrity', () => {
  test('page mentions task-based progress', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.footer')).toContainText(/task.?based/i);
  });

  test('page mentions verifiable evidence', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.footer')).toContainText('verifiable evidence');
  });

  test('page mentions OPEN issues', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card).toContainText('OPEN');
  });

  test('LoveBud has description', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card).toContainText('social platform');
  });

  test('AI Finder has description', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="ai-finder"]');
    await expect(card).toContainText('Municipal');
  });

  test('Living Fiction has description', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="living-fiction"]');
    await expect(card).toContainText('fiction');
  });

  test('Living Travel has description', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="living-travel"]');
    await expect(card).toContainText('travel');
  });

  test('Personal Edition has description', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-edition"]');
    await expect(card).toContainText('productivity');
  });

  test('LoveBud shows development mode', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    await expect(card).toContainText('active-development');
  });

  test('LoveTree 3.0 shows planning mode', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovetree3"]');
    await expect(card).toContainText('planning');
  });

  test('undefined projects show unknown mode', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud-gallery"]');
    await expect(card).toContainText('unknown');
  });

  test('footer shows progress calculation info', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.footer')).toContainText('completed tasks');
  });
});

test.describe('Negative Tests', () => {
  test('no issue #139 reference exists', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('#139');
  });

  test('no progressPercent in rendered output', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('progressPercent');
  });

  test('LoveBud lb-auth-audit is in pending list', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="lovebud"]');
    const items = await card.locator('.pending').allInnerTexts();
    expect(items.some(t => t.includes('lb-auth-audit'))).toBe(true);
  });

  test('Personal Edition pe-ctoreview is in pending list', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-card[data-project-id="personal-edition"]');
    const items = await card.locator('.pending').allInnerTexts();
    expect(items.some(t => t.includes('pe-ctoreview'))).toBe(true);
  });
});

test.describe('Cross-Reference Integrity', () => {
  test('defined section has 9 cards', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#defined-section .project-card');
    await expect(cards).toHaveCount(9);
  });

  test('undefined section has 4 cards', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#undefined-section .project-card');
    await expect(cards).toHaveCount(4);
  });

  test('total cards equals 13', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card')).toHaveCount(13);
  });

  test('evidence text rendering across all cards', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    const lines = body.split('\n').filter(l => l.includes('—'));
    expect(lines.length).toBeGreaterThan(20);
  });
});

test.describe('Mode Display', () => {
  test('LoveBud mode active-development', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card[data-project-id="lovebud"]')).toContainText('active-development');
  });

  test('Living Fiction mode maintenance', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card[data-project-id="living-fiction"]')).toContainText('maintenance');
  });

  test('AI Finder mode active-development', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card[data-project-id="ai-finder"]')).toContainText('active-development');
  });

  test('Personal Edition mode draft-pr', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card[data-project-id="personal-edition"]')).toContainText('draft-pr');
  });

  test('LoveTree 3.0 mode planning', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card[data-project-id="lovetree3"]')).toContainText('planning');
  });

  test('LoveBud Gallery mode unknown', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card[data-project-id="lovebud-gallery"]')).toContainText('unknown');
  });

  test('Personal Video Archive mode active-development', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card[data-project-id="personal-video-archive"]')).toContainText('active-development');
  });

  test('AI Revenue Lab mode active-development', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card[data-project-id="ai-revenue-lab"]')).toContainText('active-development');
  });

  test('CWTree mode unknown', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.project-card[data-project-id="cwtree"]')).toContainText('unknown');
  });
});
