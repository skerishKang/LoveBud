# Supabase Free PoC Plan

> Status: Draft / planning only  
> Owner: Feature Lead / Architecture Lead  
> Decision: Modal 유지 + Supabase Free PoC 권장  
> Purpose: 비용 절감이 아니라 장기 backend 구조 단순화 가능성 검증  
> Date: 2026-04-25

---

## 0. Executive Summary

LoveBud의 현재 production backend는 Cloudflare Pages frontend와 Cloudflare Functions `/api/*` proxy를 거쳐 Modal backend로 연결되는 구조를 유지한다.

이번 PoC는 Supabase를 production에 연결하거나 Modal을 제거하기 위한 작업이 아니다. 목적은 LoveBud의 핵심 backend 요구사항인 DB/Auth/API/RLS 중심 기능이 장기적으로 Supabase에 적합한지 검증하는 것이다.

### Final CTO Decision

- Modal은 유지한다.
- Firebase Auth는 당분간 유지한다.
- Supabase production 전환은 승인하지 않는다.
- Supabase Free PoC는 승인한다.
- PoC는 운영 데이터와 완전히 분리한다.
- Supabase Pro 전환 여부는 PoC 결과와 비용 실측 후 판단한다.
- Cloudflare Functions proxy 유지안을 우선 검토한다.

### Current Recommendation

**Modal 유지 + Supabase Free PoC 권장**

Supabase는 비용 절감 수단이 아니라 장기 구조 단순화 후보로 검토한다. 현재 Modal 사용량이 약 `$1/day` 수준이고 Modal Starter의 월 `$30` free compute credit 안에서 감당 가능한 상태이므로 즉시 교체 필요성은 낮다.

---

## 1. Scope and Non-Scope

## 1.1 Scope

이번 PoC 설계 범위는 다음으로 제한한다.

1. 테스트 전용 Supabase project 기준 schema 초안
2. `profiles`, `love_trees`, `memories` 기본 schema SQL 초안
3. RLS policy SQL 초안
4. owner-only CRUD 검증 시나리오
5. public summary read 검증 시나리오
6. anon private 접근 차단 검증 시나리오
7. private/public leak test 항목
8. 예상 DB size 산정
9. Free plan 한도 초과 임계점
10. Modal 유지안과 비교
11. Firebase Auth 유지안 vs Supabase Auth 전환안 비교
12. Cloudflare Functions proxy 유지안 검토
13. production 전환 여부 판단 기준

## 1.2 Non-Scope

다음은 이번 PoC 설계 문서의 범위가 아니다.

- production 연결
- 운영 데이터 migration
- 운영 DB export/import
- Firebase Auth 제거
- Modal API 제거
- Cloudflare → Modal route repair 작업 변경
- Supabase project 실제 생성
- Supabase 환경변수, service role key, token 기록
- 결제/Plus/권한 상품화 구현
- 이미지 업로드 Storage 구현
- main 직접 수정 또는 merge

---

## 2. Current Architecture to Preserve

현재 구조는 PoC 기간 동안 유지한다.

```text
Browser
  ↓ same-origin /api/*
Cloudflare Pages
  ↓
Cloudflare Functions /api/* proxy
  ↓
Modal backend
  ↓
Current database / existing backend resources
```

PoC에서 우선 검토할 장기 구조는 다음이다.

```text
Browser
  ↓ same-origin /api/*
Cloudflare Pages
  ↓
Cloudflare Functions /api/* proxy
  ↓
Supabase test project only
```

장기적으로 일부 public browse read model이 Supabase로 안정화되더라도 Modal은 AI compute, Python batch, heavy background job, long-running task 용도로 유지할 수 있다.

---

## 3. API Classification for Supabase Fit

## 3.1 Suitable for Supabase Direct/RLS CRUD

| Current API | Supabase fit | Notes |
|---|---|---|
| `GET /api/trees` | High | owner tree list. RLS로 단순 처리 가능 |
| `POST /api/trees` | High | owner insert. default private 강제 필요 |
| `GET /api/trees/:id` | High | owner/private/public 조건 분기 |
| `PUT /api/trees/:id` | High | owner-only update |
| `PATCH /api/trees/:id` | High | owner-only partial update |
| `DELETE /api/trees/:id` | High | soft delete 권장 |
| `GET /api/memories` | High | tree owner 기준 list |
| `POST /api/memories` | High | target tree owner 검증 필요 |
| `GET /api/memories/:id` | High | public memory 또는 owner-only |
| `PUT /api/memories/:id` | High | owner-only update |
| `PATCH /api/memories/:id` | High | owner-only partial update |
| `DELETE /api/memories/:id` | High | soft delete 권장 |

