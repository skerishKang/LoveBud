# Settings Profile-Image Management and Storage Boundary

Parent #3583 — Keep OPEN.

이 문서는 Settings 프로필 이미지 관리의 product, privacy, security, technical boundary를 source-only 조사로 확정합니다. 구현 인가가 아닙니다.

Source baseline: `9af1f6116566e9b616a89f108bc17e002bcf8485` (Issue 생성 시점).
Actual worktree base: `75e103af15178f31f4ecaafef7968a547439e050` (current origin/main; 1 commit ahead of Issue baseline, CI test fix only).

---

## 1. Disposition

```text
READ_ONLY_PROVIDER_PHOTO_ONLY
```

현재 source에서 프로필 이미지는 provider(Google 등)가 관리하는 photoURL의 read-only 표시만 지원합니다. 사용자 주도 이미지 mutation, upload, storage, remove/reset 경로는 존재하지 않으며, 이 문서도 인가하지 않습니다.

---

## 2. Source-confirmed current state

### 2.1 photoURL read/display authority

**SOURCE_CONFIRMED.**

Settings는 Firebase Auth live user에서 `photoURL`을 읽어 표시합니다.

- `js/settings.js:684` — `resolveSettingsAccountViewModel`이 `user.photoURL`을 view-model에 포함.
- `js/settings.js:531` — `updateProfileUI`가 `/^https?:\/\//` 정규식으로 http/https URL만 허용.
- `js/settings.js:534-546` — 유효 URL이면 `<img>` 생성, `onerror` 시 initials fallback.
- `js/settings.js:553-554` — URL 없거나 로드 실패 시 initials 표시.

Settings는 `getLiveUser()` (`js/settings.js:303-310`)로 `firebase.auth().currentUser`를 직접 사용하며, `waitForRecoverableAuthUser()` (`js/settings.js:189-197`)로 auth resolve를 대기합니다.

### 2.2 Fallback avatar and initials

**SOURCE_CONFIRMED.**

세 개의 initials resolver가 존재합니다:

| Location | Logic |
|---|---|
| `js/settings.js:244-251` | 두 단어 → 첫+끝 이니셜, 한 단어 → 첫 글자, empty → `'L'` |
| `js/auth.js:422-428` | auth-ui 모듈 위임, fallback regex-gated 첫 글자 또는 `'L'` |
| `js/auth/auth-ui.js:96-103`, `js/auth/auth-ui-templates.js:23-31` | 동일 로직 중복 구현 |

Settings 이미지 로드 실패 fallback: `js/settings.js:538-545` — `img.onerror`에서 img 제거, initials 삽입, class swap (`settings-profile-avatar-img-wrap` → `settings-profile-avatar-initials`), `role="img"` + fallback `aria-label` 재설정.

### 2.3 shared-header avatar propagation

**SOURCE_CONFIRMED.**

shared-header는 **initials-only**입니다. photoURL을 표시하지 않습니다.

- `js/shared-header.js:193-215` — `buildCachedUserAvatar(cachedUser)`가 `displayName.charAt(0)` 이니셜만 렌더.
- `js/shared-header.js:147-164` — `getConfirmedSessionUser()`가 `lovebud_auth_cache` localStorage를 읽음.
- `js/auth/auth-cache.js:88-103` — cache payload는 `{ uid, displayName, email }`만 저장. **photoURL 필드 없음.**

Runtime sequence: 페이지 로드 시 cache에서 initials 즉시 표시 → `onAuthStateChanged` 후 `updateNavUI`가 live user로 dropdown avatar 교체 (photo 또는 initial).

Auth dropdown avatar (photo 표시 경로):

- `js/auth.js:430-469` — `buildUserDropdown(user)`이 `user.photoURL` 확인, 있으면 `<img referrerpolicy="no-referrer">`, 없으면 initial `<span aria-hidden="true">`.
- `js/auth/auth-ui.js:105-154`, `js/auth/auth-ui-templates.js:33-74` — 동일 로직.

### 2.4 Firebase Auth client capabilities

**SOURCE_CONFIRMED.**

SDK: Firebase 8.10.1 namespaced (`firebase.auth()`), gstatic CDN 로드.

실제 호출되는 sign-in methods:

| Method | Location |
|---|---|
| `signInWithPopup(GoogleAuthProvider)` | `js/auth/auth-firebase.js:278` |
| `signInWithRedirect(GoogleAuthProvider)` | `js/auth/auth-firebase.js:346` |
| `signInWithEmailAndPassword` | `js/auth/auth-login-page.js:505` |
| `createUserWithEmailAndPassword` | `js/auth/auth-login-page.js:508, 680` |

