# Scout Staging Auth Verifier Unblock Path 정의

> **Status:** 문서(document-level) 분석 및 경로 정의 — 실제 코드 변경 없음
> **Version:** v20260702-1
> **Audience:** Scout live provider engineering, CTO
> **Related issues:** #1882, #2636, #2660
> **References:** `lovebud-scout-staging-verifier-mode-contract.md`, `lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md`, `lovebud-scout-live-auth-verifier-adapter-skeleton.md`, `lovebud-scout-staging-smoke-operator-handoff.md`

---

## 1. Purpose

이 문서는 Scout 스테이징 환경에서 auth verifier가 blocking되어 있는 문제의 근본 원인을 분석하고, 이를 해결하기 위한 **unblock path(경로)**를 정의합니다.

**이 문서는 document-level 분석입니다. 실제 코드 변경, Cloudflare env/secret 변경, 또는 Firebase Admin SDK 도입을 포함하지 않습니다.**

---

## 2. Current Blocked State

### 2.1 Blocking Mechanism

```
[Request] → suggest.js LIVE branch
            → createScoutLiveDependencyAdapter({ mockDisabled: true })
              → createScoutLiveAuthVerifierAdapter({ mockDisabled: true })
                → verifyToken() returns VERIFIER_MOCK_DISABLED
                  → allowed: false
                    → mapped to AUTH_INVALID (401)
```

스테이징 환경에서 모든 Bearer token 요청은 `VERIFIER_MOCK_DISABLED`(401)로 거부됩니다. 이는 기본 `mockDisabled: true` 설정 때문이며, 이는 의도적이고 안전한 기본값입니다.

### 2.2 STAGING Mode 존재하나 DI 전용

| Surface | State | Details |
|---------|-------|---------|
| `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.STAGING` | ✅ 존재 | `'staging'` enum 값 정의됨 |
| `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_STAGING_MOCK_VERIFIED` | ✅ 존재 | 성공 코드 정의됨 |
| Factory STAGING branch | ✅ 존재 | `resolveVerifierMode()` + factory 구현 완료 |
| `stagingVerifier` DI requirement | ✅ 존재 | 강제: 함수 주입 없으면 NOT_IMPLEMENTED |
| **Cloudflare env activation** | ❌ **없음** | STAGING mode은 env 변수로 활성화 불가, DI 전용 |
| **Built-in mock verifier** | ❌ **없음** | STAGING mode에 내장 mock verifier 없음 |
| **suggest.js LIVE branch wiring** | ❌ **없음** | 여전히 `mockDisabled: true` |

### 2.3 현재 스테이징 Smoke 결과 (#2636)

2026-06-18 로컬 시뮬레이션 smoke report에 따르면:

| Scenario | Result | Note |
|----------|--------|------|
| Success path (valid auth + live provider) | **BLOCKED** | Auth verifier가 401 반환 |
| Missing Authorization | ✅ 401 | 의도된 동작 |
| Invalid Bearer token | ✅ 401 | 의도된 동작 (사실상 모든 토큰이 이 케이스) |
| Rate limit | ✅ 429 | Rate-limit boundary 정상 |
| Missing config | ✅ 503 | Config gate 정상 |
| Provider error | ✅ 503 | Provider boundary 정상 |
| Kill switch | ✅ 200 stub | Stub fallback 정상 |

**성공 경로(scenario 1)만 BLOCKED** — auth verifier가 real provider path 자체에 도달하는 것을 막고 있습니다.

---

## 3. Allowlist Gap Analysis

### 3.1 Verifier Adapter Allowlist (`SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`)

```javascript
['requestId', 'tokenHash', 'authorizationScheme', 'providerMode', 'endpointPath', 'nowMs']
```

### 3.2 Dependency Adapter Verifier Payload Allowlist (`AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`)

```javascript
['requestId', 'tokenHash', 'authorizationScheme', 'providerMode', 'endpointPath', 'nowMs', 'idToken']
```

### 3.3 Gap 식별

| Field | Verifier Adapter Allowlist | Dep Adapter Allowlist | Gap |
|-------|---------------------------|----------------------|-----|
| `requestId` | ✅ | ✅ | — |
| `tokenHash` | ✅ | ✅ | — |
| `authorizationScheme` | ✅ | ✅ | — |
| `providerMode` | ✅ | ✅ | — |
| `endpointPath` | ✅ | ✅ | — |
| `nowMs` | ✅ | ✅ | — |
| `idToken` | ❌ **없음** | ✅ (guarded) | **GAP** |

`idToken` 필드는 Dependency Adapter의 `AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`에는 존재하지만, Verifier Adapter의 `SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`에는 **없습니다**.

