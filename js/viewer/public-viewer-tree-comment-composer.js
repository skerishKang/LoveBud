/**
 * public-viewer-tree-comment-composer.js
 *
 * Authenticated whole-tree comment composer for Public Viewer.
 * Tree-target only — never uses moment/memory comment endpoints or context.
 *
 * Refs #3527, #3188, #1882
 */

(function () {
  'use strict';

  window.LoveBudPublicViewerTreeCommentComposer = {
    createPublicViewerTreeCommentComposerBoundary: null
  };

  function createPublicViewerTreeCommentComposerBoundary(deps) {
    var hasConfirmedAuthSession =
      deps && typeof deps.hasConfirmedAuthSession === 'function'
        ? deps.hasConfirmedAuthSession
        : function () {
            return false;
          };
    var createTreeComment =
      deps && typeof deps.createTreeComment === 'function'
        ? deps.createTreeComment
        : null;
    var onCreated =
      deps && typeof deps.onCreated === 'function' ? deps.onCreated : null;
    var refreshTreeComments =
      deps && typeof deps.refreshTreeComments === 'function'
        ? deps.refreshTreeComments
        : null;
    var i18n =
      deps && typeof deps.i18n === 'function'
        ? deps.i18n
        : function (k) {
            return k;
          };

    function getText(key, fallback) {
      var value = i18n(key);
      return value && value !== key ? value : fallback;
    }

    var mountEl = null;
    var formEl = null;
    var inputEl = null;
    var submitBtn = null;
    var cancelBtn = null;
    var errorEl = null;
    var successEl = null;
    var guestNoteEl = null;
    var labelEl = null;

    var activeTreeId = null;
    var instanceToken = 0;
    var panelGeneration = 0;
    var draftIdemKey = null;
    var draftBody = null;
    var inFlight = false;
    var renderedIds = Object.create(null);

    function clearDom() {
      if (formEl && formEl.parentNode) formEl.parentNode.removeChild(formEl);
      if (guestNoteEl && guestNoteEl.parentNode) {
        guestNoteEl.parentNode.removeChild(guestNoteEl);
      }
      formEl = null;
      inputEl = null;
      submitBtn = null;
      cancelBtn = null;
      errorEl = null;
      successEl = null;
      guestNoteEl = null;
      labelEl = null;
    }

    function destroy() {
      instanceToken += 1;
      inFlight = false;
      draftIdemKey = null;
      draftBody = null;
      activeTreeId = null;
      renderedIds = Object.create(null);
      clearDom();
      mountEl = null;
    }

    function appendGuestNote(host) {
      clearDom();
      guestNoteEl = document.createElement('p');
      guestNoteEl.id = 'wholeTreeCommentGuestNote';
      guestNoteEl.setAttribute('data-tree-comment-guest-note', '1');
      guestNoteEl.setAttribute('aria-live', 'polite');
      guestNoteEl.textContent = getText(
        'tree_comments_guest_note',
        '트리 전체 댓글은 읽을 수 있어요. 로그인하면 댓글을 남길 수 있어요.'
      );
      guestNoteEl.style.margin = '8px 0 0';
      guestNoteEl.style.fontSize = '0.9em';
      guestNoteEl.style.color = '#555';
      host.appendChild(guestNoteEl);
    }

    function setPending(pending) {
      inFlight = !!pending;
      if (inputEl) inputEl.disabled = !!pending;
      if (submitBtn) {
        submitBtn.disabled = !!pending;
        submitBtn.textContent = pending
          ? getText('tree_comments_submitting', '남기는 중...')
          : getText('tree_comments_submit', '등록');
      }
      if (cancelBtn) cancelBtn.disabled = !!pending;
    }

    function showError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg || '';
      errorEl.style.display = msg ? '' : 'none';
      if (successEl) successEl.style.display = 'none';
    }

    function showSuccess(msg) {
      if (!successEl) return;
      successEl.textContent = msg || '';
      successEl.style.display = msg ? '' : 'none';
      if (errorEl) errorEl.style.display = 'none';
    }

    function appendComposer(host) {
      clearDom();

      formEl = document.createElement('form');
      formEl.id = 'wholeTreeCommentComposer';
      formEl.setAttribute('data-tree-comment-composer', '1');
      formEl.style.display = 'flex';
      formEl.style.flexDirection = 'column';
      formEl.style.gap = '8px';
      formEl.style.marginTop = '10px';
      formEl.addEventListener('submit', function (e) {
        e.preventDefault();
        if (submitBtn) submitBtn.click();
      });

      labelEl = document.createElement('label');
      labelEl.id = 'wholeTreeCommentComposerLabel';
      labelEl.setAttribute('for', 'wholeTreeCommentInput');
      labelEl.textContent = getText(
        'tree_comments_composer_label',
        '트리 전체에 댓글 남기기'
      );
      labelEl.style.fontSize = '12px';
      labelEl.style.fontWeight = '700';
      labelEl.style.color = 'var(--on-surface)';

      inputEl = document.createElement('textarea');
      inputEl.id = 'wholeTreeCommentInput';
      inputEl.setAttribute(
        'aria-label',
        getText('tree_comments_input_label', '트리 전체 댓글 입력')
      );
      inputEl.placeholder = getText(
        'tree_comments_input_placeholder',
        '이 트리 전체에 남기고 싶은 마음을 적어보세요.'
      );
      inputEl.rows = 2;
      inputEl.maxLength = 5000;
      inputEl.style.width = '100%';
      inputEl.style.boxSizing = 'border-box';
      inputEl.style.resize = 'vertical';
      inputEl.style.minHeight = '56px';
      inputEl.style.fontSize = '13px';
      inputEl.style.padding = '8px 10px';
      inputEl.style.borderRadius = '10px';
      inputEl.style.border = '1px solid rgba(144,73,81,0.16)';

      errorEl = document.createElement('p');
      errorEl.id = 'wholeTreeCommentComposerError';
      errorEl.setAttribute('role', 'status');
      errorEl.setAttribute('aria-live', 'polite');
      errorEl.style.display = 'none';
      errorEl.style.margin = '0';
      errorEl.style.fontSize = '12px';
      errorEl.style.color = 'var(--error, #b3261e)';

      successEl = document.createElement('p');
      successEl.id = 'wholeTreeCommentComposerSuccess';
      successEl.setAttribute('role', 'status');
      successEl.setAttribute('aria-live', 'polite');
      successEl.style.display = 'none';
      successEl.style.margin = '0';
      successEl.style.fontSize = '12px';
      successEl.style.color = 'var(--primary)';

      var row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.justifyContent = 'flex-end';

      submitBtn = document.createElement('button');
      submitBtn.type = 'button';
      submitBtn.id = 'wholeTreeCommentSubmit';
      submitBtn.textContent = getText('tree_comments_submit', '등록');
      submitBtn.setAttribute(
        'aria-label',
        getText('tree_comments_submit_label', '트리 전체 댓글 등록')
      );
      submitBtn.style.minHeight = '32px';
      submitBtn.style.padding = '4px 14px';
      submitBtn.style.borderRadius = '999px';
      submitBtn.style.fontSize = '12px';
      submitBtn.style.fontWeight = '700';
      submitBtn.style.cursor = 'pointer';
      submitBtn.style.border = '1px solid rgba(144,73,81,0.18)';
      submitBtn.style.background = 'var(--primary)';
      submitBtn.style.color = '#fff';

      cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.id = 'wholeTreeCommentCancel';
      cancelBtn.textContent = getText('tree_comments_cancel', '취소');
      cancelBtn.setAttribute(
        'aria-label',
        getText('tree_comments_cancel_label', '트리 전체 댓글 작성 취소')
      );
      cancelBtn.style.minHeight = '32px';
      cancelBtn.style.padding = '4px 14px';
      cancelBtn.style.borderRadius = '999px';
      cancelBtn.style.fontSize = '12px';
      cancelBtn.style.fontWeight = '700';
      cancelBtn.style.cursor = 'pointer';
      cancelBtn.style.border = '1px solid rgba(144,73,81,0.12)';
      cancelBtn.style.background = 'transparent';
      cancelBtn.style.color = 'var(--primary)';

      var tokenAtMount = instanceToken;

      submitBtn.addEventListener('click', function () {
        if (inFlight || !submitBtn || submitBtn.disabled) return;
        if (tokenAtMount !== instanceToken) return;

        var body = (inputEl.value || '').trim();
        showError('');
        showSuccess('');
        if (!body) {
          showError(
            getText('tree_comments_empty_body', '댓글 내용을 입력해 주세요.')
          );
          return;
        }
        if (body.length > 5000) {
          showError(
            getText(
              'tree_comments_body_too_long',
              '댓글은 5,000자 이하로 입력해 주세요.'
            )
          );
          return;
        }
        if (!activeTreeId || typeof createTreeComment !== 'function') return;

        if (body !== draftBody) {
          var gen =
            window.LoveBudTreeCommentsWrite &&
            typeof window.LoveBudTreeCommentsWrite.generateIdempotencyKey ===
              'function'
              ? window.LoveBudTreeCommentsWrite.generateIdempotencyKey()
              : 'tc-' +
                Date.now().toString(36) +
                '-' +
                Math.random().toString(36).slice(2, 10);
          draftIdemKey = gen;
          draftBody = body;
        }

        var subToken = instanceToken;
        var subTreeId = activeTreeId;
        var subGen = panelGeneration;
        var subKey = draftIdemKey;

        setPending(true);

        Promise.resolve()
          .then(function () {
            return createTreeComment(subTreeId, body, subKey);
          })
          .then(function (result) {
            if (subToken !== instanceToken) return;
            if (activeTreeId !== subTreeId) return;
            if (subGen !== panelGeneration) return;

            setPending(false);

            if (!result || result.ok !== true) {
              showError(
                getText(
                  'tree_comments_write_failed',
                  '댓글을 남기지 못했어요. 다시 시도해 주세요.'
                )
              );
              return;
            }

            // Success
            inputEl.value = '';
            draftIdemKey = null;
            draftBody = null;
            showSuccess(
              getText('tree_comments_write_success', '댓글을 남겼어요.')
            );

            var comment = result.comment;
            if (comment && comment.id) {
              if (!renderedIds[comment.id]) {
                renderedIds[comment.id] = true;
                if (typeof onCreated === 'function') {
                  onCreated(comment);
                }
              }
            } else if (typeof refreshTreeComments === 'function') {
              refreshTreeComments();
            }
          })
          .catch(function () {
            if (subToken !== instanceToken) return;
            if (activeTreeId !== subTreeId) return;
            if (subGen !== panelGeneration) return;
            setPending(false);
            showError(
              getText(
                'tree_comments_write_failed',
                '댓글을 남기지 못했어요. 다시 시도해 주세요.'
              )
            );
          });
      });

      cancelBtn.addEventListener('click', function () {
        if (inFlight || !cancelBtn || cancelBtn.disabled) return;
        if (tokenAtMount !== instanceToken) return;
        inputEl.value = '';
        draftIdemKey = null;
        draftBody = null;
        showError('');
        showSuccess('');
      });

      row.appendChild(cancelBtn);
      row.appendChild(submitBtn);
      formEl.appendChild(labelEl);
      formEl.appendChild(inputEl);
      formEl.appendChild(errorEl);
      formEl.appendChild(successEl);
      formEl.appendChild(row);
      host.appendChild(formEl);
    }

    /**
     * @param {{ open:boolean, treeId?:string, generation?:number, mountEl?:Element }} state
     */
    function update(state) {
      if (!state || !state.open) {
        destroy();
        return;
      }

      var host = state.mountEl || mountEl;
      if (!host) {
        destroy();
        return;
      }
      mountEl = host;

      var treeId =
        typeof state.treeId === 'string' ? state.treeId.trim() : activeTreeId;
      if (!treeId) {
        destroy();
        return;
      }

      if (typeof state.generation === 'number') {
        panelGeneration = state.generation;
      }

      if (activeTreeId && activeTreeId !== treeId) {
        // Tree context changed — invalidate drafts and rendered id set
        instanceToken += 1;
        draftIdemKey = null;
        draftBody = null;
        renderedIds = Object.create(null);
      }
      activeTreeId = treeId;

      if (!hasConfirmedAuthSession()) {
        instanceToken += 1;
        draftIdemKey = null;
        draftBody = null;
        inFlight = false;
        appendGuestNote(host);
        return;
      }

      if (typeof createTreeComment !== 'function') {
        destroy();
        return;
      }

      if (!formEl || formEl.parentNode !== host) {
        instanceToken += 1;
        appendComposer(host);
      }
    }

    return {
      update: update,
      destroy: destroy
    };
  }

  window.LoveBudPublicViewerTreeCommentComposer.createPublicViewerTreeCommentComposerBoundary =
    createPublicViewerTreeCommentComposerBoundary;
})();
