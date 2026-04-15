# Postgres Migration Skeleton

## Added backend pieces

- Postgres schema: [netlify/sql/001_initial_postgres_schema.sql](netlify/sql/001_initial_postgres_schema.sql)
- Netlify function Firestore-compat API: [netlify/functions/firestore-api.js](netlify/functions/firestore-api.js)
- Shared backend libs: [netlify/functions/_lib](netlify/functions/_lib)
- Frontend Firestore compatibility layer: [src/firebase-firestore-compat.js](src/firebase-firestore-compat.js)

## Required environment variables

- `DATABASE_URL` or `NETLIFY_DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT`
- `ADMIN_EMAILS` for fallback admin email allowlist
- Existing `GEMINI_API_KEY` or `GEMINI_API_KEYS`

## Current migration model

- Firebase Auth remains the identity provider.
- Browser code still calls `firebase.firestore()`, but the calls are now routed to Netlify Functions.
- Postgres stores canonical documents in JSONB plus indexed scalar columns for the active query paths.
- `tree-admin.js` and `tree-ai.js` use the shared repository/document-store layer instead of Firestore Admin reads.

## Known limitations

- `runTransaction` is intentionally minimal. Reads inside the client callback are not part of the same database snapshot yet.
- Security is collection-level and ownership-based, not a full Firestore rules clone.
- Query support only covers the operators and sort patterns currently used in this app.
- Existing admin/date formatting expected Firestore `Timestamp`; the compat layer wraps common timestamp fields, but custom date-shaped fields may still need follow-up.