`updateProfile()` 호출:

| Call | Payload | Location |
|---|---|---|
| Settings display-name edit | `{ displayName }` only | `js/settings.js:628` |
| Signup display-name set | `{ displayName }` only | `js/auth/auth-login-page.js:510, 682` |

**`updateProfile({ photoURL })` 호출은 codebase 전체에 존재하지 않습니다.**

### 2.5 Storage/upload service

**SOURCE_CONFIRMED — 부재 확인.**

`uploadBytes`, `putString`, `getDownloadURL`, `presigned`, `signedUrl`, `firebase.storage`, `storage()` 검색 결과: 사용자 이미지 upload pipeline **zero matches**.

유사 명칭 hit은 모두 무관:

- `functions/api/scout/*` — rate-limit storage scaffold, mock-disabled.
- `modal_compute/auth.py:141` — `require_plus_for_private_storage`: Plus-tier visibility gate, file storage 아님.

**결론: 이미지 upload, blob storage, signed URL, image proxy, CDN 경로가 존재하지 않습니다.**

### 2.6 CSP remote-image constraints

**SOURCE_CONFIRMED.**

`_headers` (Cloudflare Pages active runtime):

```text
img-src 'self' data: https:
connect-src 'self' https:
```

- 모든 HTTPS 이미지 소스 허용 (remote photoURL, 미래 uploaded URL 포함).
- `data:` 허용 (base64 inline 이미지 CSP 통과, 그러나 사용처 없음).
- `connect-src 'self' https:` — 모든 HTTPS endpoint fetch/XHR CSP 허용.
- `<meta http-equiv="Content-Security-Policy">` 없음.
- `vercel.json` — deprecated, CSP/headers 없음.

### 2.7 Auth cache refresh boundary

**SOURCE_CONFIRMED.**

- `js/auth/auth-firebase.js:669-733` — `onAuthStateChanged`에서 `user.reload()` 호출하여 fresh profile(photoURL 포함) 강제 갱신.
- `js/auth/auth-cache.js:126-169` — `persistConfirmedAuthSession`이 `{ uid, displayName, email }`만 cache. **photoURL 미포함.**
- Cache clear: `clearConfirmedAuthCache` (`auth-cache.js:15-47`), `lovebud-auth-cache-cleared` event (`js/api/base-api-fetch.js:139`).

**함의:** live user session에서는 `user.reload()`로 photoURL이 갱신되지만, persisted cache는 photoURL을 저장하지 않으므로 다음 페이지 로드 시 header avatar는 항상 initials로 시작합니다.

### 2.8 Remove/reset behavior

**SOURCE_CONFIRMED — 부재 확인.**

`removePhoto`, `resetPhoto`, `deletePhoto`, `clearAvatar`, `removeAvatar`, `deleteAvatar` 검색: **zero matches**. 프로필 이미지 제거/초기화 UI 또는 코드 경로가 존재하지 않습니다.

### 2.9 Accessibility

**SOURCE_CONFIRMED.**

| Surface | a11y handling |
|---|---|
| Settings avatar container | `role="img"`, `aria-label="프로필 이미지"` (static HTML, JS에서 동적 갱신) — `pages/settings.html:33` |
| Settings photo img | `alt=""` (decorative, wrapper가 label 보유) — `js/settings.js:536` |
| Settings fallback | `role="img"` + fallback `aria-label` 재설정 — `js/settings.js:543-557` |
| Header dropdown photo | `alt=""`, `referrerpolicy="no-referrer"` — `js/auth.js:450` |
| Header dropdown initial | `aria-hidden="true"` — `js/auth.js:451` |
| Header dropdown trigger | `aria-label="내 계정 메뉴"` — `js/auth.js:455` |
| Header cached avatar | `title` attribute only, `aria-label`/`role` 없음 — `js/shared-header.js:208` |

i18n avatar keys (`js/i18n/i18n-shared.js:375-382`):

```text
settings.profile.avatarPhoto  — ko: '{displayName}님의 프로필 사진' / en: 'Profile photo for {displayName}'
settings.profile.avatarFallback — ko: '{displayName}님의 프로필' / en: 'Profile for {displayName}'
```

Hardcoded Korean (i18n 미적용): `js/shared-header.js:205`, `js/auth.js:455`, `pages/settings.html:33`.

### 2.10 Mobile and responsive

**SOURCE_CONFIRMED.**