## 3.2 Better as Supabase View / RPC / Edge Function

| Current API | Supabase fit | Notes |
|---|---|---|
| `GET /api/community/trees?view=summary` | Medium-High | summary aggregation, representative thumbnail, memory count 필요 |
| `GET /api/community/growing-trees` | Medium-High | public memory count 1~2개 조건과 stage override 필요 |
| `GET /api/community/memories` | High | 단순 public memory read 가능. 다만 response contract 유지 필요 |

## 3.3 Keep on Modal

| Function | Reason |
|---|---|
| AI compute | Supabase보다 Modal 적합 |
| Python batch | Modal 적합 |
| video/audio/LLM processing | Modal 적합 |
| heavy background job | Modal 적합 |
| long-running job | Supabase Edge Function보다 Modal 적합 |
| experimental ranking/recommendation batch | 계산은 Modal, 결과 저장은 Supabase 가능 |

---

## 4. Supabase Schema SQL Draft

> This SQL is a planning draft only. Do not apply to production. Do not run against an actual Supabase project without separate CTO approval.

## 4.1 Extensions

```sql
-- Draft only
create extension if not exists pgcrypto;
```

## 4.2 profiles

```sql
-- Draft only
create table public.profiles (
  id uuid primary key,
  firebase_uid text unique,
  display_name text,
  email text,
  avatar_url text,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.profiles is 'PoC user profile mapping. id is intended to map to Supabase auth.users.id if Supabase Auth is used later.';

create index profiles_firebase_uid_idx on public.profiles(firebase_uid) where firebase_uid is not null;
create index profiles_email_idx on public.profiles(email) where email is not null;
```

### Notes

- Firebase Auth 유지 PoC에서는 `firebase_uid`를 migration mapping 후보로만 둔다.
- Supabase Auth 전환을 확정하지 않는다.
- 운영 사용자 migration은 금지한다.

## 4.3 love_trees

```sql
-- Draft only
create table public.love_trees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  legacy_owner_id text,
  title text not null default '나의 LoveTree',
  description text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  publication_status text not null default 'draft' check (publication_status in ('draft', 'eligible', 'published', 'hidden', 'rejected')),
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint love_trees_owner_present check (owner_id is not null or legacy_owner_id is not null)
);

create index love_trees_owner_updated_idx on public.love_trees(owner_id, updated_at desc) where deleted_at is null;
create index love_trees_legacy_owner_updated_idx on public.love_trees(legacy_owner_id, updated_at desc) where deleted_at is null;
create index love_trees_public_updated_idx on public.love_trees(visibility, publication_status, updated_at desc) where deleted_at is null;
```

### Notes

- `visibility`는 raw access 권한에 사용한다.
- `publication_status`는 browse 소개 상태를 분리하기 위한 후보이다.
- 생성 시 기본값은 `private`이다.
- delete는 hard delete보다 `deleted_at` 기반 soft delete를 우선한다.

## 4.4 memories

```sql
-- Draft only
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.love_trees(id) on delete cascade,
  owner_id uuid,
  legacy_owner_id text,
  parent_id uuid references public.memories(id) on delete set null,
  title text not null default '',
  memo text not null default '',
  artist text not null default '',
  source text not null default '',
  source_url text not null default '',
  source_type text not null default 'youtube',
  thumbnail text not null default '',
  emotion_tags jsonb not null default '[]'::jsonb,
  timestamp text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint memories_owner_present check (owner_id is not null or legacy_owner_id is not null)
);

create index memories_tree_created_idx on public.memories(tree_id, created_at desc) where deleted_at is null;
create index memories_tree_visibility_created_idx on public.memories(tree_id, visibility, created_at desc) where deleted_at is null;
create index memories_owner_created_idx on public.memories(owner_id, created_at desc) where deleted_at is null;
create index memories_legacy_owner_created_idx on public.memories(legacy_owner_id, created_at desc) where deleted_at is null;
create index memories_emotion_tags_gin_idx on public.memories using gin (emotion_tags);
```