**실제 동작 분석:**
- Dependency Adapter의 `buildSafeVerifierPayload()`는 `allowRawTokenHandoff: true`일 때 `idToken`을 payload에 포함시킵니다.
- Verifier Adapter의 `verifyToken()` (STAGING / FIREBASE_RUNTIME branch)은 `payload.idToken`을 **직접** 읽습니다 — `sanitizePayload()`를 거치지 않습니다.
- 만약 `sanitizePayload()`가 호출되면 `idToken`은 **drop**됩니다 (허용 목록에 없으므로).
- 즉, 현재 `idToken`은 sanitize 경로를 우회하여 전달되며, 이는 의도된 설계(private raw token boundary)입니다.

**권장 수정:**
- 명확성을 위해 `idToken`을 `SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`에 추가하는 것을 고려해야 함. 단, `sanitizePayload()`가 호출될 때 idToken이 보존되도록 하면서도, `sanitizePayload()`가 일반적으로 idToken을 노출하지 않아야 한다는 정책과 충돌하지 않도록 해야 함.
- 또는, `idToken`은 sanitize 경로를 통해 전달되지 않는다는 점을 명시적으로 문서화하고, `VERIFIER_PAYLOAD_PROHIBITED` 체크(prohibited field 체크)만 통과하도록 유지.

**현재 설계는 의도적으로 `idToken`을 허용 목록에 포함하지 않음** — `verifyToken()`이 raw payload에서 직접 `idToken`을 읽고, `sanitizePayload()`는 safe payload 전용으로 사용됩니다. 이 gap은 버그가 아니라 설계 결정입니다.

### 3.4 Prohibited Fields (`SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS`)

현재 18개 필드가 금지 목록에 있으며, 이는 적절하고 완전합니다. `token`, `rawToken`, `authorization`, `authorizationHeader`, `apiKey`, `secret`, `password`, `cookie`, `sessionCookie`, `firebaseToken`, `openaiApiKey` 등 모든 민감 필드를 포함합니다.

---

## 4. Unblock Path Definition

### 4.1 Path Overview

```
단기 경로 (Short-term): Staging env flag → built-in mock verifier (DI 없이)
   ↓
중기 경로 (Medium-term): Cloudflare env로 STAGING mode 활성화 + allowRawTokenHandoff wiring
   ↓
장기 경로 (Long-term): Firebase Admin SDK 실 구현 + production gate
```

### 4.2 경로 A: Cloudflare Env Flag 기반 Staging Mock Verifier Activation (권장)

**목표:** Cloudflare 환경 변수 하나로 스테이징에서 auth verifier가 `allowed: true`를 반환하도록 함.

**필요 조건:**

1. **새로운 Cloudflare 환경 변수:** `SCOUT_SUGGEST_VERIFIER_MODE`
   - 기본값: `mock_disabled` (변경 없음, 안전)
   - 스테이징 값: `staging` (명시적 opt-in)
   - 유효 값: `mock_disabled` | `staging`

2. **Factory 수정 (코드 변경 필요):**
   - `createScoutLiveAuthVerifierAdapter()`가 `env` 파라미터를 선택적으로 받아 `SCOUT_SUGGEST_VERIFIER_MODE`를 읽음
   - `SCOUT_SUGGEST_VERIFIER_MODE=staging`이고 `SCOUT_SUGGEST_PROVIDER_STAGE=staging`이면 내장 staging mock verifier 활성화
   - 내장 staging mock verifier는 모든 non-empty token에 대해 `allowed: true` + `VERIFIER_STAGING_MOCK_VERIFIED` 반환

3. **Production Guard:**
   - `SCOUT_SUGGEST_PROVIDER_STAGE=staging`이 **필수** — production에서는 절대 활성화 불가
   - `SCOUT_SUGGEST_PROVIDER_STAGE`가 `production`이면 `VERIFIER_MOCK_DISABLED`로 fallback

4. **Dependency Adapter Wiring:**
   - `createScoutLiveDependencyAdapter()`도 `env` 파라미터를 받아 `verifierAdapter` 생성에 전달
   - `mockDisabled: true` 기본값은 그대로 유지 (env opt-in이 없으면 mock-disabled)

5. **suggest.js LIVE branch:**
   - `createScoutLiveDependencyAdapter({ mockDisabled: true })` → `createScoutLiveDependencyAdapter({ env, mockDisabled: false })`로 변경 (단, env flag가 있을 때만)

#### 4.2.1 의사코드 (설계 참고용, 실제 구현 아님)

