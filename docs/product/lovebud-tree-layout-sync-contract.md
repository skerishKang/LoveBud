# Contract: LoveBud Cross-Platform Layout Sync (#3056)
v20260702-sync-architecture-1

## 1. 목적 및 배경
현재 LoveBud의 트리 레이아웃(노드 좌표)은 브라우저의 `localStorage`에 저장되어, 사용자가 기기를 변경(예: 데스크탑 $\rightarrow$ 모바일)하면 배치 정보가 유실되고 기본 레이아웃으로 리셋되는 문제가 발생한다.

본 계약은 레이아웃 저장의 중심축을 **Local Storage $\rightarrow$ Server (Neon/Cloud)**로 이동시켜, 어떤 기기에서 접속하더라도 주인이 정성껏 배치한 레이아웃이 동일하게 유지되는 **'심리스한 멀티 디바이스 경험'**을 제공하는 것을 목적으로 한다.

---

## 2. 범위 (Scope)
- **대상 데이터**: `positions` (노드별 x, y 좌표), `layoutMode` ('free' vs 'structured').
- **제외 데이터**: `offsetX`, `offsetY`, `scale` (뷰포트 상태). 이는 기기별 화면 크기와 사용자 줌 레벨에 종속적이므로 서버에 저장하지 않고 로컬에서 관리한다.
- **적용 대상**: 
  - Owner Editor: 레이아웃 수정 및 서버 저장.
  - Public/Private Viewer: 서버에서 레이아웃을 로드하여 렌더링.

---

## 3. 데이터 모델 (Data Model)

### 3.1 서버 저장 구조 (Neon/DB)
레이아웃은 `tree_layout_snapshots` (가칭) 테이블에 저장된다.

| 필드명 | 타입 | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| `tree_id` | UUID (PK) | 트리의 고유 식별자 | 1:1 관계 |
| `positions` | JSONB | `{ "memoryId": { "x": number, "y": number }, ... }` | 노드 절대 좌표 |
| `layout_mode` | String | `'free'` 또는 `'structured'` | 레이아웃 모드 |
| `updated_at` | Timestamp | 마지막 저장 일시 | 버전 관리용 |

### 3.2 클라이언트 상태 구조
서버에서 받은 `positions`를 바탕으로 현재 기기에 최적화된 `viewportState`를 생성한다.

```json
{
  "serverPositions": { ... }, // 서버에서 로드한 절대 좌표
  "localViewport": {
    "offsetX": number,
    "offsetY": number,
    "scale": number
  },
  "layoutMode": "free" | "structured"
}
```

---

## 4. 핵심 동작 규칙 (Core Rules)

### 4.1 동기화 흐름 (Sync Flow)
1. **Load**: 페이지 진입 시, 서버에서 `positions`와 `layout_mode`를 우선 로드한다.
2. **Project**: 로드된 절대 좌표를 현재 기기의 뷰포트 크기에 맞춰 계산하여 화면에 배치한다.
3. **Edit**: 편집 중 발생하는 좌표 변경은 즉시 `localViewport` 및 임시 메모리에 반영한다.
4. **Save**: 사용자가 '저장'을 누르거나 특정 체크포인트에 도달했을 때, 최종 `positions`를 서버로 전송하여 업데이트한다.

### 4.2 적응형 투영 (Adaptive Projection)
기기 간 화면 크기 차이를 극복하기 위해 **'정규화된 좌표계'**를 사용한다.

- **절대 좌표 $\rightarrow$ 화면 좌표**: 
  - 서버의 `positions`는 가상의 표준 캔버스(예: $10000 \times 10000$) 기준 좌표로 저장한다.
  - 렌더링 시 `(서버 좌표 * 현재 스케일) + 뷰포트 오프셋` 공식을 적용하여, 모바일에서도 전체 구조가 깨지지 않고 적절한 비율로 보이게 한다.
- **모바일 강제 구조화**: Portrait 모바일의 경우, 서버에 `free` 레이아웃이 있더라도 렌더링 시에는 `structured` 레이아웃을 우선 적용하여 가독성을 확보한다. (단, 서버의 `free` 데이터는 보존한다.)

### 4.3 충돌 방지 (Collision Avoidance)
- **단일 편집자 원칙**: 기본적으로 트리의 주인(Owner)만이 레이아웃을 수정할 수 있으므로, 동시 수정 충돌 가능성은 낮다.
- **Last-Write-Wins**: 여러 기기에서 동시에 편집한 경우, 가장 마지막에 '저장' 버튼을 누른 기기의 데이터가 최종본이 된다.

---

## 5. 수락 기준 (Acceptance Criteria)

- [ ] **기기 간 동기화**: 데스크탑에서 노드를 이동시킨 후 저장 $\rightarrow$ 모바일에서 접속했을 때 이동된 위치가 그대로 반영되어야 함.
- [ ] **모바일 최적화**: 모바일 접속 시, 데스크탑의 넓은 배치가 화면 밖으로 완전히 나가지 않고 적절한 줌/오프셋으로 뷰포트 안에 들어와야 함.
- [ ] **데이터 무결성**: 서버 저장/로드 과정에서 좌표 값의 정밀도 손실이 없어야 함.
- [ ] **성능**: 레이아웃 로드 과정이 전체 페이지 로딩 속도에 미치는 영향이 미비해야 함 (Async Load).

---

## 6. 비목표 (Non-goals)
- **실시간 동기화**: Google Docs처럼 실시간으로 좌표가 움직이는 기능은 포함하지 않는다. (명시적 저장 기반)
- **레이아웃 버전 히스토리**: 과거의 레이아웃으로 되돌리는 'Undo/Redo' 서버 저장 기능은 본 계약 범위 외이며, 추후 `#3058`에서 다룬다.
