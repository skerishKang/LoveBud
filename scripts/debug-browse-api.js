/**
 * LoveBud 둘러보기 API 디버깅 스크립트
 * 브라우저 콘솔에 복사해서 실행하세요
 */

const BrowseAPIDebugger = {
  // A. 두 API 응답 요약 확인
  async checkBasic() {
    const [treesRes, memoriesRes] = await Promise.all([
      fetch('/api/community/trees'),
      fetch('/api/community/memories')
    ]);

    const trees = await treesRes.json();
    const memories = await memoriesRes.json();

    console.log('trees status:', treesRes.status);
    console.log('memories status:', memoriesRes.status);
    console.log('public trees raw:', trees);
    console.log('public memories raw:', memories);

    const treeList = Array.isArray(trees) ? trees : [];
    const memoryList = Array.isArray(memories) ? memories : [];

    console.table(treeList.map(t => ({
      id: t.id ?? t.data?.id ?? null,
      title: t.title ?? t.data?.title ?? '',
      visibility: t.visibility ?? t.data?.visibility ?? '',
      ownerId: t.ownerId ?? t.owner_id ?? t.data?.ownerId ?? t.data?.owner_id ?? ''
    })));

    console.table(memoryList.slice(0, 20).map(m => ({
      id: m.id ?? m.data?.id ?? null,
      treeId: m.treeId ?? m.tree_id ?? m.data?.treeId ?? m.data?.tree_id ?? null,
      title: m.title ?? m.data?.title ?? '',
      visibility: m.visibility ?? m.data?.visibility ?? '',
      createdAt: m.createdAt ?? m.created_at ?? m.data?.createdAt ?? m.data?.created_at ?? ''
    })));

    return { trees: treeList, memories: memoryList };
  },

  // B. 공개 트리별 매칭되는 memory 수 확인
  async checkMatching() {
    const [trees, memories] = await Promise.all([
      fetch('/api/community/trees').then(r => r.json()),
      fetch('/api/community/memories').then(r => r.json())
    ]);

    const treeList = Array.isArray(trees) ? trees : [];
    const memoryList = Array.isArray(memories) ? memories : [];

    const normalizeTree = (t) => ({
      id: t.id ?? t.data?.id ?? null,
      title: t.title ?? t.data?.title ?? '',
      visibility: t.visibility ?? t.data?.visibility ?? ''
    });

    const normalizeMemory = (m) => ({
      id: m.id ?? m.data?.id ?? null,
      treeId: m.treeId ?? m.tree_id ?? m.data?.treeId ?? m.data?.tree_id ?? null,
      visibility: m.visibility ?? m.data?.visibility ?? '',
      title: m.title ?? m.data?.title ?? ''
    });

    const rows = treeList.map(normalizeTree).map(tree => {
      const matched = memoryList
        .map(normalizeMemory)
        .filter(m => m.treeId === tree.id);

      return {
        treeId: tree.id,
        treeTitle: tree.title,
        treeVisibility: tree.visibility,
        matchedMemoryCount: matched.length,
        matchedMemoryIds: matched.map(m => m.id).join(', ')
      };
    });

    console.table(rows);
    return rows;
  },

  // C. 특정 트리가 API에 잡히는지 직접 확인
  async checkTreeById(targetTreeId) {
    const [trees, memories] = await Promise.all([
      fetch('/api/community/trees').then(r => r.json()),
      fetch('/api/community/memories').then(r => r.json())
    ]);

    const tree = (Array.isArray(trees) ? trees : []).find(t =>
      (t.id ?? t.data?.id) === targetTreeId
    );

    const matchedMemories = (Array.isArray(memories) ? memories : []).filter(m =>
      (m.treeId ?? m.tree_id ?? m.data?.treeId ?? m.data?.tree_id) === targetTreeId
    );

    console.log('target tree:', tree);
    console.log('matched memories:', matchedMemories);

    return { tree, matchedMemories };
  },

  // 전체 진단 실행
  async runFullDiagnostic(targetTreeId = null) {
    console.log('=== LoveBud Browse API 진단 시작 ===');
    
    console.log('\n[1/3] 기본 API 응답 확인');
    const { trees, memories } = await this.checkBasic();
    
    console.log('\n[2/3] 트리-메모리 매칭 확인');
    await this.checkMatching();
    
    if (targetTreeId) {
      console.log(`\n[3/3] 특정 트리(${targetTreeId}) 상세 확인`);
      await this.checkTreeById(targetTreeId);
    }
    
    console.log('\n=== 진단 완료 ===');
    console.log(`총 ${trees.length}개 public 트리, ${memories.length}개 public 메모리`);
    
    return { trees, memories };
  }
};

// 전역으로 노출
window.BrowseAPIDebugger = BrowseAPIDebugger;

// 사용법:
// BrowseAPIDebugger.runFullDiagnostic()  // 전체 진단
// BrowseAPIDebugger.checkBasic()         // 기본 확인
// BrowseAPIDebugger.checkMatching()      // 매칭 확인
// BrowseAPIDebugger.checkTreeById('YOUR_TREE_ID')  // 특정 트리 확인