### Notes

- `owner_id` 또는 `legacy_owner_id`를 denormalized로 둔다.
- tree join 없이 owner-only filtering 가능하게 하여 RLS와 query 성능을 단순화한다.
- `emotion_tags`는 jsonb로 시작하되, tag search가 중요해지면 별도 join table 검토 가능하다.

## 4.5 public_tree_summaries View Draft

```sql
-- Draft only
create or replace view public.public_tree_summaries
with (security_invoker = true)
as
select
  t.id,
  t.title,
  t.visibility,
  t.created_at,
  t.updated_at,
  coalesce(rep.thumbnail, rep.source_url, '') as representative_thumbnail,
  count(m.id)::int as memory_count,
  coalesce(jsonb_agg(distinct tag.value) filter (where tag.value is not null), '[]'::jsonb) as emotion_tags,
  case
    when count(m.id) <= 0 then 'empty'
    when count(m.id) <= 2 then '입덕'
    when count(m.id) <= 4 then '성장'
    else '최애'
  end as stage,
  'LoveTree'::text as theme,
  ''::text as time_range
from public.love_trees t
join public.memories m
  on m.tree_id = t.id
 and m.visibility = 'public'
 and m.deleted_at is null
left join lateral (
  select mm.thumbnail, mm.source_url
  from public.memories mm
  where mm.tree_id = t.id
    and mm.visibility = 'public'
    and mm.deleted_at is null
    and (nullif(mm.thumbnail, '') is not null or nullif(mm.source_url, '') is not null)
  order by mm.created_at desc
  limit 1
) rep on true
left join lateral jsonb_array_elements_text(m.emotion_tags) as tag(value) on true
where t.visibility = 'public'
  and t.publication_status in ('eligible', 'published')
  and t.deleted_at is null
group by t.id, t.title, t.visibility, t.created_at, t.updated_at, rep.thumbnail, rep.source_url
having count(m.id) >= 3;
```

### Notes

- PoC에서는 view로 시작한다.
- 성능이 부족하면 materialized view 또는 cache table로 전환한다.
- public API는 raw `love_trees` / `memories`가 아니라 summary view를 우선 사용한다.

---

## 5. RLS Policy SQL Draft

> This SQL is a planning draft only. It assumes Supabase Auth. Firebase Auth 유지 PoC에서는 Cloudflare Functions proxy가 Firebase token을 검증하고 Supabase service role 또는 test role로 제한 호출하는 별도 방식을 검토해야 한다.

## 5.1 Enable RLS

```sql
-- Draft only
alter table public.profiles enable row level security;
alter table public.love_trees enable row level security;
alter table public.memories enable row level security;
```

## 5.2 profiles policies

```sql
-- Draft only
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() is not null and id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() is not null and id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() is not null and id = auth.uid())
with check (auth.uid() is not null and id = auth.uid());
```

## 5.3 love_trees policies

```sql
-- Draft only
create policy "love_trees_select_own"
on public.love_trees
for select
to authenticated
using (
  deleted_at is null
  and auth.uid() is not null
  and owner_id = auth.uid()
);

create policy "love_trees_select_public"
on public.love_trees
for select
to anon, authenticated
using (
  deleted_at is null
  and visibility = 'public'
  and publication_status in ('eligible', 'published')
);

create policy "love_trees_insert_own_private"
on public.love_trees
for insert
to authenticated
with check (
  auth.uid() is not null
  and owner_id = auth.uid()
  and visibility = 'private'
);

create policy "love_trees_update_own"
on public.love_trees
for update
to authenticated
using (
  deleted_at is null
  and auth.uid() is not null
  and owner_id = auth.uid()
)
with check (
  auth.uid() is not null
  and owner_id = auth.uid()
);

create policy "love_trees_delete_own"
on public.love_trees
for delete
to authenticated
using (
  auth.uid() is not null
  and owner_id = auth.uid()
);
```

### Publication Guard Draft

`visibility = 'public'` 전환은 단순 RLS만으로 처리하지 않고 RPC 또는 trigger로 중앙화한다.

```sql
-- Draft only
create or replace function public.can_publish_tree(p_tree_id uuid)
returns boolean
language sql
stable
as $$
  select count(*) >= 3
  from public.memories
  where tree_id = p_tree_id
    and visibility = 'public'
    and deleted_at is null;
$$;
```

