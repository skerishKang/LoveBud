# Publication and Privacy UX Policy

이 문서는 LoveBud / LoveTree의 공개, 비공개, 둘러보기 소개 UX 정책을 정리합니다.

현재 CTO 결정에 따라 제품 방향은 **public-first + Plus private**으로 전환합니다. 단, 코드 수정 전 단계에서는 기존 private-first 구현을 즉시 변경하지 않고, 문서상 목표 정책과 전환 가드레일을 먼저 고정합니다.

이 문서는 UX/제품 정책 문서입니다. 결제, 권한, backend, API, DB 변경을 직접 구현하거나 확정하지 않습니다. 실제 구현은 별도 frontend/backend 작업으로 분리합니다.

---

## 1. 확정 정책 요약

1. 신규 tree는 장기적으로 `public-first` 방향으로 전환합니다.
2. 기존 private tree는 자동 public 전환하지 않고 **grandfathered private**으로 유지합니다.
3. private 생성/전환은 Plus entitlement source가 확정된 뒤 backend에서 검증합니다.
4. `public visibility`와 `browse 노출 조건`은 분리합니다.
5. createTree payload만 단독으로 `public` 변경하는 것은 금지합니다.
6. Netlify와 Modal visibility 정책은 반드시 동기화합니다.
7. 결제/권한 로직 확정 전에는 Plus private을 확정 기능처럼 과도하게 노출하지 않습니다.

---

## 2. 현재 구현 상태

현재 main 구현은 아직 private-first입니다.

- My Trees 생성 모달은 `visibility: private` payload를 보냅니다.
- backend create tree API는 public 생성 요청을 차단합니다.
- Editor의 visibility toggle은 public/private 전환을 허용하지만 Plus 권한 검증은 없습니다.
- Settings의 `프라이빗 보관` 문구는 `Plus에서 준비 중` 수준의 보조 안내입니다.

따라서 본 문서는 목표 정책을 정의하되, 현재 코드 동작과 혼동하지 않도록 다음을 명시합니다.

> 코드 전환은 frontend 단독으로 진행하지 않습니다. create tree, toggle visibility, Netlify, Modal, 권한 검증 정책을 함께 설계한 뒤 단계적으로 반영합니다.

---

## 3. 제품 해석

LoveBud / LoveTree의 공개 정책은 다음 두 개념을 분리해야 합니다.

### 3.1. public visibility

`public visibility`는 해당 tree 또는 memory가 링크/공개 접근 가능한 상태인지 나타내는 저장 상태입니다.

public-first 전환 후 신규 tree는 기본적으로 public visibility를 갖는 방향입니다.

### 3.2. browse 노출 조건

`browse 노출`은 둘러보기 화면에 소개될 수 있는 표시 조건입니다.

public tree라고 해서 즉시 둘러보기에 노출되는 것은 아닙니다. 둘러보기 노출은 품질/성장 조건을 별도로 따릅니다.

권장 기본 조건:

- tree visibility가 `public`
- public memory가 최소 3개 이상
- browse summary/display filter를 통과

이 분리는 사용자가 `공개 = 바로 둘러보기 노출`로 오해하지 않게 하기 위한 핵심 정책입니다.

---

## 4. 기존 private tree grandfathering

기존 private tree는 자동으로 public 전환하지 않습니다.

이유:

1. 기존 사용자는 private-first UX 아래에서 tree를 만들었습니다.
2. 자동 public 전환은 사용자 기대와 신뢰를 훼손할 수 있습니다.
3. production 데이터 visibility 일괄 변경은 별도 승인 없이 금지합니다.

권장 처리:

- 기존 private tree는 owner에게 계속 private으로 보입니다.
- 기존 private tree는 `grandfathered private` 상태로 유지합니다.
- 사용자가 명시적으로 public 전환할 수 있는 UX는 별도 승인 후 제공합니다.
- free user가 기존 private tree를 public으로 전환하는 것은 허용 가능 후보입니다.
- free user가 public tree를 private으로 전환하는 것은 Plus entitlement 확정 후 제한합니다.

---

## 5. UX 원칙

### 5.1. 신규 tree 생성

목표 정책은 public-first입니다.

다만 구현 전환 전까지는 현재 private-first payload를 단독으로 바꾸면 안 됩니다. public-first 전환은 다음이 함께 준비된 뒤 진행합니다.

- frontend 생성 UX
- Netlify create tree 정책
- Modal create tree 정책
- browse display filter 정합성
- Plus entitlement source
- 기존 private tree grandfathering 처리

전환 후 권장 생성 UX:

- 기본 안내: `새 러브트리는 공개 상태로 시작해요.`
- 보조 안내: `둘러보기에는 충분히 자란 뒤 소개돼요.`
- private 선택지는 Plus private storage로 분리하되, 결제/권한 확정 전에는 강한 판매 문구를 쓰지 않습니다.

### 5.2. 무료 사용자의 private 선택

Plus entitlement source가 확정되기 전:

- private 선택을 확정 기능처럼 노출하지 않습니다.
- `프라이빗 보관은 Plus에서 준비 중이에요.` 수준으로 안내합니다.

Plus entitlement source가 확정된 뒤:

- 무료 사용자가 private 생성/전환을 선택하면 Plus 필요 안내를 보여줍니다.
- frontend 안내와 backend 권한 검증을 함께 적용합니다.

권장 문구 후보:

> 비공개 보관은 Plus에서 사용할 수 있어요.

