$env:NETLIFY_DATABASE_URL = "postgresql://neondb_owner:REDACTED@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:DATABASE_URL = "postgresql://neondb_owner:REDACTED@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
Set-Location G:\다른_컴퓨터\내_컴퓨터\LoveBud
node scripts\verify-db.js