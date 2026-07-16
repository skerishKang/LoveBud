/**
 * LoveBud — Canonical appreciation detail presentation builder
 * Issue #3563 / parents #3475 #3519
 *
 * Single composition boundary for non-editing selected-moment presentation.
 * Route wrappers supply authority options; loaders stay route-owned.
 *
 * Authority:
 *   - owner: may include edit chip, owner action card, owner knowledge mount, write-ready social shell
 *   - public-safe: no owner authoring controls; public knowledge mount; read-only social summary shell
 *
 * Does not load trees, authenticate, or write.
 */
(function (global) {
  'use strict';

  var DEFAULT_OWNER = {
    authority: 'owner',
    routeAuthority: 'owner',
    includeOwnerEditChip: true,
    includeOwnerActions: true,
    includeAtlasMount: true,
    knowledgeMode: 'owner',
    socialMode: 'owner-interactive',
    initialHidden: true,
    treeStatusLabel: '현재 선택한 순간',
    momentBadgeLabel: '현재 선택한 순간',
    momentInfoLabel: '기록',
    dateLabel: '기억한 날',
    tagsLabel: '감정 태그',
    knowledgeLabel: '연결된 지식',
    memoLabel: '감정 메모',
    actionsLabel: '이 순간에서',
    viewMomentLabel: '현재 순간 감상하기',
    continueLabel: '이 순간에서 이어가기'
  };

  var DEFAULT_PUBLIC_SAFE = {
    authority: 'public-safe',
    routeAuthority: 'public-safe',
    includeOwnerEditChip: false,
    includeOwnerActions: false,
    includeAtlasMount: false,
    knowledgeMode: 'public',
    socialMode: 'public-readonly',
    initialHidden: false,
    treeStatusLabel: '현재 트리',
    momentBadgeLabel: '선택한 순간',
    momentInfoLabel: '기록',
    dateLabel: '기억한 날',
    tagsLabel: '감정 태그',
    knowledgeLabel: '연결된 지식',
    memoLabel: '감정 메모'
  };

  function mergeOptions(options) {
    var input = options && typeof options === 'object' ? options : {};
    var base = input.authority === 'public-safe' ? DEFAULT_PUBLIC_SAFE : DEFAULT_OWNER;
    var out = {};
    var key;
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key];
    }
    for (key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
        out[key] = input[key];
      }
    }
    return out;
  }

  function knowledgeBlock(opts) {
    if (opts.knowledgeMode === 'public') {
      return (
        '<div class="detail-info-group detail-info-group-knowledge" id="detailPublicKnowledgeGroup" hidden>' +
        '<label id="detailPublicKnowledgeLabel">' + opts.knowledgeLabel + '</label>' +
        '<ul id="detailPublicKnowledgeList" class="public-viewer-knowledge-list"></ul>' +
        '</div>'
      );
    }
    return (
      '<div class="detail-info-group detail-info-group-knowledge" id="detailOwnerKnowledgeGroup" hidden>' +
      '<label id="detailOwnerKnowledgeLabel">' + opts.knowledgeLabel + '</label>' +
      '<ul id="detailOwnerKnowledgeList" class="editor-owner-knowledge-list"></ul>' +
      '</div>'
    );
  }

  function ownerEditChip(opts) {
    if (!opts.includeOwnerEditChip) return '';
    return (
      '<button type="button" class="editor-moment-edit-chip" id="editMemoryBtn" aria-label="순간 수정">' +
      '<span class="editor-action-btn-label" id="editMemoryBtnLabel">순간 수정</span>' +
      '</button>'
    );
  }

  function ownerActionsCard(opts) {
    if (!opts.includeOwnerActions) return '';
    return (
      '<div class="editor-moment-actions-card" data-authority-slot="owner-actions">' +
      '<div class="editor-section-eyebrow" id="detailActionsPrimaryLabel">' + opts.actionsLabel + '</div>' +
      '<div class="editor-action-list">' +
      '<button type="button" class="editor-action-btn editor-action-btn-primary" id="viewMomentDetailBtn">' +
      '<span class="material-symbols-outlined" aria-hidden="true">visibility</span>' +
      '<span class="editor-action-btn-label" id="viewMomentDetailBtnLabel">' + opts.viewMomentLabel + '</span>' +
      '</button>' +
      '<button type="button" class="editor-action-btn editor-action-btn-secondary" id="continueFromMomentBtn">' +
      '<span class="material-symbols-outlined" aria-hidden="true">add_circle</span>' +
      '<span class="editor-action-btn-label" id="continueFromMomentBtnLabel">' + opts.continueLabel + '</span>' +
      '</button>' +
      '</div></div>'
    );
  }

  function atlasMount(opts) {
    if (!opts.includeAtlasMount) return '';
    return '<div id="detailAtlasPreviewMount" class="editor-memory-atlas-preview-mount" hidden data-authority-slot="owner-atlas"></div>';
  }

  function socialOwnerInteractive() {
    return (
      '<div class="editor-moment-reactions-card editor-moment-social-card" id="momentReactionsCard" ' +
      'aria-label="순간 반응과 댓글" data-social-state="hidden" data-social-mode="owner-interactive" ' +
      'style="font-variant-numeric:tabular-nums;">' +
      '<button type="button" id="momentReactionLikeButton" ' +
      'class="public-viewer-social-status editor-like-button editor-moment-reaction" ' +
      'aria-label="좋아요 누르기" aria-pressed="false" disabled>' +
      '<span class="editor-reaction-like-icon" aria-hidden="true">🤍</span>' +
      '<span class="editor-reaction-label">좋아요</span>' +
      '<span class="public-viewer-social-status-value" id="momentReactionLikeValue">⋯</span>' +
      '</button>' +
      '<p id="momentReactionLikeGuestNote" style="display:none">로그인하면 이 순간에 반응하고 댓글을 남길 수 있어요.</p>' +
      '<div aria-live="polite" role="status" id="momentReactionLikeStatusRegion" style="display:none"></div>' +
      '<p id="momentReactionWriteError" class="editor-like-error" role="alert" style="display:none"></p>' +
      '<button type="button" id="momentReactionCommentStatus" ' +
      'class="public-viewer-social-status editor-comment-toggle editor-moment-reaction" ' +
      'aria-label="댓글 열기" aria-expanded="false" aria-controls="momentCommentsPanel" disabled>' +
      '<span class="editor-reaction-comment-icon" aria-hidden="true">💬</span>' +
      '<span class="editor-reaction-label">댓글</span>' +
      '<span class="public-viewer-social-status-value" id="momentReactionCommentValue">⋯</span>' +
      '</button>' +
      '<section id="momentCommentsPanel" class="editor-moment-comments-panel" aria-label="순간 댓글" hidden>' +
      '<p id="momentCommentsPanelStatus" class="editor-moment-comments-status" role="status" aria-live="polite">댓글을 불러오는 중이에요.</p>' +
      '<ul id="momentCommentsList" class="editor-moment-comments-list"></ul>' +
      '<form id="momentCommentComposer" class="editor-moment-comment-composer">' +
      '<label for="momentCommentInput">이 순간에 댓글 남기기</label>' +
      '<div class="editor-moment-comment-input-row">' +
      '<textarea id="momentCommentInput" rows="2" maxlength="5000" placeholder="이 순간에 떠오른 마음을 남겨보세요."></textarea>' +
      '<button id="momentCommentSubmitBtn" type="submit" aria-label="댓글 등록">' +
      '<span class="material-symbols-outlined" aria-hidden="true">send</span><span>등록</span>' +
      '</button></div>' +
      '<p id="momentCommentFeedback" class="editor-moment-comment-feedback" role="status" aria-live="polite"></p>' +
      '</form></section></div>'
    );
  }

  function socialPublicReadonly() {
    return (
      '<div class="editor-moment-reactions-card is-read-only is-public-readonly" id="momentReactionsCard" ' +
      'aria-label="순간 반응 (읽기 전용)" data-read-only-summary="true" data-social-loading="true" ' +
      'data-social-mode="public-readonly" style="font-variant-numeric:tabular-nums;">' +
      '<div class="public-viewer-social-status" id="momentReactionLikeStatus" role="status" aria-label="좋아요 불러오는 중">' +
      '<span class="editor-reaction-like-icon" aria-hidden="true">🤍</span>' +
      '<span class="editor-reaction-label">좋아요</span>' +
      '<span class="public-viewer-social-status-value" id="momentReactionLikeValue">⋯</span>' +
      '</div>' +
      '<button type="button" id="momentReactionLikeButton" class="editor-like-button" ' +
      'aria-label="좋아요 누르기" aria-pressed="false" disabled style="display:none"></button>' +
      '<p id="momentReactionLikeGuestNote" style="display:none">로그인하면 이 순간에 반응하고 댓글을 남길 수 있어요.</p>' +
      '<div aria-live="polite" role="status" id="momentReactionLikeStatusRegion" style="display:none"></div>' +
      '<p id="momentReactionWriteError" class="editor-like-error" role="alert" style="display:none"></p>' +
      '<button type="button" id="momentReactionCommentStatus" ' +
      'class="public-viewer-social-status editor-comment-toggle" aria-label="댓글 불러오는 중" ' +
      'aria-expanded="false" aria-controls="momentCommentsPanel" disabled>' +
      '<span class="editor-reaction-comment-icon" aria-hidden="true">💬</span>' +
      '<span class="editor-reaction-label">댓글</span>' +
      '<span class="public-viewer-social-status-value" id="momentReactionCommentValue">⋯</span>' +
      '</button>' +
      '<section id="momentCommentsPanel" class="editor-moment-comments-panel" aria-label="순간 댓글" hidden>' +
      '<p id="momentCommentsPanelStatus" role="status" aria-live="polite"></p>' +
      '<ul id="momentCommentsList" class="editor-moment-comments-list"></ul>' +
      '</section>' +
      '<p class="editor-moment-reaction-readonly-note" id="momentReactionNote">반응 정보를 불러오는 중이에요.</p>' +
      '</div>'
    );
  }

  function socialBlock(opts) {
    return opts.socialMode === 'public-readonly' ? socialPublicReadonly() : socialOwnerInteractive();
  }

  /**
   * Tree-scope shell for the left rail (#3562).
   * Controllers still resolve #detailTreeMetaMount by stable id.
   * This must not appear inside selected-moment detailViewMode.
   * @param {object} [options]
   * @returns {string}
   */
  function buildTreeScopeShellHtml(options) {
    var opts = mergeOptions(options);
    var authority = opts.routeAuthority || opts.authority || 'owner';
    return (
      '<section class="editor-tree-meta-section appreciation-tree-scope" id="detailTreeMetaSection" ' +
      'data-canonical-section="tree-scope" data-appreciation-region="tree-scope" ' +
      'data-route-authority="' + authority + '" ' +
      'data-presentation-builder="LoveBudCanonicalAppreciationDetailPresentation" ' +
      'data-tree-scope-source="LoveBudCanonicalAppreciationDetailPresentation" ' +
      'aria-label="' + opts.treeStatusLabel + '">' +
      '<div class="editor-section-eyebrow" id="detailTreeStatusLabel">' + opts.treeStatusLabel + '</div>' +
      '<div id="detailTreeMetaMount" data-tree-scope-mount="true" ' +
      'data-tree-scope-source="LoveBudCanonicalAppreciationDetailPresentation"></div>' +
      '</section>'
    );
  }

  /**
   * Selected-moment detailViewMode HTML (right rail). Issue #3562:
   * tree-level content is owned by tree-scope (left), not this shell.
   * @param {object} [options]
   * @returns {string}
   */
  function buildDetailViewModeHtml(options) {
    var opts = mergeOptions(options);
    var hiddenAttr = opts.initialHidden
      ? ' class="editor-hidden-initial" style="display: none;"'
      : ' class="editor-hidden-initial"';
    return (
      '<div id="detailViewMode"' + hiddenAttr +
      ' data-appreciation-surface="canonical"' +
      ' data-appreciation-region="selected-moment"' +
      ' data-route-authority="' + opts.routeAuthority + '"' +
      ' data-presentation-builder="LoveBudCanonicalAppreciationDetailPresentation">' +
      '<div class="editor-current-moment-card" data-canonical-section="selected-moment">' +
      '<div class="editor-current-moment-head">' +
      '<div id="detailCurrentMomentBadge" class="editor-current-moment-badge">' + opts.momentBadgeLabel + '</div>' +
      ownerEditChip(opts) +
      '</div>' +
      '<h4 id="detailCurrentMomentTitle" class="editor-current-moment-title">&nbsp;</h4>' +
      '<p id="detailCurrentMomentHint" class="editor-current-moment-hint">&nbsp;</p>' +
      '<div class="detail-video">' +
      '<img id="detailImg" src="" alt="">' +
      '<div class="memory-preview-overlay">' +
      '<button type="button" class="play-btn" aria-label="재생">재생</button>' +
      '</div></div></div>' +
      '<div class="editor-moment-info-card" data-canonical-section="moment-info">' +
      '<div class="editor-section-eyebrow" id="detailMomentInfoLabel">' + opts.momentInfoLabel + '</div>' +
      '<div class="detail-info-group is-compact" id="detailDateGroup">' +
      '<label id="detailDateLabel">' + opts.dateLabel + '</label>' +
      '<p id="detailDateText"></p></div>' +
      '<div class="detail-info-group is-compact" id="detailTagsGroup">' +
      '<label id="detailTagsLabel">' + opts.tagsLabel + '</label>' +
      '<div class="tags-container" id="detailTags"></div></div>' +
      knowledgeBlock(opts) +
      '<div class="detail-info-group" id="detailMemoGroup">' +
      '<label id="detailMemoLabel">' + opts.memoLabel + '</label>' +
      '<div class="diary-note" id="detailMemo"></div></div></div>' +
      atlasMount(opts) +
      ownerActionsCard(opts) +
      '<div data-canonical-section="moment-social">' + socialBlock(opts) + '</div>' +
      '</div>'
    );
  }

  /**
   * Mount into placeholder element by id (replaces outerHTML).
   * @param {string} mountId
   * @param {object} [options]
   * @param {Document} [doc]
   * @returns {boolean}
   */
  function mountDetailViewMode(mountId, options, doc) {
    var documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef || typeof documentRef.getElementById !== 'function') return false;
    var mount = documentRef.getElementById(mountId || 'editorDetailViewModeTemplateMount');
    if (!mount) return false;
    mount.outerHTML = buildDetailViewModeHtml(options);
    return true;
  }

  /**
   * Normalize HTML for equivalence checks: drop authority slots & attributes.
   * @param {string} html
   * @returns {string}
   */
  function normalizeBasePresentationHtml(html) {
    return String(html || '')
      .replace(/data-authority-slot="[^"]*"/g, '')
      .replace(/data-route-authority="[^"]*"/g, '')
      .replace(/data-social-mode="[^"]*"/g, '')
      .replace(/data-social-state="[^"]*"/g, '')
      .replace(/data-read-only-summary="[^"]*"/g, '')
      .replace(/data-social-loading="[^"]*"/g, '')
      .replace(/style="display:\s*none;?"/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract only shared canonical section markers for cross-authority compare.
   * @param {string} html
   * @returns {string[]}
   */
  function listCanonicalSections(html) {
    var sections = [];
    var re = /data-canonical-section="([^"]+)"/g;
    var m;
    while ((m = re.exec(String(html || '')))) {
      sections.push(m[1]);
    }
    return sections;
  }

  /**
   * Selected-moment region section markers only (no tree-scope).
   * Tree-scope markers live on the left-rail shell from buildTreeScopeShellHtml.
   */
  function listSelectedMomentSections(html) {
    return listCanonicalSections(html).filter(function (s) {
      return s !== 'tree-scope' && s !== 'tree-meta';
    });
  }

  var api = {
    buildTreeScopeShellHtml: buildTreeScopeShellHtml,
    buildDetailViewModeHtml: buildDetailViewModeHtml,
    mountDetailViewMode: mountDetailViewMode,
    normalizeBasePresentationHtml: normalizeBasePresentationHtml,
    listCanonicalSections: listCanonicalSections,
    listSelectedMomentSections: listSelectedMomentSections,
    DEFAULT_OWNER: DEFAULT_OWNER,
    DEFAULT_PUBLIC_SAFE: DEFAULT_PUBLIC_SAFE,
    BUILDER_ID: 'LoveBudCanonicalAppreciationDetailPresentation',
    TREE_SCOPE_MOUNT_ID: 'detailTreeMetaMount',
    TREE_SCOPE_SECTION_ID: 'detailTreeMetaSection'
  };

  global.LoveBudCanonicalAppreciationDetailPresentation = api;
})(typeof window !== 'undefined' ? window : globalThis);
