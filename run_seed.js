process.env.NETLIFY_DATABASE_URL = 'postgresql://neondb_owner:REDACTED@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
process.env.DRY_RUN = 'true';
process.env.SEED_STAGE = 'phase1';
require('./scripts/seed-public-trees.js');