```
// live-auth-verifier-adapter.js 에 추가될 개념:

function createBuiltinStagingVerifier() {
  return async (idToken) => {
    if (typeof idToken !== 'string' || idToken.length === 0) {
      return { uid: null };  // 실패
    }
    // 스테이징 전용: 모든 non-empty token을 허용
    // 실제 uid는 token의 안전한 해시로부터 파생
    return { uid: 'staging-user-' + hash(idToken) };
  };
}

// Factory 수정 개념:
// createScoutLiveAuthVerifierAdapter(options, env?) {
//   const verifierMode = env?.SCOUT_SUGGEST_VERIFIER_MODE;
//   const providerStage = env?.SCOUT_SUGGEST_PROVIDER_STAGE;
//   
//   if (verifierMode === 'staging' && providerStage === 'staging') {
//     // 내장 staging verifier 활성화
//     options = { ...options, mockDisabled: false, verifierMode: 'staging',
//                 stagingVerifier: createBuiltinStagingVerifier() };
//   }
//   ...
// }
```

### 4.3 경로 B: DI 기반 + Cloudflare Preview 전용 (대안)

현재 설계(순수 DI)를 유지하되, Cloudflare Preview/Deploy Preview 환경에서만 DI를 주입할 수 있도록 wrangler.toml 또는 GitHub Actions workflow를 통해 `context.liveAdapter`를 주입.

**단점:** 운영 복잡성 증가, Preview deploy마다 별도 설정 필요, 실제 staging 환경에서 사용 불가.

### 4.4 경로 C: Firebase Admin SDK 직접 구현 (장기)

가장 안전하지만 가장 많은 작업이 필요한 경로. Firebase Admin SDK를 실제로 통합하고 `verifyIdToken`을 호출.

**이 경로는 #2567 / #2319 / `lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md` 에서 이미 계획됨.**

---

## 5. Staging Activation Conditions

### 5.1 Required Conditions for Staging Auth Verifier Unblock

