# DATA_NAMING_RULE

## 목적

이 문서는 Lovetree 프로젝트의 **데이터 명명 규칙**을 정의합니다. 일관된 명명 규칙은:
- 코드 가독성 향상
- 데이터베이스 마이그레이션 용이
- 팀원 간 의사소통 원활

---

## 핵심 원칙

### 1. 한국어 기반 직역 명명

모든 데이터 명명은 **한국어 개념을 영어로 직역**합니다.

| 한국어 | 영어 | 이유 |
|--------|------|------|
| 트리 | `tree` | LoveTree의 핵심 도메인 |
| 순간/기억 | `memory` | "입덕의 순간" 개념 |
| 감정 태그 | `emotionTag` | 감정 중심 설계 |
| 입덕 경로 | `lovePath` | 팬 여정 |

### 2. Domain-Driven Naming

제품 도메인에 맞는 용어를 사용합니다:

```javascript
// ❌ 일반적인 이름
data.items
data.records
data.entries

// ✅ 도메인 특화 이름
tree.nodes        // 트리의 노드들
tree.roots        // 트리의 뿌리 (첫 순간)
memory.emotions   // 순간의 감정들
path.connections  // 경로의 연결들
```

---

## 데이터 모델 명명

### Tree (러브트리)

```typescript
interface Tree {
  id: string;              // 고유 식별자
  title: string;           // 트리 제목
  ownerId: string;         // 소유자 ID
  visibility: 'private' | 'public';  // 공개 범위
  createdAt: Date;         // 생성 시점
  updatedAt: Date;         // 마지막 수정
  rootMemoryId: string;    // 뿌리 순간 ID
}
```

### Memory Node (순간 기록)

```typescript
interface Memory {
  id: string;              // 고유 식별자
  treeId: string;          //所属 트리 ID
  parentId: string | null; // 부모 노드 ID (null = 뿌리)
  sourceUrl: string;       // 영상 URL
  sourceType: 'youtube';   // 소스 유형
  timestamp: number;       // 영상의 특정 시점 (초)
  title: string;           // 짧은 제목
  memo: string;            // 감정 메모
  emotionTags: string[];   // 감정 태그 배열
  createdAt: Date;
  updatedAt: Date;
}
```

### Emotion Tags (감정 태그)

```typescript
// 예시 감정 태그
const EMOTION_TAGS = [
  '감동',      // emotion: 'touched'
  '입덕',      // emotion: 'firstlove'
  '설렘',      // emotion: 'excited'
  '웃음',      // emotion: 'laughed'
  '울컥',      // emotion: 'tears'
  '응원',      // emotion: 'cheering'
  '공감',      // emotion: 'relatable'
  '추억',      // emotion: 'nostalgic'
];
```

---

## API 명명 규칙

### 클라이언트 → 서버

| 操作 | 메서드 | 엔드포인트 | 설명 |
|------|--------|-----------|------|
| 트리 생성 | POST | `/api/trees` | 새 러브트리 |
| 트리 목록 | GET | `/api/trees?ownerId={id}` | 내 트리 목록 |
| 트리 조회 | GET | `/api/trees/{id}` | 특정 트리 |
| 트리 수정 | PATCH | `/api/trees/{id}` | 트리 정보 수정 |
| 트리 삭제 | DELETE | `/api/trees/{id}` | 트리 삭제 |
| 순간 추가 | POST | `/api/memories` | 새 순간 기록 |
| 순간 목록 | GET | `/api/memories?treeId={id}` | 트리의 순간들 |
| 순간 수정 | PATCH | `/api/memories/{id}` | 순간 정보 수정 |
| 순간 삭제 | DELETE | `/api/memories/{id}` | 순간 삭제 |

### 요청/응답 명명

```typescript
// 요청 예시
interface CreateTreeRequest {
  title: string;
  visibility: 'private' | 'public';
}

interface CreateMemoryRequest {
  treeId: string;
  parentId: string | null;
  sourceUrl: string;
  timestamp: number;
  title: string;
  memo: string;
  emotionTags: string[];
}

// 응답 형식
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

---

## 데이터 접근 규칙

### 브라우저 (クライアント)

```javascript
// ✅ 권장: postgres-client-browser.js 로드 후
const db = window.postgresDB;
const snapshot = await db.collection('trees').where('ownerId', '==', userId).get();

