window.LoveBudEditorCanvasNode = {
  resolveNodeHighlightText(memory) {
    if (Array.isArray(memory.emotionTags) && memory.emotionTags.length > 0) {
      return `#${String(memory.emotionTags[0] || '').replace(/^#/, '')}`;
    }

    const memo = String(memory.memo || '').trim();
    if (!memo) return '';
    return memo.length > 18 ? `${memo.slice(0, 18)}…` : memo;
  },

  appendNodeInfo(nodeEl, memory) {
    const infoLabel = document.createElement('div');
    infoLabel.className = 'node-info-label';

    const titleEl = document.createElement('p');
    titleEl.className = 'node-title';
    titleEl.textContent = memory.title || '';

    const dateEl = document.createElement('p');
    dateEl.className = 'node-date';
    dateEl.textContent = memory.timestamp || '';

    const highlightText = this.resolveNodeHighlightText(memory);
    const moodEl = document.createElement('p');
    moodEl.className = 'node-mood';
    moodEl.textContent = highlightText;
    moodEl.style.display = highlightText ? 'block' : 'none';

    infoLabel.appendChild(titleEl);
    infoLabel.appendChild(dateEl);
    infoLabel.appendChild(moodEl);
    nodeEl.appendChild(infoLabel);
  }
};
