if (!process.env.NETLIFY_DATABASE_URL && !process.env.DATABASE_URL) {
  console.error('❌ NETLIFY_DATABASE_URL 또는 DATABASE_URL 환경변수가 필요합니다.');
  console.error('예: NETLIFY_DATABASE_URL="postgresql://..." node scripts/run_seed.js');
  process.exit(1);
}

if (!process.env.NETLIFY_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.NETLIFY_DATABASE_URL = process.env.DATABASE_URL;
}

process.env.DRY_RUN = 'true';
process.env.SEED_STAGE = 'phase1';
require('./seed-public-trees.js');