실제 public 전환은 direct update가 아니라 다음과 같은 RPC 후보로 제한한다.

```sql
-- Draft only
create or replace function public.publish_tree(p_tree_id uuid)
returns public.love_trees
language plpgsql
security definer
as $$
declare
  v_tree public.love_trees;
begin
  select * into v_tree
  from public.love_trees
  where id = p_tree_id
    and owner_id = auth.uid()
    and deleted_at is null;

  if not found then
    raise exception 'Tree not found or not owned';
  end if;

  if not public.can_publish_tree(p_tree_id) then
    raise exception 'Tree requires at least 3 public memories before publication';
  end if;

  update public.love_trees
  set visibility = 'public',
      publication_status = 'eligible',
      updated_at = now()
  where id = p_tree_id
  returning * into v_tree;

  return v_tree;
end;
$$;
```

## 5.4 memories policies

```sql
-- Draft only
create policy "memories_select_own"
on public.memories
for select
to authenticated
using (
  deleted_at is null
  and auth.uid() is not null
  and owner_id = auth.uid()
);

create policy "memories_select_public"
on public.memories
for select
to anon, authenticated
using (
  deleted_at is null
  and visibility = 'public'
  and exists (
    select 1
    from public.love_trees t
    where t.id = memories.tree_id
      and t.visibility = 'public'
      and t.publication_status in ('eligible', 'published')
      and t.deleted_at is null
  )
);

create policy "memories_insert_own_tree"
on public.memories
for insert
to authenticated
with check (
  auth.uid() is not null
  and owner_id = auth.uid()
  and exists (
    select 1
    from public.love_trees t
    where t.id = memories.tree_id
      and t.owner_id = auth.uid()
      and t.deleted_at is null
  )
);

create policy "memories_update_own"
on public.memories
for update
to authenticated
using (
  deleted_at is null
  and auth.uid() is not null
  and owner_id = auth.uid()
)
with check (
  auth.uid() is not null
  and owner_id = auth.uid()
);

create policy "memories_delete_own"
on public.memories
for delete
to authenticated
using (
  auth.uid() is not null
  and owner_id = auth.uid()
);
```

---

## 6. Test Scenarios

## 6.1 Test Users

PoC uses synthetic users only.

| User | Purpose |
|---|---|
| `user_a` | owner of private and public trees |
| `user_b` | non-owner access test |
| `anon` | public-only access test |

No production user id, token, email, or real Firebase account data may be used.

## 6.2 Seed Data

| Data | Description |
|---|---|
| `tree_a_private` | owned by user_a, private |
| `tree_a_public_ready` | owned by user_a, public/published with 3 public memories |
| `tree_a_growing` | owned by user_a, public with 1-2 public memories |
| `tree_b_private` | owned by user_b, private |
| `memory_private_a1` | private memory under user_a tree |
| `memory_public_a1..a3` | public memories under public tree |
| `memory_private_b1` | private memory under user_b tree |

## 6.3 Owner-only CRUD

| Case | Actor | Expected |
|---|---|---|
| user_a selects own private tree | user_a | allowed |
| user_a creates private tree | user_a | allowed, visibility private |
| user_a updates own tree title | user_a | allowed |
| user_a deletes own tree | user_a | allowed or soft delete allowed |
| user_b selects user_a private tree | user_b | blocked |
| anon selects private tree | anon | blocked |
| user_a creates memory in own tree | user_a | allowed |
| user_b creates memory in user_a tree | user_b | blocked |
| anon creates memory | anon | blocked |

## 6.4 Public Summary Read

| Case | Actor | Expected |
|---|---|---|
| anon selects `public_tree_summaries` | anon | only public summary fields |
| anon sees tree with 3+ public memories | anon | allowed |
| anon sees private tree | anon | blocked/not returned |
| anon sees private memory text | anon | blocked/not returned |
| user_b sees user_a public summary | user_b | allowed |
| user_b sees user_a raw private data | user_b | blocked |

## 6.5 Publication Guard

| Case | Expected |
|---|---|
| create tree as public | blocked |
| publish tree with 0 public memories | blocked |
| publish tree with 1 public memory | blocked |
| publish tree with 2 public memories | blocked |
| publish tree with 3 public memories | allowed |
| private memory count included in public count | no |

---

## 7. Private/Public Leak Test Checklist