// ❌ 금지: firebase-firestore-compat.js 직접 참조
// ❌ 금지: firebase.firestore() 직접 호출 (레거시 에디터만 허용)
```

### 서버 (Netlify Functions)

```javascript
// ✅ 권장: db-api.js를 공식 진입점으로 사용
const { queryPostgresCollection, getPostgresDoc } = require('./_lib/db-api');

// ❌ 금지: firestore-api.js 직접 참조 (내부 구현)
```

---

## PostgreSQL 스키마 명명

### 테이블명: 복수형, 스네이크 케이스

```sql
-- ✅ 올바른 명명
CREATE TABLE trees ();
CREATE TABLE memories ();
CREATE TABLE users ();
CREATE TABLE emotion_tags ();  -- 복수형

-- ❌ 잘못된 명명
CREATE TABLE tree ();
CREATE TABLE memory ();
CREATE TABLE User ();
```

### 컬럼명: 단수형, 카멜 케이스 (PostgreSQL 기본)

```sql
-- ✅ 올바른 명명
CREATE TABLE trees (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  owner_id UUID REFERENCES users(id),
  visibility VARCHAR(20),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- ❌ 잘못된 명명 (복수형 컬럼)
CREATE TABLE trees (
  ids UUID PRIMARY KEY,      -- ❌
  titles VARCHAR(255),       -- ❌
);
```

### 인덱스 명명

```sql
-- 형식: idx_{테이블}_{컬럼}
CREATE INDEX idx_trees_owner_id ON trees(owner_id);
CREATE INDEX idx_memories_tree_id ON memories(tree_id);
CREATE INDEX idx_memories_parent_id ON memories(parent_id);
```

---

## 파일/컴포넌트 명명

### JavaScript 파일

```javascript
// ✅ 도메인 특화 이름
src/
  ├── tree-data.js      // 트리 관련 데이터
  ├── memory-form.js    // 순간 기록 폼
  ├── emotion-tag.js    // 감정 태그
  └── path-connection.js // 경로 연결

// ❌ 일반화된 이름
src/
  ├── data.js
  ├── form.js
  ├── tag.js
  └── connection.js
```

### CSS 클래스

```css
/* ✅ 의미 기반 명명 */
.tree-node { }
.memory-card { }
.emotion-tag { }
.love-path { }

/* ❌ 기술적 명명 */
.container-1 { }
.box-2 { }
.item-3 { }
```

---

## Git 커밋 메시지 명명

```bash
# 형식: [카테고리] 설명

# ✅ 올바른 예시
git commit -m "docs: PRODUCT_IDENTITY에 Core User 섹션 추가"
git commit -m "feat: memory에 emotionTags 필드 추가"
git commit -m "fix: tree visibility 기본값을 private로 변경"

# ❌ 잘못된 예시
git commit -m "update docs"
git commit -m "fix bug"
git commit -m "changes"
```

### 카테고리前缀

| 카테고리 | 설명 |
|---------|------|
| `feat:` | 새 기능 |
| `fix:` | 버그 수정 |
| `docs:` | 문서 변경 |
| `refactor:` | 코드 리팩터링 |
| `style:` | 코드 포맷팅 (기능 변경 없음) |
| `test:` | 테스트 관련 |
| `chore:` | 기타 잡일 |

---

## 금지 사항

1. **"Firestore"라는 단어를 새로운 코드/주석에 추가 금지**
   - 기존 레거시 코드와 구분하기 위함
   - Firebase Firestore는 사용하지 않음 (PostgreSQL 사용)

2. **축약어 남용 금지**
   - `mem` → `memory` (명확한 표현 사용)
   - `ts` → `timestamp` (시간 관련은 명확히)

3. **숫자 접미사 남용 금지**
   - `container1`, `container2` → `tree-container`, `memory-container`

---

## Reference

- [PRODUCT_IDENTITY.md](PRODUCT_IDENTITY.md) - 제품 철학
- [MVP_SCOPE.md](MVP_SCOPE.md) - MVP 범위
- [AGENTS.md](../AGENTS.md) - 작업자 규칙