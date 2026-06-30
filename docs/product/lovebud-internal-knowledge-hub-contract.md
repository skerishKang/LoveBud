# LoveBud Internal Knowledge Hub Product Contract

**Issue:** #3068  
**Status:** Contract / Design Record  
**Date:** 2026-06-30  
**Branch:** docs/internal-knowledge-hub-contract  

Refs #1882

---

## 1. 문제와 제품 목적

LoveTree의 감상 기록 방식은 사용자가 주관적으로 해석한 감정, 기억, 체험을 저장하는 **내러티브 데이터(Narrative Data)**입니다. 반면, 이 내러티브가 가리키는 외부 세계의 구체적인 대상(인물, 작품, 영상, 장소 등)은 객관적 사실에 기반한 **지식 데이터(Factual Knowledge Data)**입니다.

이 두 데이터 계층은 서로 다르게 관리되어야 합니다.

*   **Moment / LoveTree (내러티브 데이터)**: 개인의 감정, 기억, 해석, 체험.
*   **Knowledge Entity (지식 데이터)**: 검증 가능한 참고 정보, 공식 별칭, 검증된 출처, 고유 관계.

**핵심 설계 원칙 (Separation of Narrative and Fact):**
- 사용자의 주관적인 감정 기록이나 해석이 자동으로 검증된 Factual Entity로 승격(Promotion)되지 않습니다.
- Factual Entity의 객관적 정보가 사용자의 주관적인 해석이나 감정을 덮어쓰거나(Overwrite) 규정하지 않습니다.
- 둘은 오직 관계형 내부 링크(Internal Link)로만 연결되며, 독립적인 수명 주기와 소유권 경계를 유지합니다.

---

## 2. 최소 Entity 계약 (v1)

Internal Knowledge Hub에서 관리하는 Factual Entity의 v1 후보 타입(Type)과 최소 필드 사양을 다음과 같이 정의합니다.

### 2.1 Entity Types
- `person`: 아티스트, 감독, 작가 등 자연인.
- `group_or_organization`: 아이돌 그룹, 밴드, 소속사, 방송사 등 단체.
- `work`: 앨범, 트랙, 도서, 예술품 등 창작물.
- `video_or_source`: 유튜브 영상, 방송 클립, 인터뷰, 기사 등 출처 영상/자료.
- `place`: 공연장, 촬영지, 의미 있는 오프라인 장소 등.
- `event`: 콘서트, 팬미팅, 컴백일, 쇼케이스 등 시점 및 사건.
- `concept`: 팬덤 용어, 특정 세계관 개념, 음악 장르 등.

### 2.2 최소 Schema 필드
*   `id`: 고유 식별자 (Database Schema나 ID 포맷은 v1에서 확정하지 않음).
*   `type`: 상기 7가지 타입 중 하나.
*   `canonicalName`: 공식 또는 기준 명칭.
*   `aliases`: 대체 명칭 또는 별칭 목록 (검색 및 매칭 성능 향상용).
*   `summary`: 대상을 설명하는 한 줄 요약 혹은 설명글.
*   `sourceRefs`: 검증에 사용된 외부 링크 혹은 문헌 정보 목록.
*   `publicationState`: `'draft'` 또는 `'published'` 상태 표시.
*   `createdAt`: 생성 일시.
*   `updatedAt`: 수정 일시.

---

## 3. Relation 계약

Moment와 Entity, 그리고 Entity와 Entity 간의 관계형 연결(Directed Edge) 사양을 정의합니다.

### 3.1 Moment → Entity Relation Types
- `about`: 이 순간이 해당 Entity를 직관적으로 다루고 있음을 나타냄.
- `references`: 텍스트 내에서 해당 Entity를 언급하거나 인용함.
- `inspired_by`: 해당 Entity(작품, 인물 등)로부터 영감을 받아 작성됨.
- `appears_in`: 해당 Entity(영상, 장소 등)에 모먼트 속 주체가 등장하거나 다뤄짐.
- `visited_at`: 해당 장소 Entity에 방문했음을 나타냄.
- `learned_from`: 해당 Entity로부터 새로운 사실이나 감정을 배우거나 알게 됨.