| # | Condition | Owner | Priority |
|---|-----------|-------|----------|
| 1 | `SCOUT_SUGGEST_VERIFIER_MODE=staging` env 변수 정의 및 문서화 | Product/Eng | **P0** |
| 2 | `SCOUT_SUGGEST_PROVIDER_STAGE=staging` production guard 확인 | Eng | **P0** |
| 3 | 내장 staging mock verifier 구현 (모든 non-empty token 허용) | Eng | **P0** |
| 4 | `allowRawTokenHandoff` → `verifierAdapter.verifyToken({ idToken })` wiring | Eng | **P0** |
| 5 | Staging mock verifier는 `uid` 해시만 반환 (raw uid/email/claims 금지) | Eng | **P0** |
| 6 | `sanitizeScoutLiveAuthVerifierPayload`에 `idToken` 허용 목록 추가 (선택적) | Eng | **P1** |
| 7 | Contract test: staging mode + env flag → `allowed: true` | Eng | **P1** |
| 8 | Contract test: staging mode + production stage → `allowed: false` (safe-fail) | Eng | **P1** |
| 9 | Contract test: no env flag → default mock-disabled | Eng | **P1** |
| 10 | Staging smoke test (#2636) 재실행 및 통과 | Ops | **P0** |

### 5.2 Required Conditions for Production Activation

| # | Condition | Status |
|---|-----------|--------|
| 1 | Firebase Admin SDK 통합 및 `verifyIdToken` 실 구현 | ❌ 미완료 |
| 2 | Firebase service account secret 안전하게 저장 (Cloudflare Secret) | ❌ 미완료 |
| 3 | Rate-limit persistent storage 구현 | ❌ 미완료 |
| 4 | Cost/quota monitoring 구현 | ❌ 미완료 |
| 5 | Abuse reporting 구현 | ❌ 미완료 |
| 6 | Kill-switch drill 완료 | ❌ 미완료 |
| 7 | Credential rotation drill 완료 | ❌ 미완료 |
| 8 | Staging soak test (7일) 통과 | ❌ 미완료 |
| 9 | CTO 승인 | ❌ 미완료 |

**Production 활성화는 이 문서의 범위를 벗어납니다.** 위 조건들은 #1882 및 `lovebud-scout-live-execution-blocker-map.md`에 정의된 blocker 목록과 일치합니다.

---

## 6. Allowlist Gap Resolution

### 6.1 권장 조치

`SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`에 `idToken`을 **추가하지 않는 것을 권장**합니다. 이유:

1. **설계상 명확한 분리**: `idToken`은 private raw token boundary로 직접 전달됨. `sanitizePayload()`는 safe public payload 전용.
2. **안전성**: `idToken`이 허용 목록에 있으면 `sanitizePayload('drop')` 모드에서 실수로 노출될 가능성이 있음.
3. **일관성**: Firebase runtime branch와 staging branch 모두 동일한 패턴(idToken 직접 읽기)을 사용.

대신, 다음 문서화를 권장:

- Dependency Adapter의 `AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`에 `idToken`이 존재하는 이유와 guarded 동작(`allowRawTokenHandoff`)을 명확히 주석으로 문서화 (이미 완료됨).
- Verifier Adapter의 JSDoc에 `verifyToken()`이 `payload.idToken`을 직접 읽으며, 이는 `sanitizePayload()`를 우회하는 의도된 설계임을 명시.

### 6.2 향후 일관성 개선

장기적으로는 `SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`에 `idToken`을 조건부로 허용할 수 있도록 `onProhibitedField` 정책을 확장하는 것을 고려:
- `'reject-strict'` (현재 `'reject'`): `idToken`도 금지, raw token boundary 우회 불허
- `'reject'` (현재): prohibited field만 reject, `idToken`은 허용
- `'drop'` (현재): prohibited field만 drop

---

## 7. Risk Assessment

### 7.1 Unblock Path Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Staging mock verifier가 production에 실수로 활성화 | 낮음 | 심각 (인증 우회) | `SCOUT_SUGGEST_PROVIDER_STAGE=staging` production guard + contract test |
| `allowRawTokenHandoff`로 인한 token 노출 | 낮음 | 심각 | Guarded field + `reject` mode sanitize + contract test |
| Staging에서 인증된 사용자와 미인증 사용자 구분 불가 | 중간 | 중간 | Staging은 의도적으로 모든 사용자 허용; production에서 실제 인증 필요 |
| 내장 mock verifier가 실제 token 검증을 대체하는 오해 | 중간 | 낮음 | 명확한 문서화 + production guard |

### 7.2 Safety Invariants (변경 불가)

1. **Production에서는 절대 staging mock verifier 활성화 불가**
2. **기본값은 항상 mock-disabled (`allowed: false`)**
3. **Raw token / authorization header / API key는 절대 log, response, storage에 기록 불가**
4. **`userKey`는 항상 `null`; `userKeyHash`만 반환**
5. **Factory는 항상 frozen object 반환**
6. **`verifyToken()`은 절대 throw하지 않음**

---

## 8. Recommended Implementation Sequence

```
Step 1 [문서]: 이 문서 — Scout staging auth verifier unblock path 정의 ✅ (현재)
   ↓
Step 2 [코드]: Cloudflare env flag 기반 staging mock verifier activation 구현
   - createScoutLiveAuthVerifierAdapter에 env 파라미터 추가
   - SCOUT_SUGGEST_VERIFIER_MODE env flag 처리
   - 내장 staging mock verifier 구현
   - Production guard (SCOUT_SUGGEST_PROVIDER_STAGE 체크)
   ↓
Step 3 [코드]: Dependency adapter wiring
   - createScoutLiveDependencyAdapter에 env 파라미터 전파
   - allowRawTokenHandoff: true 설정 (staging mode일 때만)
   ↓
Step 4 [테스트]: Contract tests
   - Staging env flag → allowed: true
   - Production stage → allowed: false (safe-fail)
   - No env flag → default mock-disabled
   - No raw token propagation
   ↓
Step 5 [ops]: Staging smoke (#2636) 재실행 및 보고서 작성
   ↓
Step 6 [문서]: 이 문서 업데이트 (결과 반영)
```

---

## 9. Conclusion

### Current Blocking Root Cause

Scout staging auth verifier가 blocking된 근본 원인은:
1. `suggest.js` LIVE branch가 `createScoutLiveDependencyAdapter({ mockDisabled: true })`로 hard-coded되어 있음
2. `STAGING` mode는 존재하지만 **DI 전용**으로, Cloudflare 환경 변수로 활성화 불가
3. 내장 staging mock verifier가 없어서 DI 없이는 `allowed: true` 경로에 도달 불가

### Unblock Path 요약

**권장 경로 (경로 A):** Cloudflare 환경 변수 `SCOUT_SUGGEST_VERIFIER_MODE=staging`을 도입하고, `SCOUT_SUGGEST_PROVIDER_STAGE=staging` production guard와 함께 내장 staging mock verifier를 활성화.

**Allowlist Gap:** `idToken`이 verifier adapter allowed fields에 없음 — 이는 의도된 설계(private raw token boundary)이며, 버그가 아님.

**Production은 여전히 BLOCKED:** Production auth verifier 활성화는 Firebase Admin SDK 구현, rate-limit storage, cost monitoring, CTO 승인 등이 필요하며, 이 문서의 범위를 벗어남.

### Document-Level Deliverable

이 문서는 `docs/product/lovebud-scout-auth-verifier-unblock-path.md`에 저장되었습니다. 실제 코드 변경, Cloudflare env/secret 변경, 또는 Firebase Admin SDK 도입을 포함하지 않는 document-level 분석입니다.
