(function () {
  var nodeHelpers = {};

  var sanitizeTitle = function sanitizeTitle(value, fallback) {
    var classifier = window.LoveBudTreeWorkspaceClassifier;
    if (classifier && typeof classifier.sanitizeDisplayTitle === 'function') {
      return classifier.sanitizeDisplayTitle(value, fallback);
    }
    return value || fallback || '';
  };

  nodeHelpers.hideNodeSkeleton = function hideNodeSkeleton(img, skeleton) {
    img.classList.add('loaded');
    skeleton.style.display = 'none';
  };

  nodeHelpers.handleNodeImageError = function handleNodeImageError(img, skeleton) {
    var currentSrc = img.getAttribute('src') || '';
    if (currentSrc.indexOf('/hqdefault.jpg') !== -1) {
      img.src = currentSrc.replace('/hqdefault.jpg', '/mqdefault.jpg');
      return;
    }
    if (currentSrc.indexOf('/mqdefault.jpg') !== -1) {
      img.src = currentSrc.replace('/mqdefault.jpg', '/default.jpg');
      return;
    }
    img.style.display = 'none';
    skeleton.classList.add('error');
    skeleton.textContent = '\u266A';
  };

  nodeHelpers.createNodeImageSection = function createNodeImageSection(mem, resolveThumbnail) {
    var imgWrapper = document.createElement('div');
    imgWrapper.className = 'node-img-wrapper';
    var skeleton = document.createElement('div');
    skeleton.className = 'node-skeleton';
    imgWrapper.appendChild(skeleton);
    var img = document.createElement('img');
    img.src = typeof resolveThumbnail === 'function' ? resolveThumbnail(mem) :
        (window.LoveBudEditorHelpers && window.LoveBudEditorHelpers.safeUrl
            ? window.LoveBudEditorHelpers.safeUrl(mem && mem.thumbnail || '')
            : (mem && mem.thumbnail || ''));
    img.alt = sanitizeTitle(mem.title, '순간 이미지');
    img.draggable = false;
    img.addEventListener('dragstart', function (e) { e.preventDefault(); });
    img.onload = function () { nodeHelpers.hideNodeSkeleton(img, skeleton); };
    img.onerror = function () { nodeHelpers.handleNodeImageError(img, skeleton); };
    if (img.complete) {
      nodeHelpers.hideNodeSkeleton(img, skeleton);
    }
    imgWrapper.appendChild(img);
    return imgWrapper;
  };

  nodeHelpers.createNodeCard = function createNodeCard(mem, resolveThumbnail) {
    var card = document.createElement('div');
    card.className = 'node-card';
    var imgWrapper = nodeHelpers.createNodeImageSection(mem, resolveThumbnail);
    card.appendChild(imgWrapper);
    return card;
  };

  nodeHelpers.applyNodePosition = function applyNodePosition(nodeEl, pos, constants, mem) {
    var nodeHalf = (constants && constants.NODE_HALF) || 44;
    var scale = (constants && constants.scale) || 1;
    var delay = (mem && (mem.delay || '0s')) || '0s';
    nodeEl.style.left = (pos.x - nodeHalf) + 'px';
    nodeEl.style.top = (pos.y - nodeHalf) + 'px';
    nodeEl.style.transform = 'scale(' + scale + ')';
    nodeEl.style.transformOrigin = 'center center';
    nodeEl.style.animationDelay = delay;
  };

  nodeHelpers.setupNodeElement = function setupNodeElement(nodeEl, mem) {
    nodeEl.className = 'memory-node floating-node';
    nodeEl.dataset.memoryId = mem.id;
    nodeEl.draggable = false;
    nodeEl.tabIndex = 0;
    nodeEl.setAttribute('role', 'button');
    var safeTitle = sanitizeTitle(mem.title, '');
    var ariaLabel = safeTitle ? safeTitle + ' \uC120\uD0DD' : '\uC21C\uAC04 \uC120\uD0DD';
    nodeEl.setAttribute('aria-label', ariaLabel);
    nodeEl.style.touchAction = 'none';
  };

  nodeHelpers.createNodeElement = function createNodeElement(mem, pos, deps) {
    var nodeEl = document.createElement('div');
    nodeHelpers.setupNodeElement(nodeEl, mem);
    var constants = deps ? { NODE_HALF: deps.NODE_HALF, scale: deps.scale } : {};
    nodeHelpers.applyNodePosition(nodeEl, pos, constants, mem);
    nodeEl.appendChild(nodeHelpers.createNodeCard(mem, deps ? deps.resolveMemoryThumbnail : null));
    return nodeEl;
  };

  nodeHelpers.resolveNodeHighlightText = function resolveNodeHighlightText(memory) {
    if (Array.isArray(memory.emotionTags) && memory.emotionTags.length > 0) {
      return '#' + String(memory.emotionTags[0] || '').replace(/^#/, '');
    }
    var memo = String(memory.memo || '').trim();
    if (!memo) return '';
    return memo.length > 18 ? (memo.slice(0, 18) + '\u2026') : memo;
  };

  nodeHelpers.appendNodeInfo = function appendNodeInfo(nodeEl, memory) {
    var infoLabel = document.createElement('div');
    infoLabel.className = 'node-info-label';
    var titleEl = document.createElement('p');
    titleEl.className = 'node-title';
    titleEl.textContent = sanitizeTitle(memory.title, '순간');
    var dateEl = document.createElement('p');
    dateEl.className = 'node-date';
    dateEl.textContent = memory.timestamp || '';
    var highlightText = nodeHelpers.resolveNodeHighlightText(memory);
    var moodEl = document.createElement('p');
    moodEl.className = 'node-mood';
    moodEl.textContent = highlightText;
    moodEl.style.display = highlightText ? 'block' : 'none';
    infoLabel.appendChild(titleEl);
    infoLabel.appendChild(dateEl);
    infoLabel.appendChild(moodEl);
    nodeEl.appendChild(infoLabel);
  };

  window.LoveBudEditorCanvasNode = nodeHelpers;
})();
