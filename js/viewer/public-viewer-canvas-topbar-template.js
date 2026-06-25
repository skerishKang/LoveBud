(function() {
    'use strict';

    function createElement(tagName, options) {
        var el = document.createElement(tagName);
        var attrs = options && options.attrs ? options.attrs : {};
        Object.keys(attrs).forEach(function(name) {
            var value = attrs[name];
            if (value === false || value === null || typeof value === 'undefined') return;
            if (name === 'className') {
                el.className = value;
                return;
            }
            if (name === 'disabled') {
                el.disabled = true;
                return;
            }
            el.setAttribute(name, String(value));
        });
        if (options && Object.prototype.hasOwnProperty.call(options, 'text')) {
            el.textContent = options.text;
        }
        return el;
    }

    function append(parent) {
        Array.prototype.slice.call(arguments, 1).forEach(function(child) {
            if (child) parent.appendChild(child);
        });
        return parent;
    }

    function createIcon(name, id) {
        var attrs = {
            className: 'material-symbols-outlined',
            'aria-hidden': 'true'
        };
        if (id) attrs.id = id;
        return createElement('span', { attrs: attrs, text: name });
    }

    function createButton(id, label, iconName, options) {
        var btn = createElement('button', {
            attrs: {
                type: 'button',
                className: options && options.wide
                    ? 'editor-canvas-tool-btn editor-canvas-tool-btn-wide'
                    : 'editor-canvas-tool-btn',
                id: id,
                'aria-label': label,
                title: label,
                disabled: options && options.disabled
            }
        });
        append(btn, createIcon(iconName, options && options.iconId));
        if (options && options.labelId) {
            btn.appendChild(createElement('span', {
                attrs: {
                    className: 'editor-canvas-tool-label',
                    id: options.labelId
                },
                text: label
            }));
        }
        return btn;
    }

    function createGroup(label) {
        return createElement('div', {
            attrs: {
                className: 'editor-canvas-toolbar-group',
                'aria-label': label
            }
        });
    }

    function createSeparator() {
        return createElement('div', {
            attrs: {
                className: 'editor-canvas-toolbar-separator',
                'aria-hidden': 'true'
            }
        });
    }

    function buildTopbar() {
        var topbar = createElement('div', {
            attrs: {
                className: 'editor-canvas-topbar',
                'aria-label': '러브트리 캔버스 도구'
            }
        });

        var toolbar = createElement('div', {
            attrs: {
                className: 'editor-canvas-toolbar',
                role: 'toolbar',
                'aria-label': '트리 화면 조정'
            }
        });

        var zoomGroup = createGroup('화면 줌 컨트롤');
        append(
            zoomGroup,
            createButton('zoomOutCanvasBtn', '축소', 'zoom_out'),
            createElement('span', {
                attrs: {
                    className: 'editor-canvas-zoom-indicator is-hidden',
                    id: 'zoomIndicator',
                    'aria-live': 'polite',
                    'aria-atomic': 'true'
                },
                text: '100%'
            }),
            createButton('zoomInCanvasBtn', '확대', 'zoom_in')
        );

        var viewGroup = createGroup('트리 뷰 컨트롤');
        append(
            viewGroup,
            createButton('recenterCanvasBtn', '트리 한눈에 보기', 'fit_screen', {
                wide: true,
                labelId: 'recenterCanvasBtnLabel'
            }),
            createButton('focusSelectedBtn', '선택한 순간 보기', 'center_focus_strong', {
                wide: true,
                labelId: 'focusSelectedBtnLabel',
                disabled: true
            })
        );

        var layoutGroup = createGroup('레이아웃 모드');
        var layoutButton = createButton('layoutModeToggleBtn', '레이아웃 전환', 'auto_awesome', {
            wide: true,
            iconId: 'layoutModeToggleIcon'
        });
        layoutButton.appendChild(createElement('span', {
            attrs: {
                className: 'editor-canvas-tool-label',
                id: 'layoutModeToggleLabel'
            },
            text: '자유 배치'
        }));
        layoutGroup.appendChild(layoutButton);

        var compactGroup = createGroup('툴바 표시 모드');
        compactGroup.appendChild(createButton('compactModeToggleBtn', '간략 모드 전환', 'unfold_more'));

        var modeGroup = createGroup('트리 모드');
        modeGroup.id = 'viewerModeGroup';
        modeGroup.style.display = 'none';
        append(
            modeGroup,
            createButton('viewerModeViewBtn', '보기', 'visibility'),
            createButton('viewerModeEditBtn', '편집', 'edit')
        );

        append(
            toolbar,
            zoomGroup,
            createSeparator(),
            viewGroup,
            createSeparator(),
            layoutGroup,
            createSeparator(),
            compactGroup,
            createSeparator(),
            modeGroup
        );
        topbar.appendChild(toolbar);
        return topbar;
    }

    var mount = document.getElementById('editorCanvasTopbarTemplateMount');
    if (mount) {
        mount.replaceWith(buildTopbar());
    }

    window.LoveBudPublicViewerCanvasTopbarTemplate = {
        mountId: 'editorCanvasTopbarTemplateMount'
    };
})();