| Surface | Breakpoint | Size |
|---|---|---|
| Settings avatar | base | 56×56 (`css/settings/components.css:67-80`) |
| Settings avatar | `max-width: 640px` | 48×48 (`css/settings/responsive.css:25-29`) |
| Header dropdown avatar | base | 36×36 (`css/global/global-header.css:133-143`) |
| Header dropdown avatar | `max-width: 480px` | 32×32 (`css/global/global-header.css:421-424`) |
| Header cached avatar | base | 32×32 (`css/global/global-header.css:180-191`) |

`object-fit: cover` 적용: Settings img (`css/settings/components.css:90-95`), header dropdown img (`css/global/global-header.css:226-231`).

---

## 3. Model comparison

### Option A — External URL을 Firebase Auth photoURL에 저장

Firebase Auth SDK의 `updateProfile({ photoURL: externalUrl })`을 호출하여 사용자가 지정한 외부 URL을 photoURL에 설정.

| Aspect | Assessment |
|---|---|
| SDK support | Firebase 8.10.1 `updateProfile({ photoURL })` API 존재. 현재 codebase에서 호출하지 않음 |
| Infrastructure | 추가 인프라 불필요. Firebase Auth가 URL 저장 |
| Privacy risk | **높음.** 외부 URL은 third-party tracking pixel, IP leak, referrer leak 가능. `referrerpolicy="no-referrer"`로 일부 완화되나 URL 자체에 tracking parameter 포함 가능 |
| Security risk | **높음.** 임의 HTTPS URL 허용 시 SSRF-유사 공격 벡터 (client-side). CSP `img-src https:`는 모든 HTTPS 허용 |
| Durability | 외부 URL 소유자 변경/삭제 시 이미지 손실. LoveBud 통제 불가 |
| Remove/reset | `updateProfile({ photoURL: null })`로 제거 가능하나 현재 미구현 |
| Cache propagation | `user.reload()` 후 live user에 반영. Cache는 photoURL 미저장이므로 header 즉시 반영 안 됨 |
| Classification | **PROPOSED_FUTURE_CONTRACT** — SDK capability 존재하나 privacy/security gate 없이 인가 불가 |

### Option B — Repository-owned storage/upload service

LoveBud가 직접 이미지 upload, storage, serving을 관리.

| Aspect | Assessment |
|---|---|
| Infrastructure | **존재하지 않음.** Firebase Storage 미설정, upload API 없음, signed URL/proxy/CDN 없음 |
| Required build | Storage backend (Firebase Storage / R2 / S3), upload endpoint, image validation, thumbnail generation, serving/proxy, quota management |
| Privacy risk | 중간. 자체 관리이나 이미지 metadata (EXIF GPS 등) stripping 필요 |
| Security risk | 중간. Upload validation (type, size, dimension), malicious content scanning, access control 필요 |
| Cost | Storage + egress 비용. 사용자 규모에 비례 |
| Classification | **NOT_AUTHORIZED** — 인프라 부재, 이 문서의 scope를 초과하는 build-out 필요 |

### Option C — Provider-managed photo read-only

현재 상태. Google 등 OAuth provider가 관리하는 프로필 사진을 read-only로 표시.

| Aspect | Assessment |
|---|---|
| Infrastructure | 추가 인프라 불필요. 현재 동작 중 |
| Privacy risk | **낮음.** Provider가 URL 관리. `referrerpolicy="no-referrer"` 적용. 사용자 URL 입력 없음 |
| Security risk | **낮음.** Provider-managed URL만 표시. 임의 URL 입력 경로 없음 |
| Durability | Provider 계정 상태에 의존. Provider 사진 변경 시 `user.reload()`로 반영 |
| User control | 제한적. Provider 측에서 사진 변경 가능하나 LoveBud 내에서는 변경 불가 |
| Classification | **SOURCE_CONFIRMED** — 현재 구현과 일치 |

### Option D — Profile-image mutation 미지원

프로필 이미지 변경 기능을 제공하지 않음. Provider photo read-only 또는 initials만 표시.

| Aspect | Assessment |
|---|---|
| Infrastructure | 불필요 |
| Privacy risk | **최소.** 이미지 mutation 경로 자체가 없음 |
| Security risk | **최소.** 공격 표면 없음 |
| User experience | Provider 사진이 없으면 항상 initials. 사용자 커스터마이즈 불가 |
| Classification | **SOURCE_CONFIRMED** — 현재 구현과 일치 (mutation 경로 zero) |

### Comparison summary

| Option | Classification | Infrastructure | Privacy | Security |
|---|---|---|---|---|
| A — External URL in photoURL | PROPOSED_FUTURE_CONTRACT | None (SDK exists) | High risk | High risk |
| B — Repository-owned storage | NOT_AUTHORIZED | Does not exist | Medium | Medium |
| C — Provider photo read-only | SOURCE_CONFIRMED | None needed | Low | Low |
| D — No mutation | SOURCE_CONFIRMED | None needed | Minimal | Minimal |