### 3.2 Entity → Entity Relation Types
- `member_of`: `person`이 `group_or_organization`의 멤버임을 나타냄.
- `part_of`: 창작물이 더 큰 프로젝트나 앨범의 일부임을 나타냄 (예: 트랙 → 앨범).
- `created_by`: 창작물이 특정 인물이나 단체에 의해 제작되었음을 나타냄.
- `released_on`: 작품이나 영상이 특정 날짜/이벤트에 배포되었음을 나타냄.
- `related_to`: 기타 상호 연관성이 검증된 일반 관계.

### 3.3 Relation 속성 사양
각 Relation 정보는 최소한 다음 메타데이터를 포함해야 합니다.
- `from`: 시작점 식별자 (Moment ID 또는 Entity ID).
- `to`: 대상점 식별자 (Entity ID).
- `relationType`: 관계 유형 코드 (상기 정의된 타입).
- `sourceRefs`: 관계 성립의 근거가 되는 검증 출처.
- `visibility`: `'public'` 혹은 `'private'` (연결 가시성 권한).
- `createdBy / ownership boundary`: 이 관계를 설정한 주체 및 관리 소유권 경계.

---

## 4. Visibility 및 Privacy Matrix

개인적인 비공개 기록(Private Tree, Draft Moment)의 안전을 보장하기 위해 다음과 같은 엄격한 권한 매트릭스를 적용합니다.

| 데이터 유형 (Source) | 연결 대상 (Target) | 관계 (Relation) 가시성 | 조회/탐색 시 노출 여부 (Discovery Policy) |
|---|---|---|---|
| **public tree** / **published moment** | Public Entity | Public | 노출 허용 (Entity 페이지의 관련 스토리/그래프 등에 정상 노출) |
| **private tree** / **draft moment** | Public Entity | Private | **절대 노출 금지** (Entity 검색, Entity 상세 정보, 관계 그래프, 연관 스토리 추천 등 어떠한 경로로도 타인에게 노출 불가) |
| Public Entity | Public Entity | Public | 노출 허용 (지식 허브 네트워크 구성에 사용) |
| **private-only entity reference** | Public/Private Entity | Private | **작성자 본인에게만 노출** (타인의 지식 네트워크나 탐색 결과에서 격리) |

### 핵심 프라이버시 보장 원칙
1.  **비공개 정보의 비노출성 (Private/Draft Non-Discovery)**: 비공개 혹은 발행 대기 상태의 Tree, Moment가 지식 허브의 관계성(Entity Page, Graph, Related Stories) 탐색을 통해 제3자에게 발견되는 통로가 되지 않도록 완벽히 격리합니다.
2.  **계정 식별자 유실 차단 (Account Identifier Non-Exposure)**: 사용자의 이메일 주소, 시스템 UID, 혹은 오너 전용 로컬 메타데이터(Owner-local metadata)는 지식 허브 엔티티나 공용 릴레이션 노드 내부 데이터에 수집되거나 포함되지 않아야 합니다.
3.  **일방향 프라이버시 전이 방지**: Public Entity와 연결된 관계라 하더라도, 시작점(Moment/Tree)이 Private 상태라면 관계 데이터 전체가 Private으로 취급되어 비로그인 또는 타인 권한 환경에서 은닉됩니다.
4.  **출처 가시성 동기화**: Public Moment가 Entity와 연결되더라도, Moment 자체의 원본 접근 제어 정책(Source Visibility Policy)을 엄격히 동기화하여 준수해야 합니다.

---

## 5. Source · 검증 · 수정 책임 (Data Provenance & Governance)

지식 데이터의 신뢰성과 수명 주기를 제어하는 거버넌스 규칙입니다.