## 7.1 SQL-level Leak Tests

- [ ] anon cannot select private `love_trees` rows.
- [ ] anon cannot select private `memories` rows.
- [ ] authenticated user cannot select another user’s private trees.
- [ ] authenticated user cannot select another user’s private memories.
- [ ] public summary view does not expose `owner_id` unless intentionally allowed.
- [ ] public summary view does not expose raw `memo` body.
- [ ] public summary view does not expose private memory count.
- [ ] public summary view does not include trees with fewer than 3 public memories, except growing-specific view.
- [ ] deleted rows are not returned.
- [ ] direct table access and view access produce consistent privacy outcomes.

## 7.2 API-level Leak Tests

- [ ] `GET /api/trees` as anon returns 401/empty according to final contract.
- [ ] `GET /api/trees/:id` private as anon returns 403/404.
- [ ] `GET /api/memories/:id` private as anon returns 403/404.
- [ ] `GET /api/community/trees?view=summary` returns summary only.
- [ ] `GET /api/community/memories?treeId=<privateTree>` as anon returns empty/blocked.
- [ ] Authorization header from user_b cannot access user_a private data.
- [ ] cache does not store private response under public key.

## 7.3 Browser-level Leak Tests

- [ ] DevTools Network shows no private payload in public browse.
- [ ] LocalStorage does not retain another user’s tree data.
- [ ] logout/login user switch does not show previous user cache.
- [ ] public route without auth does not hydrate private memories.

---

## 8. Firebase Auth 유지안 vs Supabase Auth 전환안

## 8.1 Firebase Auth 유지안

```text
Browser Firebase Auth
  ↓ Firebase ID token
Cloudflare Functions /api/* proxy
  ↓ verifies Firebase token or forwards safely
Supabase PoC / Modal
```

### Pros

- 기존 사용자 계정 체계를 유지한다.
- migration 위험이 낮다.
- 현재 frontend auth 구조 변경량이 작다.
- Modal과 병행 운영하기 쉽다.

### Cons

- Supabase RLS의 `auth.uid()`를 직접 사용하기 어렵다.
- Cloudflare Functions에서 token verification 또는 service role mediation이 필요하다.
- RLS PoC와 production auth 구조가 다를 수 있다.

## 8.2 Supabase Auth 전환안

```text
Browser Supabase Auth
  ↓ Supabase JWT
Supabase RLS
```

### Pros

- RLS 정책이 가장 단순하다.
- `auth.uid()` 기반 owner relation이 명확하다.
- Auth/DB/Storage가 하나의 플랫폼으로 통합된다.

### Cons

- 기존 Firebase UID와 Supabase UID 불일치 위험이 크다.
- 기존 계정 migration이 필요하다.
- 운영 사용자 데이터 연결 실패 위험이 있다.
- production 전환 시 로그인 장애 가능성이 있다.

## 8.3 Recommendation

PoC 단계에서는 Firebase Auth를 제거하지 않는다. Supabase Auth 전환은 별도 Auth Migration TF로 분리한다.

---

## 9. Cloudflare Functions Proxy 유지안

PoC 우선안은 Browser가 계속 same-origin `/api/*`만 호출하도록 유지하는 것이다.

```text
Browser
  ↓ /api/*
Cloudflare Functions
  ↓ route-level decision
Modal or Supabase PoC backend
```

### Pros

- frontend 변경량이 낮다.
- service role key를 browser에 노출하지 않는다.
- Modal과 Supabase를 endpoint별로 hybrid 운영할 수 있다.
- Cloudflare logs로 장애 추적이 가능하다.
- production route repair 작업과 충돌을 줄일 수 있다.

### Cons

- Cloudflare Function 코드가 routing matrix를 가져야 한다.
- RLS 직접 client 방식보다 proxy layer가 하나 더 있다.
- 잘못 설계하면 Supabase RLS 대신 service role 검증 코드에 의존하게 된다.

### Policy

PoC에서는 Cloudflare Functions proxy 유지안을 우선 검토한다. Browser direct Supabase client 방식은 RLS leak test가 충분히 통과하기 전까지 보류한다.

---

## 10. Cost and Limits Analysis

> Pricing assumptions should be rechecked before any production decision. The values below are planning assumptions based on official pricing pages checked on 2026-04-25.

## 10.1 Supabase Free/Pro Relevant Limits

