(function () {
    function createPublicViewerDetailTreeMetaBoundary(deps) {
        const {
            i18n,
            formatI18nText,
            resolveTreeTitleText,
            createInlineIcon,
            showToast
        } = deps;

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
            btn.style.color = tone === 'primary' ? '#fff' : 'var(--primary)';

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

        const createTreeMetaBlock = ({
            displayTreeTitle,
            visIcon,
            visLabel,
            visInfo,
            isPublic,
            countLabel,
            shareButtonEl = null,
            treeLikeControlEl = null,   // optional tree-level like control element
            treeCommentsControlEl = null,   // optional whole-tree comments toggle button
            treeCommentsPanelEl = null       // optional whole-tree comments panel (tree-scope)
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
            visBadge.style.padding = '6px 11px';
            visBadge.style.borderRadius = '999px';
            visBadge.style.display = 'inline-flex';
            visBadge.style.alignItems = 'center';
            visBadge.style.gap = '5px';
            visBadge.style.fontSize = '12px';
            visBadge.style.fontWeight = '700';
            visBadge.style.boxShadow = '0 4px 12px rgba(75,64,57,0.05)';
            if (isPublic) {
                visBadge.style.background = 'rgba(76,175,80,0.1)';
                visBadge.style.color = '#4caf50';
                visBadge.style.border = '1px solid rgba(76,175,80,0.25)';
            } else {
                visBadge.style.background = 'rgba(158,158,158,0.1)';
                visBadge.style.color = '#757575';
                visBadge.style.border = '1px solid rgba(158,158,158,0.25)';
            }
            visBadge.appendChild(createInlineIcon(visIcon, '12px'));
            visBadge.appendChild(document.createTextNode(visLabel));

            topRow.appendChild(titleWrap);
            topRow.appendChild(visBadge);
            wrap.appendChild(topRow);

            if (visInfo) {
                const info = document.createElement('div');
                info.textContent = visInfo;
                info.style.fontSize = '12px';
                info.style.color = 'var(--on-surface-variant)';
                info.style.lineHeight = '1.75';
                wrap.appendChild(info);
            }

            const actionsRow = document.createElement('div');
            actionsRow.className = 'tree-meta-actions-row';
            actionsRow.style.display = 'flex';
            actionsRow.style.alignItems = 'center';
            actionsRow.style.gap = '8px';
            actionsRow.style.flexWrap = 'wrap';
            actionsRow.style.paddingTop = '2px';

            if (treeLikeControlEl) actionsRow.appendChild(treeLikeControlEl);
            if (treeCommentsControlEl) actionsRow.appendChild(treeCommentsControlEl);
            if (shareButtonEl) actionsRow.appendChild(shareButtonEl);

            wrap.appendChild(actionsRow);

            // Whole-tree comments panel lives in the tree-scope area, below the
            // actions row. Never inside a selected-moment detail card.
            if (treeCommentsPanelEl) {
                treeCommentsPanelEl.style.marginTop = '12px';
                wrap.appendChild(treeCommentsPanelEl);
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
            const displayTreeTitle = resolveTreeTitleText(i18n, currentTree.title);
            const localBadgeText = localSaveMode ? (i18n('local_save_badge') || '로컬 저장') : '';
            const countForLabel = treeState.totalMomentCount;
            const treeCountLabel = treeState.hasMoments
                ? formatI18nText('editor_tree_status_count', `{count}개의 순간이 이 트리 안에서 이어지고 있어요.`, { count: countForLabel })
                : formatI18nText('editor_tree_status_empty', '아직 첫 순간을 기다리고 있어요.');

            let shareBtn = null;
            if (!isEmptyState && data?.id) {
                shareBtn = createShareTreeButton();
            }


            return {
                displayTreeTitle,
                visIcon,
                visLabel,
                visInfo,
                isPublic,
                countLabel: localBadgeText ? `${treeCountLabel} · ${localBadgeText}` : treeCountLabel,
                shareButtonEl: shareBtn,
                shareBtn
            };
        };

        const renderTreeMetaBoundary = (treeMetaMount, model, treeId, data, treeLikeControlEl, treeCommentsControlEl, treeCommentsPanelEl) => {
            if (!treeMetaMount) return;

            treeMetaMount.replaceChildren();
            const block = createTreeMetaBlock({
                displayTreeTitle: model.displayTreeTitle,
                visIcon: model.visIcon,
                visLabel: model.visLabel,
                visInfo: model.visInfo,
                isPublic: model.isPublic,
                countLabel: model.countLabel,
                shareButtonEl: model.shareButtonEl,
                treeLikeControlEl: treeLikeControlEl || null,
                treeCommentsControlEl: treeCommentsControlEl || null,
                treeCommentsPanelEl: treeCommentsPanelEl || null
            });
            treeMetaMount.appendChild(block);

            if (model.shareBtn) {
                bindShareButton({
                    btn: model.shareBtn,
                    data,
                    treeId
                });
            }


        };

        return {
            buildTreeMetaRenderModel,
            renderTreeMetaBoundary
        };
    }

    const createEditorDetailTreeMetaBoundary = createPublicViewerDetailTreeMetaBoundary;

    window.createPublicViewerDetailTreeMetaBoundary = createPublicViewerDetailTreeMetaBoundary;
    window.createEditorDetailTreeMetaBoundary = createEditorDetailTreeMetaBoundary;
    window.LoveBudPublicViewerDetailTreeMeta = {
        createPublicViewerDetailTreeMetaBoundary,
        createEditorDetailTreeMetaBoundary
    };
})();
