window.LoveBudEditorCanvasViewportFeedback = {
  showAlreadyAtFitFeedback() {
    if (window.LoveBudUI && typeof window.LoveBudUI.showToast === 'function') {
      window.LoveBudUI.showToast('이미 전체 트리가 보이고 있습니다', 'info', 2000);
    }
  },
};