| Item | Free | Pro |
|---|---:|---:|
| Monthly fee | $0 | $25/month baseline |
| Database size | 500 MB per project | 8 GB included, then usage-based disk cost |
| MAU | 50,000 | 100,000 included, then overage |
| Egress | 5 GB | 250 GB included, then overage |
| Storage | 1 GB | 100 GB included, then overage |
| Edge Function invocations | 500,000/month | 2,000,000/month included, then overage |
| Realtime messages | 2,000,000 | 5,000,000 included, then overage |

### Interpretation for LoveBud

Supabase Free의 병목은 MAU가 아니라 DB 500MB와 egress 5GB다. LoveBud는 사용자가 tree와 memory를 계속 쌓는 구조이므로 DB size가 먼저 문제가 될 가능성이 높다.

## 10.2 Cloudflare Free/Workers Paid Relevant Limits

| Item | Free | Workers Paid |
|---|---:|---:|
| Static asset requests | free/unlimited | free/unlimited |
| Workers / Pages Functions requests | 100,000/day | $5/month, 10M/month included |
| Additional requests | unavailable/limited | $0.30 per additional 1M |
| CPU time | 10ms CPU per invocation | 30M CPU ms included, then overage |
| Egress for Workers | no separate egress charge for normal Workers | no separate egress charge for normal Workers |

### Interpretation for LoveBud

Cloudflare는 static frontend와 API proxy 비용 방어에 유리하다. 초기에는 Cloudflare Free로 충분할 수 있으나, production 트래픽이 증가하면 Workers Paid `$5/month`를 운영 기준으로 잡는 것이 안전하다.

## 10.3 Modal Current Cost Assumption

| Item | Current assumption |
|---|---:|
| Current usage | about $1/day |
| Monthly gross | about $30/month |
| Starter free credit | $30/month |
| Current net pressure | low |

Modal 즉시 교체는 비용상 필요하지 않다. Modal은 Python compute, batch, AI, long-running job 후보로 유지한다.

---

## 11. Expected DB Size Estimate

## 11.1 Assumptions

| Metric | Assumption |
|---|---:|
| Average trees per user | 3 |
| Average memories per tree | 20 |
| Average tree row size | 1.5 KB |
| Average memory row size | 4 KB |
| DB/index/view overhead multiplier | 2x |
| Storage uploads | none in PoC |

Estimated DB per active data-owning user:

```text
raw = (3 trees × 1.5 KB) + (3 trees × 20 memories × 4 KB)
raw = 4.5 KB + 240 KB = 244.5 KB
overhead-adjusted ≈ 489 KB per user
```

## 11.2 Scenario Estimate

| Scenario | Users with data | Estimated DB size | Free viability |
|---|---:|---:|---|
| PoC | 100 | ~49 MB or less with lighter seed | Safe |
| Small | 1,000 | ~489 MB | Borderline |
| Growth | 10,000 | ~4.9 GB | Not Free |
| Larger | 50,000 | ~24.5 GB | Not Free |

The PoC seed should be much smaller than the full average assumptions. Free plan is adequate for PoC, but production should not depend on remaining below 500 MB.

---

## 12. Monthly API Requests and Egress Estimate

## 12.1 Assumptions

| Metric | Assumption |
|---|---:|
| API requests per MAU per month | 200 |
| Average API response size | 5 KB |
| Storage egress | excluded |
| YouTube thumbnail | external URL, not Supabase Storage |

## 12.2 Scenario Estimate

| Scenario | MAU | Monthly API requests | Estimated API egress |
|---|---:|---:|---:|
| PoC | 100 | 20,000 | ~0.1 GB |
| Small | 1,000 | 200,000 | ~1 GB |
| Growth | 10,000 | 2,000,000 | ~10 GB |
| Larger | 50,000 | 10,000,000 | ~50 GB |

### Interpretation

- Supabase Free egress can handle PoC and small testing.
- Growth-level production likely exceeds Free egress.
- Cloudflare cache/proxy can reduce Supabase egress for public browse if designed carefully.

---

## 13. Free Limit Thresholds

Supabase Free PoC should stop or require CTO review if any threshold is approached.

| Metric | Warning threshold | Hard concern |
|---|---:|---:|
| DB size | 300 MB | 500 MB |
| Egress | 3 GB/month | 5 GB/month |
| Edge Function invocations | 300,000/month | 500,000/month |
| Storage | 500 MB | 1 GB |
| Auth MAU | 10,000 | 50,000 |

