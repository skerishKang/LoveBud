$env:NETLIFY_DATABASE_URL = "postgresql://neondb_owner:REDACTED@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:DATABASE_URL = "postgresql://neondb_owner:REDACTED@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:SEED_STAGE = "phase2"
node "G:\다른 컴퓨터\내 컴퓨터\LoveBud\scripts\seed-public-trees.js"