#!/bin/bash
# LoveBud 둘러보기 API 디버깅 스크립트
# 사용법: ./debug-browse-api.sh [도메인]
# 예시: ./debug-browse-api.sh https://lovebud.netlify.app

DOMAIN=${1:-"https://lovebud.netlify.app"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="debug-logs"
mkdir -p "$OUTPUT_DIR"

echo "=== LoveBud Browse API 디버깅 ==="
echo "도메인: $DOMAIN"
echo "시간: $TIMESTAMP"
echo ""

# 1. 공개 트리 확인
echo "[1/4] 공개 트리 API 호출..."
curl -s "$DOMAIN/api/community/trees" | tee "$OUTPUT_DIR/trees_$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/trees_$TIMESTAMP.json"
TREE_COUNT=$(cat "$OUTPUT_DIR/trees_$TIMESTAMP.json" | jq 'length' 2>/dev/null || echo "0")
echo "→ 트리 수: $TREE_COUNT"
echo ""

# 2. 공개 메모리 확인
echo "[2/4] 공개 메모리 API 호출..."
curl -s "$DOMAIN/api/community/memories" | tee "$OUTPUT_DIR/memories_$TIMESTAMP.json" | jq '.' 2>/dev/null || cat "$OUTPUT_DIR/memories_$TIMESTAMP.json"
MEMORY_COUNT=$(cat "$OUTPUT_DIR/memories_$TIMESTAMP.json" | jq 'length' 2>/dev/null || echo "0")
echo "→ 메모리 수: $MEMORY_COUNT"
echo ""

# 3. 요약 정보 추출
echo "[3/4] 트리 요약..."
cat "$OUTPUT_DIR/trees_$TIMESTAMP.json" | jq '[.[] | {id: (.id // .data.id), title: (.title // .data.title), visibility: (.visibility // .data.visibility)}]' 2>/dev/null || echo "파싱 실패"
echo ""

echo "[4/4] 메모리 요약 (treeId 기준)..."
cat "$OUTPUT_DIR/memories_$TIMESTAMP.json" | jq '[.[] | {id: (.id // .data.id), treeId: (.treeId // .tree_id // .data.treeId // .data.tree_id), visibility: (.visibility // .data.visibility)}]' 2>/dev/null || echo "파싱 실패"
echo ""

# 4. 매칭 분석
echo "=== 매칭 분석 ==="
echo "트리별 메모리 수:"

if command -v jq &> /dev/null; then
  # jq가 있을 때 상세 분석
  cat "$OUTPUT_DIR/trees_$TIMESTAMP.json" | jq -r '.[] | (.id // .data.id)' 2>/dev/null | while read tree_id; do
    if [ ! -z "$tree_id" ]; then
      count=$(cat "$OUTPUT_DIR/memories_$TIMESTAMP.json" | jq --arg tid "$tree_id" '[.[] | select((.treeId // .tree_id // .data.treeId // .data.tree_id) == $tid)] | length' 2>/dev/null || echo "0")
      title=$(cat "$OUTPUT_DIR/trees_$TIMESTAMP.json" | jq -r --arg tid "$tree_id" '.[] | select((.id // .data.id) == $tid) | (.title // .data.title)' 2>/dev/null || echo "Unknown")
      echo "  - $tree_id ($title): $count개 메모리"
    fi
  done
else
  echo "jq가 설치되어 있지 않아 상세 분석을 건너뜁니다."
  echo "설치: https://stedolan.github.io/jq/download/"
fi

echo ""
echo "=== 로그 저장 위치 ==="
echo "트리: $OUTPUT_DIR/trees_$TIMESTAMP.json"
echo "메모리: $OUTPUT_DIR/memories_$TIMESTAMP.json"
echo ""
echo "디버깅 완료."