Production planning should assume Supabase Pro before real user migration.

---

## 14. Modal 유지안 vs Supabase PoC

| Criterion | Modal 유지안 | Supabase Free PoC |
|---|---|---|
| Purpose | current backend continuity | architecture simplification validation |
| Cost pressure | low under current credit assumption | free for PoC |
| Production readiness | current system, after route repair | not approved |
| Auth | Firebase Auth stays | Firebase stays during PoC; Supabase Auth only compared |
| CRUD | app code + Modal/Fallback | RLS-centered candidate |
| Public browse | Modal SQL snapshot currently suitable | view/RPC/Edge candidate |
| AI/batch | strong fit | weak fit |
| Migration risk | none | moderate/high if production attempted |
| CTO decision | keep | PoC only |

---

## 15. Production Transition Decision Criteria

Supabase production transition may be considered only if all criteria below are met.

## 15.1 Security Criteria

- [ ] anon cannot access private tree or memory.
- [ ] non-owner authenticated user cannot access another user’s private data.
- [ ] public summary exposes only approved fields.
- [ ] service role key never reaches browser.
- [ ] cache keys cannot mix private and public responses.
- [ ] RLS policies are covered by repeatable tests.

## 15.2 API Contract Criteria

- [ ] Current flat camelCase response contract is preserved.
- [ ] `GET /api/trees` equivalent passes snapshot tests.
- [ ] `POST /api/trees` creates private tree only.
- [ ] `GET /api/memories?treeId=` owner-only behavior is preserved.
- [ ] `GET /api/community/trees?view=summary` matches current browse requirements.
- [ ] `GET /api/community/growing-trees` can be reproduced or explicitly remains Modal-owned.

## 15.3 Cost Criteria

- [ ] DB size measured from realistic seed.
- [ ] row and index overhead measured.
- [ ] egress measured from test API response sizes.
- [ ] Edge Function invocation count estimated.
- [ ] Supabase Pro monthly cost accepted if production transition proceeds.
- [ ] Cloudflare Workers Paid `$5/month` accepted if dynamic traffic grows.

## 15.4 Migration Criteria

- [ ] Firebase UID mapping strategy approved.
- [ ] operating data migration plan approved separately.
- [ ] rollback plan exists.
- [ ] Modal fallback plan exists.
- [ ] no production data migration occurs without CTO approval.

---

## 16. PoC Execution Checklist

## 16.1 Before Supabase Project Creation

- [ ] CTO separately approves actual Supabase project creation.
- [ ] project name and organization are confirmed.
- [ ] no production secrets are used.
- [ ] no production data is exported.
- [ ] synthetic test data plan is approved.

## 16.2 During PoC

- [ ] Apply draft schema only to test project.
- [ ] Apply RLS policies only to test project.
- [ ] Seed synthetic users and data.
- [ ] Run SQL-level leak tests.
- [ ] Run API-level leak tests through Cloudflare-like proxy where possible.
- [ ] Record approximate DB size.
- [ ] Record approximate API response size.
- [ ] Record edge invocation count if Edge Functions are used.

## 16.3 After PoC

- [ ] Produce PoC result report.
- [ ] Compare Modal 유지안 vs Supabase candidate.
- [ ] Recommend one of:
  - Modal 유지
  - Modal 유지 + Supabase extended PoC
  - Supabase production transition preparation
- [ ] Do not connect production without separate approval.

---

## 17. Required CTO Decisions After This Document

1. Whether to create a test-only Supabase Free project.
2. Whether PoC should use Supabase Auth test users or Firebase-token-mediated Cloudflare proxy first.
3. Whether Cloudflare Functions proxy should remain the required API boundary.
4. Whether Storage is excluded from PoC.
5. Whether public summary should be tested as SQL view, materialized view, or Edge Function.
6. Whether production transition should require Supabase Pro budget approval in advance.

---

## 18. Final Position

This document supports the current CTO decision:

**Modal 유지 + Supabase Free PoC 권장**

Supabase is not being pursued as an immediate cost-cutting replacement. It is being evaluated as a long-term backend simplification candidate. Modal remains the current backend and future compute layer. Firebase Auth remains in place. Production Supabase transition is not approved.