*   **Factual Claim 검증**: 지식 허브에 등록되는 Entity와 Relation은 반드시 외부 출처 레퍼런스(`sourceRef`)를 포함하거나 관리자 검증 상태(`editorial status`)를 획득해야 합니다.
*   **사용자 감상의 예외**: 사용자가 Moment에 작성한 주관적 소회나 감상은 Factual Claim 검증 기준(`sourceRef` 요구사항)의 대상이 아닙니다.
*   **출처 만료 시 복구 정책 (Broken Links)**: 연결된 외부 출처 링크가 깨지거나(Broken external source) 유실되더라도, 이미 검증 완료된 내부 지식 엔티티 자체가 즉시 삭제되지는 않으며 별도의 백업 및 재검증 프로세스를 따릅니다.
*   **엔티티 관리 및 정리 (Aliases, Merge, Deprecation)**: 동일 대상이 중복 생성된 경우Aliases를 병합(Merge)하고, 기존 관계 유실 없이 단일 Canonical Entity로 포인팅을 자동 전환합니다. 폐기(Deprecation)되거나 삭제된 엔티티는 연결을 안전하게 복원 또는 정리합니다.
*   **v1 금지 사항 (Strict No-Automation Guardrails)**:
    - AI를 이용한 자동 지식 엔티티 생성(Automatic AI fact generation) 금지.
    - AI 모델 기반의 자율 병합(Autonomous merge) 금지.
    - 사용자 모먼트 분석을 통한 자동 지식 배포(Auto-publication) 금지.
    - 모든 엔티티 생성 및 관계 정립은 승인된 Curated Fixture 혹은 사용자 수동 생성/큐레이션 기준을 따릅니다.

---

## 6. Product Surface (향후 연동 범위)

본 제품 계약이 향후 반영될 프론트엔드/백엔드 Surface 영역입니다 (v1 설계 가이드라인).

*   **Moment Detail**: 모먼트 내용 하단에 연결된 지식 엔티티 링크(`selected entity links`)를 칩(Chip) 또는 배지 형태로 표시합니다.
*   **Entity Detail**: 해당 지식 대상의 요약 정보, 출처 목록 및 **공개 설정된 다른 사용자들의 연관 모먼트/스토리 목록**을 노출합니다.
*   **Search Hub**: 검색 결과 화면에서 사용자의 스토리(Stories) 탭과 지식 허브 대상(Entities) 탭을 완전히 구분된 결과 그룹으로 분리하여 렌더링합니다.
*   **Graph Visualization (v1 비대상, 보류 원칙)**:
    - 지식 네트워크 전체를 탐색하는 Global uncontrolled graph는 v1 구현 대상에서 제외(Non-goal)합니다.
    - 추후 단계에서, 특정 엔티티를 중심으로 한 제한된 이웃 노드 탐색(Bounded Neighborhood Navigation) 형태로만 도입을 신중하게 검토합니다.
    - 그래프는 단순 시각화 유희가 아니라, 검색과 상세 페이지 간 관계 무결성이 확보된 이후에 동작하는 네비게이션 보조 수단이어야 합니다.

---

## 7. Rollout 순서

Internal Knowledge Hub는 점진적으로 배포되며 다음 순서와 의존성을 준수합니다.

1.  **Phase 1 (본 단계)**: Entity, Relation, Visibility 제품 계약 정의 및 검증 (`docs/internal-knowledge-hub-contract`).
2.  **Phase 2**: 정적 지식 데이터 피스처 정의 및 정합성 검증 (`curated fixture & validation tests`).
3.  **Phase 3**: 작성자의 모먼트 편집 시 지식 엔티티 검색 및 수동 링크 설정 기능 (`read-only lookup & link`).
4.  **Phase 4**: 엔티티 상세 정보 뷰 및 공개 설정된 양방향 관계 노출 (`entity detail & bi-directional public rendering`).
5.  **Phase 5**: 검색 허브 분리 및 필터링 기능 (`search split`).
6.  **Phase 6**: 제한된 관계형 그래프 내비게이션 도입 검토 (`bounded graph evaluation`).

---

## 8. Non-Goals (비목표)

본 계약 및 v1 범위에 속하지 않는 명시적 비목표 목록입니다.

*   데이터베이스 스키마 및 API 런타임 구현 (DB/API implementation).
*   기존 마이그레이션 스크립트 작성 (Database migration).
*   실제 아티스트 또는 영상 데이터의 대량 콘텐츠 가져오기 (Production content import).
*   외부 사이트 크롤링 및 스크래핑 엔진 도입 (External scraping).
*   외부 검색 API 연동 (External provider integration).
*   AI를 활용한 텍스트 내 자동 지식 추출 (Automatic fact extraction).
*   자율형 글로벌 그래프 생성 (Automatic graph generation).
*   사용자 프로필 디렉토리 노출 (Account directory).
*   타인의 비공개/발행대기 콘텐츠 임의 탐색 (Private content discovery).
*   기존 Editor, Browse(Search), My Trees, Auth 모듈의 런타임 코드 변경.