> 지금은 공개 상태로 시작하고, 둘러보기 소개 여부는 조건을 채운 뒤 따로 정리할 수 있어요.

### 5.3. Editor badge

현재 Editor의 `비공개 러브트리` badge는 단순 visibility 상태입니다.

public-first 전환 후에는 다음 의미를 분리해야 합니다.

| 상태 | 의미 |
|------|------|
| 공개 러브트리 | public visibility 상태 |
| 둘러보기 준비 중 | public이지만 browse 노출 조건 미충족 |
| 둘러보기 소개 가능 | public이며 browse 노출 조건 충족 |
| 비공개 보관 | Plus private 또는 grandfathered private |

### 5.4. 공개/비공개 전환 버튼 위치

공개/비공개 전환은 기본 작업 흐름을 방해하지 않는 위치에 둡니다.

권장 위치:

- Editor sidebar의 접힌 설정 패널
- My Trees card overflow menu

기본 Editor 작업 화면에 visibility 설명을 과도하게 노출하지 않습니다.

### 5.5. Settings

Settings에서 기본 공개 범위 설정을 즉시 부활시키는 것은 보류합니다.

권장 방향:

- Settings는 정책 설명과 private storage 안내 중심으로 유지합니다.
- `기본 공개 범위` 라디오는 Plus entitlement와 backend enforcement가 준비된 뒤 재검토합니다.
- 사용자가 바꿀 수 없는 정책값을 설정처럼 노출하지 않습니다.

---

## 6. API/backend 정합성 원칙

### 6.1. create tree

목표 정책:

- 신규 tree는 public-first 방향으로 전환합니다.
- 단, frontend payload만 단독 변경하지 않습니다.
- Netlify와 Modal create 정책을 동시에 동기화합니다.

현재 구현:

- Netlify create tree는 public 생성 요청을 차단합니다.
- Modal create tree도 public 생성 요청을 차단합니다.

전환 조건:

- API 계약 문서 개정
- backend create guard 개정
- Modal create guard 개정
- frontend 생성 UX 개정
- entitlement 미확정 상태에서 private 선택지를 어떻게 처리할지 결정

### 6.2. toggle visibility

목표 정책:

- public → private 전환은 Plus private 기능으로 잠급니다.
- private → public 전환은 grandfathered private 해제 또는 publish 흐름으로 취급합니다.
- Plus entitlement source가 확정되기 전에는 backend enforcement를 구현하지 않습니다.

현재 구현:

- private → public 전환은 공개 memory 3개 이상 조건을 요구합니다.
- public → private 전환에는 Plus 권한 검증이 없습니다.

전환 시 재정의 필요:

- public-first 이후에도 private → public 전환에 공개 memory 3개 조건을 둘지
- 또는 visibility 전환과 browse 소개 조건을 완전히 분리할지

권장 방향:

- visibility 전환과 browse 노출 조건은 분리합니다.
- public 전환 자체는 접근성/공개 상태입니다.
- browse 노출은 public memory 3개 이상 display filter로 관리합니다.

---

## 7. Plus entitlement decision-needed

아래 항목은 아직 미확정입니다.

- Plus entitlement source of truth
- plan 정보를 저장할 DB 위치
- free/plus 판정 API
- frontend에서 Plus 상태를 읽는 방식
- backend에서 private 생성/전환을 차단할 때 사용할 HTTP status/code
- 기존 grandfathered private tree를 Plus 없이 계속 private 유지할 기간
- 결제 UX 도입 시점

권장 API error code 후보:

```text
PLUS_REQUIRED_PRIVATE_STORAGE
```

권장 사용자 문구 후보:

> 비공개 보관은 Plus에서 사용할 수 있어요.

---

## 8. 금지 사항

- createTree payload만 단독으로 `public`으로 바꾸지 않습니다.
- Netlify만 바꾸고 Modal을 방치하지 않습니다.
- Modal만 바꾸고 Netlify를 방치하지 않습니다.
- 기존 private tree를 자동 public 전환하지 않습니다.
- Plus entitlement 없이 frontend-only lock으로 정책 완료를 선언하지 않습니다.
- 결제/권한 로직 확정 전 Plus private을 확정 기능처럼 과도하게 홍보하지 않습니다.

---

## 9. 이후 구현 분리

### Frontend 작업

- My Trees 생성 모달 public-first copy/IA
- private 선택 Plus 안내
- Editor badge 상태 분리
- Editor/My Trees visibility action 재배치
- Settings private storage 안내 조정
- i18n key 정리

### Backend 작업

- Netlify create tree policy 전환
- Netlify toggle visibility entitlement guard
- Modal create tree policy 전환
- Modal private endpoint entitlement guard
- API error contract 고정
- grandfathered private 처리 정책 반영

### Docs 작업

- API contract update
- backend.md update
- Modal runtime update
- browse filter/public visibility 용어 정리

---

## 10. 현재 문서의 적용 상태

이 문서는 정책 전환 기준 문서입니다.

현재 main 코드가 이미 public-first로 바뀌었다는 의미가 아닙니다. 코드 반영 전에는 다음 현재 구현 사실을 유지합니다.

- createTree payload는 private-first입니다.
- backend create guard는 public 생성 요청을 차단합니다.
- Modal create guard도 public 생성 요청을 차단합니다.
- Plus entitlement enforcement는 없습니다.

CTO 승인 후 별도 frontend/backend 작업에서 public-first 전환을 구현합니다.