---

## 4. Privacy and security risk analysis

### 4.1 Third-party image URL risks (Option A 관련)

- **Tracking pixel:** 외부 URL이 1×1 tracking 이미지일 수 있으며, 로드 시 사용자 IP, User-Agent, 시점 노출.
- **URL parameter leak:** URL query string에 session/token/tracking ID 포함 가능.
- **Referrer leak:** `referrerpolicy="no-referrer"`로 완화되나, 모든 브라우저/컨텍스트에서 보장되지 않음.
- **Content instability:** URL 소유자가 이미지를 임의 변경(불쾌한 콘텐츠, 광고) 가능.
- **Availability dependency:** 외부 서버 장애 시 이미지 로드 실패. 현재 `onerror` fallback으로 initials 전환은 구현됨.

### 4.2 Durable storage risks (Option B 관련)

- **EXIF metadata:** 업로드 이미지에 GPS 위치, 기기 정보 포함 가능. Server-side stripping 필요.
- **Malicious content:** 이미지 위장 malware, SVG XSS vector. Content scanning 필요.
- **Access control:** 비공개 프로필 이미지의 unauthorized access 방지. Signed URL 또는 auth-gated proxy 필요.
- **Storage abuse:** 대용량/다수 이미지 업로드 quota 관리.

### 4.3 Current state risks (Option C/D)

- Provider-managed URL은 provider의 privacy policy 적용. LoveBud 통제 범위 밖.
- `referrerpolicy="no-referrer"` 적용으로 referrer leak 완화 (`js/auth.js:450`).
- `img.onerror` fallback으로 broken image UX 처리 (`js/settings.js:538-545`).
- Cache에 photoURL 미저장으로 localStorage에서의 이미지 URL 노출 없음.

---

## 5. Accessibility, localization, mobile requirements

### 5.1 Accessibility

현재 상태:

- Settings avatar: `role="img"` + 동적 `aria-label` (photo/fallback 구분).
- Header dropdown: photo `alt=""` (decorative), initial `aria-hidden="true"`, trigger `aria-label`.
- Header cached avatar: `title` only. `aria-label` 부재 — 개선 여지.

미래 mutation 추가 시 필수:

- Upload control: `role="button"`, `aria-label`, keyboard focus/activation.
- Remove/reset: destructive action confirmation, `aria-live` status announcement.
- Preview: `role="img"` + descriptive `aria-label`.
- Error state: `role="alert"` 또는 `aria-live="assertive"`.

### 5.2 Localization

현재 avatar 관련 i18n keys: `settings.profile.avatarPhoto`, `settings.profile.avatarFallback` (ko/en).

Hardcoded Korean strings (i18n 미적용):

- `js/shared-header.js:205` — header avatar link label.
- `js/auth.js:455` — dropdown trigger aria-label.
- `pages/settings.html:33` — static avatar aria-label (JS에서 동적 교체).

미래 mutation 추가 시: upload/remove/error 모든 user-facing string에 i18n key 필수.

### 5.3 Mobile

현재 responsive avatar sizes: Settings 56→48px (640px), header 36→32px (480px). `object-fit: cover` 적용.

미래 upload 추가 시:

- Touch target 최소 44×44px (WCAG 2.5.5).
- Mobile camera/gallery file picker 대응 (`accept="image/*"`, `capture` attribute 고려).
- Upload progress indicator (mobile network latency).
- Large image client-side resize before upload (mobile data 절감).

---

## 6. Auth cache refresh and rollback expectations

### 6.1 Current refresh boundary

- `onAuthStateChanged` → `user.reload()` → fresh photoURL → `updateNavUI` → dropdown avatar 갱신.
- Cache (`lovebud_auth_cache`)는 `{ uid, displayName, email }`만 저장. photoURL 미포함.
- Header는 페이지 로드 시 cache에서 initials 표시, auth resolve 후 live user로 교체.

### 6.2 Future mutation 시 cache 영향

Option A (external URL in photoURL) 채택 시:

- `updateProfile({ photoURL })` 후 `user.reload()` 필요.
- Cache에 photoURL 추가 여부 결정 필요: 추가 시 header 즉시 표시 가능하나 localStorage에 이미지 URL 노출. 미추가 시 header는 계속 initials.
- Rollback: `updateProfile({ photoURL: null })` 후 `user.reload()`. Cache에 photoURL이 있으면 stale cache 문제 발생 가능.

