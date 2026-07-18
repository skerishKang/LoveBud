(function () {
    function createEditorDetailTreeMetaBoundary(deps) {
        const {
            i18n,
            formatI18nText,
            resolveTreeTitleText,
            createInlineIcon,
            showToast,
            openCurrentMomentDetail,
            canEdit,
            openRenameTree,
            updateTreeVisibility,
            updateDetailPanel
        } = deps;

        const PENDING_LABEL = '상태 변경 중...';
        const PENDING_ICON = 'hourglass_empty';

        const createPillButton = ({ label, icon, tone = 'soft' }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.display = 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.gap = '6px';
            btn.style.minHeight = '38px';
            btn.style.padding = tone === 'primary' ? '10px 15px' : '9px 13px';
            btn.style.borderRadius = '999px';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '800';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease';
            btn.style.border = '1px solid rgba(144,73,81,0.10)';
            btn.style.boxShadow = tone === 'primary'
                ? '0 10px 22px rgba(144, 73, 81, 0.18)'
                : '0 6px 16px rgba(75, 64, 57, 0.06)';
            btn.style.background = tone === 'primary'
                ? 'linear-gradient(180deg, rgba(144,73,81,0.98), rgba(144,73,81,0.90))'
                : 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,242,239,0.96))';
            btn.style.color = tone === 'primary'
                ? '#fff'
                : tone === 'ghost'
                    ? 'var(--on-surface-variant)'
                    : 'var(--primary)';

            if (tone === 'ghost') {
                btn.style.background = 'rgba(255,255,255,0.72)';
                btn.style.borderColor = 'rgba(144,73,81,0.08)';
            }

            if (icon) btn.appendChild(createInlineIcon(icon, '14px'));
            btn.appendChild(document.createTextNode(label));

            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-1px)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
            });

            return btn;
        };

        const createShareTreeButton = () => createPillButton({
            label: formatI18nText('share_link', '링크 복사'),
            icon: 'content_copy',
            tone: 'soft'
        });

        const createOpenDetailButton = () => createPillButton({
            label: formatI18nText('editor_open_detail', '상세로 보기'),
            icon: 'open_in_new',
            tone: 'ghost'
        });

        const createOwnerActionBtn = ({ label, icon }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.display = 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.gap = '6px';
            btn.style.minHeight = '38px';
            btn.style.padding = '9px 13px';
            btn.style.borderRadius = '999px';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '800';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease';
            btn.style.border = '1px solid rgba(144,73,81,0.10)';
            btn.style.boxShadow = '0 6px 16px rgba(75, 64, 57, 0.06)';
            btn.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,242,239,0.96))';
            btn.style.color = 'var(--primary)';

            // Create identifiable icon element
            const iconEl = document.createElement('span');
            iconEl.className = 'material-symbols-outlined';
            iconEl.dataset.ownerActionIcon = '1';
            iconEl.style.fontSize = '14px';
            iconEl.textContent = icon;
            btn.appendChild(iconEl);

            // Create identifiable label element
            const labelEl = document.createElement('span');
            labelEl.dataset.ownerActionLabel = '1';
            labelEl.textContent = label;
            btn.appendChild(labelEl);

            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-1px)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
            });

            btn._iconEl = iconEl;
            btn._labelEl = labelEl;

            return btn;
        };

        const createOwnerActionButtons = (isPublic, onRenameSaved) => {
            const nextVis = isPublic ? 'private' : 'public';
            const visLabel = isPublic
                ? formatI18nText('make_private', '비공개로 전환')
                : formatI18nText('make_public', '공개로 전환');
            const visIcon = isPublic ? 'lock' : 'public';

            const renameBtn = createOwnerActionBtn({
                label: formatI18nText('rename_tree', '이름 바꾸기'),
                icon: 'edit'
            });
            renameBtn.addEventListener('click', () => {
                if (typeof openRenameTree !== 'function') return;
                openRenameTree({
                    canEdit: canEdit,
                    triggerEl: renameBtn,
                    onSaved: onRenameSaved
                });
            });

            const visBtn = createOwnerActionBtn({
                label: visLabel,
                icon: visIcon
            });

            visBtn.dataset.origVisIcon = visIcon;
            visBtn.dataset.origVisLabel = visLabel;

            visBtn.addEventListener('click', async () => {
                if (typeof updateTreeVisibility !== 'function') return;

                // Apply pending state using reliable element references
                visBtn.disabled = true;
                visBtn.setAttribute('aria-busy', 'true');
                visBtn.style.opacity = '0.65';
                visBtn.style.pointerEvents = 'none';

                if (visBtn._iconEl) {
                    visBtn._iconEl.textContent = PENDING_ICON;
                }
                if (visBtn._labelEl) {
                    visBtn._labelEl.textContent = PENDING_LABEL;
                }

                try {
                    await updateTreeVisibility(nextVis);
                } catch (error) {
                    console.error('[editor] visibility toggle failed:', error);
                    if (typeof showToast === 'function') {
                        showToast(
                            formatI18nText('visibility_toggle_error', '공개 상태를 바꾸지 못했어요.'),
                            'error'
                        );
                    }
                } finally {
                    visBtn.disabled = false;
                    visBtn.setAttribute('aria-busy', 'false');
                    visBtn.style.opacity = '';
                    visBtn.style.pointerEvents = '';

                    // Restore original icon and label from data attributes
                    if (visBtn._iconEl) {
                        visBtn._iconEl.textContent = visBtn.dataset.origVisIcon || visIcon;
                    }
                    if (visBtn._labelEl) {
                        visBtn._labelEl.textContent = visBtn.dataset.origVisLabel || visLabel;
                    }
                }
            });

            return [renameBtn, visBtn];
        };

        const bindShareButton = ({ btn, data, treeId }) => {
            if (!btn || !data?.id) return;
            if (btn.dataset.shareBound === '1') return;
            btn.dataset.shareBound = '1';

            const basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';

            btn.addEventListener('click', () => {
                const shareUrl = window.location.origin + '/' + basePath + 'detail.html?id=' + data.id + '&tree=' + treeId;
                navigator.clipboard?.writeText(shareUrl).then(() => {
                    showToast(i18n('copied_link') || '링크가 복사되었습니다', 'success');
                }).catch(() => {
                    showToast(i18n('copy_link_failed') || '링크 복사에 실패했습니다', 'error');
                });
            });
        };

        const bindOpenDetailButton = (btn) => {
            if (!btn || typeof openCurrentMomentDetail !== 'function') return;
            if (btn.dataset.openDetailBound === '1') return;
            btn.dataset.openDetailBound = '1';
            btn.addEventListener('click', () => {
                openCurrentMomentDetail();
            });
        };

        const createTreeMetaBlock = ({
            displayTreeTitle,
            visIcon,
            visLabel,
            visInfo,
            isPublic,
            countLabel,
            shareButtonEl = null,
            openDetailButtonEl = null,
            onRenameSaved = null
        }) => {
            const wrap = document.createElement('div');
            wrap.style.padding = '20px 20px 18px';
            wrap.style.borderRadius = '22px';
            wrap.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(250,246,244,0.97))';
            wrap.style.boxShadow = '0 14px 30px rgba(75, 64, 57, 0.08)';
            wrap.style.border = '1px solid rgba(144,73,81,0.10)';
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '14px';

            const topRow = document.createElement('div');
            topRow.style.display = 'flex';
            topRow.style.alignItems = 'flex-start';
            topRow.style.justifyContent = 'space-between';
            topRow.style.gap = '12px';
            topRow.style.flexWrap = 'wrap';

            const titleWrap = document.createElement('div');
            titleWrap.style.display = 'flex';
            titleWrap.style.flexDirection = 'column';
            titleWrap.style.gap = '8px';
            titleWrap.style.flex = '1 1 220px';

            const eyebrow = document.createElement('div');
            eyebrow.textContent = formatI18nText('current_tree', '현재 트리');
            eyebrow.style.fontSize = '11px';
            eyebrow.style.fontWeight = '800';
            eyebrow.style.letterSpacing = '.08em';
            eyebrow.style.textTransform = 'uppercase';
            eyebrow.style.color = 'var(--on-surface-variant)';
            titleWrap.appendChild(eyebrow);

            const title = document.createElement('div');
            title.textContent = displayTreeTitle;
            title.style.fontSize = '24px';
            title.style.fontWeight = '900';
            title.style.color = 'var(--on-surface)';
            title.style.lineHeight = '1.24';
            title.style.letterSpacing = '-0.04em';
            titleWrap.appendChild(title);

            const count = document.createElement('div');
            count.textContent = countLabel;
            count.style.fontSize = '12px';
            count.style.color = 'var(--on-surface-variant)';
            count.style.lineHeight = '1.75';
            titleWrap.appendChild(count);

            const visBadge = document.createElement('span');
            visBadge.className = 'editor-tree-visibility editor-tree-visibility-' + (isPublic ? 'public' : 'private');
            visBadge.setAttribute('aria-label', visLabel);
            visBadge.setAttribute('title', visLabel);
            visBadge.style.display = 'inline-flex';
            visBadge.style.alignItems = 'center';
            visBadge.style.gap = '4px';
            visBadge.style.fontSize = '12px';
            visBadge.style.fontWeight = '500';
            visBadge.style.color = 'var(--on-surface-variant)';
            visBadge.style.background = 'transparent';
            visBadge.style.border = 'none';
            visBadge.style.boxShadow = 'none';
            visBadge.style.padding = '0';
            visBadge.style.borderRadius = '0';
            visBadge.appendChild(createInlineIcon(visIcon, '16px'));

            topRow.appendChild(titleWrap);
            topRow.appendChild(visBadge);
            wrap.appendChild(topRow);

            // #3587: visibility description sentence only shown in explicit
            // owner edit mode. In appreciation mode it is NOT rendered so the
            // tree title / moment count / appreciation content take priority.
            const editModeForInfo = window.LoveBudEditorInteractionMode
                && typeof window.LoveBudEditorInteractionMode.isEditMode === 'function'
                && window.LoveBudEditorInteractionMode.isEditMode() === true;
            if (visInfo && editModeForInfo) {
                const info = document.createElement('div');
                info.textContent = visInfo;
                info.style.fontSize = '12px';
                info.style.color = 'var(--on-surface-variant)';
                info.style.lineHeight = '1.75';
                wrap.appendChild(info);
            }

            const actionsRow = document.createElement('div');
            actionsRow.style.display = 'flex';
            actionsRow.style.alignItems = 'center';
            actionsRow.style.gap = '8px';
            actionsRow.style.flexWrap = 'wrap';
            actionsRow.style.paddingTop = '2px';

            if (shareButtonEl) actionsRow.appendChild(shareButtonEl);
            if (openDetailButtonEl) actionsRow.appendChild(openDetailButtonEl);
            // #3586: rename/visibility mutations only in explicit owner edit mode.
            const isEditMode = window.LoveBudEditorInteractionMode
                && typeof window.LoveBudEditorInteractionMode.isEditMode === 'function'
                && window.LoveBudEditorInteractionMode.isEditMode() === true;
            if (canEdit === true && isEditMode) {
                const [renameBtn, visBtn] = createOwnerActionButtons(isPublic, onRenameSaved);
                renameBtn.classList.add('editor-owner-mutation-action');
                renameBtn.dataset.ownerMutation = 'rename';
                visBtn.classList.add('editor-owner-mutation-action');
                visBtn.dataset.ownerMutation = 'visibility';
                actionsRow.appendChild(renameBtn);
                actionsRow.appendChild(visBtn);
            }

            if (actionsRow.children.length > 0) {
                wrap.appendChild(actionsRow);
            }

            return wrap;
        };

        const buildTreeMetaRenderModel = ({
            currentTree,
            treeState,
            data,
            isEmptyState,
            localSaveMode
        }) => {
            const visibility = currentTree.visibility || 'public';
            const isPublic = visibility === 'public';
            const visIcon = isPublic ? 'public' : 'lock';
            const visLabel = isPublic ? i18n('visibility_public') : i18n('visibility_private');
            const visInfo = isPublic
                ? formatI18nText('editor_tree_public_info', '이 트리 전체가 공개되어 있어요. 링크가 있는 사람은 감상할 수 있습니다.')
                : formatI18nText('editor_tree_private_info', '이 트리 전체는 비공개예요. 지금은 나만 볼 수 있습니다.');
            // resolveTreeTitleText(i18nFn, rawTitle) — must pass i18n first (#3576).
            const displayTreeTitle = resolveTreeTitleText(i18n, currentTree.title);
            const localBadgeText = localSaveMode ? (i18n('local_save_badge') || '로컬 저장') : '';
            const countForLabel = treeState.totalMomentCount;
            const treeCountLabel = treeState.hasMoments
                ? formatI18nText('editor_tree_status_count', `{count}개의 순간이 이 트리 안에서 이어지고 있어요.`, { count: countForLabel })
                : formatI18nText('editor_tree_status_empty', '아직 첫 순간을 기다리고 있어요.');

            let shareBtn = null;
            let openDetailBtn = null;
            if (!isEmptyState && data?.id) {
                shareBtn = createShareTreeButton();
                openDetailBtn = createOpenDetailButton();
            }

            return {
                displayTreeTitle,
                visIcon,
                visLabel,
                visInfo,
                isPublic,
                countLabel: localBadgeText ? `${treeCountLabel} · ${localBadgeText}` : treeCountLabel,
                shareButtonEl: shareBtn,
                openDetailButtonEl: openDetailBtn,
                shareBtn,
                openDetailBtn
            };
        };

        const renderTreeMetaBoundary = (treeMetaMount, model, treeId, data) => {
            if (!treeMetaMount) return;

            // Build onRenameSaved callback that captures data via closure
            const onRenameSaved = function(updatedTree) {
                const rerender = typeof updateDetailPanel === 'function'
                    ? updateDetailPanel()
                    : null;
                if (typeof rerender === 'function') {
                    rerender(data);
                }
            };

            treeMetaMount.innerHTML = '';
            treeMetaMount.appendChild(createTreeMetaBlock({
                displayTreeTitle: model.displayTreeTitle,
                visIcon: model.visIcon,
                visLabel: model.visLabel,
                visInfo: model.visInfo,
                isPublic: model.isPublic,
                countLabel: model.countLabel,
                shareButtonEl: model.shareButtonEl,
                openDetailButtonEl: model.openDetailButtonEl,
                onRenameSaved: onRenameSaved
            }));

            if (model.shareBtn) {
                bindShareButton({
                    btn: model.shareBtn,
                    data,
                    treeId
                });
            }
            bindOpenDetailButton(model.openDetailBtn);
        };

        return {
            buildTreeMetaRenderModel,
            renderTreeMetaBoundary
        };
    }

    window.createEditorDetailTreeMetaBoundary = createEditorDetailTreeMetaBoundary;
})();