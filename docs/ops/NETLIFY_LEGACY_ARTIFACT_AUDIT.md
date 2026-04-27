# Netlify Legacy Artifact Audit

## 1. Current active runtime

LoveBud의 현재 official user-facing runtime은 Cloudflare Pages입니다.

현재 active API path는 아래 기준으로 판단합니다.

```text
Browser
→ same-origin /api/*
→ Cloudflare Pages Functions
→ Modal
→ Neon PostgreSQL
```

Netlify는 active production fallback이 아닙니다.
`netlify.toml`과 `netlify/functions/**`는 legacy artifact이며, tests/docs transition 이후 removal candidate로만 취급합니다.

## 2. Netlify files found

현재 저장소에는 아래 Netlify legacy artifact가 남아 있습니다.

```text
netlify.toml
netlify/functions/**
```

대표 파일군:

```text
netlify/functions/trees.js
netlify/functions/tree-detail.js
netlify/functions/memories.js
netlify/functions/memory-detail.js
netlify/functions/community-trees.js
netlify/functions/community-memories.js
netlify/functions/_lib/**
```

Netlify-targeting tests도 남아 있습니다.

```text
tests/functions/**
tests/contracts/** where they import or assert netlify/functions behavior
```

## 3. Why they remain

Netlify files remain for three reasons.

1. Some tests still import or assert legacy `netlify/functions/**` behavior.
2. Some docs still describe historical route behavior and need transition context.
3. Removal must not happen before Cloudflare/Modal route parity and CI independence are confirmed.

Their presence does not mean Netlify is the active production runtime.

## 4. Why Netlify must not receive new backend policy work

New backend feature or policy work must target the active runtime only.

Allowed active implementation targets:

```text
functions/api/**
modal_compute/**
```

Netlify is not a valid target for new backend policy work unless CTO explicitly reactivates Netlify runtime.

Do not add new behavior to `netlify/functions/**` for:

- public-first tree creation
- Plus private entitlement
- private/public visibility policy
- browse eligibility policy
- auth/session policy
- private update/delete route parity
- new API response contracts

## 5. Removal prerequisites

Netlify artifact removal requires all of the following to be true.

- Cloudflare/Modal route parity confirmed.
- Netlify-targeting tests migrated or deleted.
- CI no longer imports `netlify/functions/**`.
- Production/test slot route matrix confirms Cloudflare → Modal for active API paths.
- No active Netlify deploy target remains in use.
- Docs no longer rely on Netlify as an active fallback or active runtime explanation.

## 6. Explicit non-removal decision for this PR

This docs/ops update does not remove Netlify files.

Explicitly not changed:

```text
netlify.toml
netlify/functions/**
tests/**
functions/**
modal_compute/**
```

This PR only marks Netlify as:

```text
Netlify legacy artifact
not active production fallback
removal candidate after tests/docs transition
```

## 7. Executor rule

When a future task touches backend behavior, the executor must first decide whether the change belongs to the active Cloudflare/Modal runtime.

If a proposed implementation targets `netlify/functions/**`, reject or pause it unless the CTO has explicitly reactivated Netlify runtime.
