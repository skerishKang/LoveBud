window.LoveBudSearchState = {
    currentQuery: '',
    currentCategory: '전체',
    currentSort: 'latest',
    currentLimit: 10,
    allTrees: [],
    growingTrees: [],
    currentPreviewRequestId: 0,
    isInitialLoad: true,

    reset() {
        this.currentQuery = '';
        this.currentCategory = '전체';
        this.currentSort = 'latest';
        this.currentLimit = 10;
        this.allTrees = [];
        this.growingTrees = [];
        this.currentPreviewRequestId = 0;
        this.isInitialLoad = true;
    }
};