Option B (repository-owned storage) 채택 시:

- Custom cache layer 필요 (uploaded image URL, thumbnail URL).
- Cache invalidation: upload/remove 시 cache 즉시 갱신.
- Rollback: storage object 삭제 + cache clear + UI fallback.

### 6.3 Rollback boundary

현재 상태에서 rollback이 필요한 시나리오는 없습니다. Provider photo는 provider 측 변경 시 `user.reload()`로 자동 반영되며, LoveBud 측 mutation이 없으므로 rollback 대상이 없습니다.

---

## 7. Disposition rationale

```text
READ_ONLY_PROVIDER_PHOTO_ONLY
```

선정 근거:

1. **Source-confirmed current state.** Option C와 D가 현재 구현과 정확히 일치합니다.
2. **Infrastructure absence.** Option B에 필요한 storage/upload/serving 인프라가 존재하지 않습니다.
3. **Privacy/security gate.** Option A의 external URL mutation은 tracking pixel, URL leak, content instability 위험이 있으며, 이를 완화할 security gate (URL allowlist, image proxy, content scanning)가 없습니다.
4. **No authorized build-out.** 이 문서는 source-only 조사입니다. Infrastructure build, Firebase configuration, backend/API 작업은 인가되지 않았습니다.
5. **Existing UX is complete for read-only.** Provider photo 표시, initials fallback, `onerror` handling, a11y attributes, responsive sizing이 모두 구현되어 있습니다.

---

## 8. Unresolved items

| Item | Status |
|---|---|
| External URL allowlist/proxy 설계 | UNRESOLVED — Option A 채택 시 필수 |
| Image type/size/dimension 제한 정책 | UNRESOLVED — upload 경로가 없으므로 현재 불필요 |
| EXIF stripping 정책 | UNRESOLVED — Option B 채택 시 필수 |
| Header cached avatar `aria-label` 추가 | UNRESOLVED — 현재 `title` only |
| Hardcoded Korean avatar strings i18n 전환 | UNRESOLVED — 현재 동작하나 i18n 미적용 |
| Cache photoURL 포함 여부 | UNRESOLVED — Option A/B 채택 시 결정 필요 |

---

## 9. Recommendations (not implementation authorization)

향후 프로필 이미지 mutation을 고려할 경우 권장 순서:

1. **Option A gate-first approach:** External URL mutation을 허용하기 전에 URL allowlist (known provider domains), image proxy (server-side fetch + resize + content-type validation), CSP `img-src` tightening을 설계하고 인가받아야 합니다.
2. **Option B infrastructure decision:** Repository-owned storage는 Firebase Storage / Cloudflare R2 / 기타 backend 중 하나를 선택하는 별도 product/engineering decision이 선행되어야 합니다.
3. **a11y/i18n debt:** Mutation 추가 전에 header cached avatar `aria-label`, hardcoded Korean strings i18n 전환을 완료하는 것이 바람직합니다.

이 권장사항은 구현 인가가 아닙니다. 각 항목은 별도 Issue와 Web CTO contract가 필요합니다.

---

## 10. Source file reference

| File | Relevance |
|---|---|
| `js/settings.js` | photoURL read (684), render (525-561), initials (244-251), `updateProfile({displayName})` (628) |
| `pages/settings.html` | Avatar container (33), SDK load (110-124) |
| `css/settings/components.css` | Avatar base styles (67-95) |
| `css/settings/responsive.css` | Mobile avatar (25-29) |
| `js/shared-header.js` | Header initials-only avatar (147-164, 193-215, 263-275) |
| `js/auth.js` | Dropdown avatar w/ photo (422-469), nav update (489-521) |
| `js/auth/auth-ui.js` | Dropdown avatar (96-179) |
| `js/auth/auth-ui-templates.js` | Dropdown avatar (23-83) |
| `js/auth/auth-cache.js` | Session cache — no photoURL (88-103, 126-169) |
| `js/auth/auth-firebase.js` | `onAuthStateChanged` + `user.reload()` (669-733) |
| `js/auth/auth-login-page.js` | Email sign-in/up, `updateProfile({displayName})` (505-510, 680-686) |
| `css/global/global-header.css` | Header avatar styles + responsive (133-231, 416-424) |
| `js/i18n/i18n-shared.js` | Avatar a11y strings ko/en (375-382) |
| `_headers` | CSP `img-src 'self' data: https:` (line 2) |

---

Refs #3583 — Keep OPEN.
Refs #3617 — completed.
Refs #3635 — completed.
Refs #3425 — Keep OPEN.
Refs #3458 — Keep OPEN.
Refs #1882 — Keep OPEN.
