(function() {
    'use strict';

    function getData(key) {
        var d = window.LoveBudVisitorViewerData;
        return d ? d[key] : null;
    }

    function paletteColor(branch) {
        var pal = getData('palette');
        if (!pal) return { stroke:'#e99aac', soft:'#fff1f3', text:'#be123c', dim:'rgba(251,113,133,.16)' };
        return pal[branch && branch.color] || pal.rose;
    }

    function leafGrad(branch) {
        var p = paletteColor(branch);
        return 'linear-gradient(135deg,' + p.soft + ',' + p.stroke + ' 40%,white)';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
            return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char];
        });
    }

    // ── Structured (hierarchy) layout ─────────────────────────────────────

    function buildHierarchyLayout(branches, rootSeed) {
        if (!branches || branches.length === 0) return null;

        // Collect all nodes with parent-child relationships
        var nodes = [];
        var edges = [];
        var nodeMap = {};
        var colorMap = {};
        var startX = 50;
        var startY = 8;
        var levelSpacing = 22;
        var minHorizontalGap = 12;

        // Build nodes from branches + moments
        branches.forEach(function(branch) {
            var branchNodeId = 'branch-' + branch.id;
            // Branch label as a node
            nodes.push({
                id: branchNodeId,
                label: branch.name,
                type: 'branch',
                color: branch.color,
                isBranch: true,
                children: []
            });
            colorMap[branchNodeId] = branch.color;

            // Connect branch to trunk root (center)
            edges.push({
                from: 'trunk-root',
                to: branchNodeId
            });

            // Moments on this branch
            (branch.moments || []).forEach(function(moment) {
                var momentNodeId = moment.id;
                nodes.push({
                    id: momentNodeId,
                    label: moment.title,
                    type: 'moment',
                    emoji: moment.emoji || '✦',
                    tag: moment.tag || '',
                    branchId: branchNodeId,
                    color: branch.color,
                    children: []
                });
                colorMap[momentNodeId] = branch.color;
                edges.push({
                    from: branchNodeId,
                    to: momentNodeId
                });
            });
        });

        // If we only have one branch, simplify: build straight hierarchy of moments
        if (branches.length === 1) {
            var singleBranch = branches[0];
            var moments = singleBranch.moments || [];
            if (moments.length <= 1) {
                // Too few nodes, not worth hierarchy view
                return null;
            }

            // Simple: root → moment1 → moment2 → moment3 (chain)
            nodes = [];
            edges = [];

            // Root seed as top
            if (rootSeed) {
                nodes.push({
                    id: 'seed-root',
                    label: rootSeed.title,
                    type: 'root',
                    emoji: rootSeed.emoji || '✦',
                    tag: '',
                    children: []
                });
            }

            moments.forEach(function(moment, i) {
                nodes.push({
                    id: moment.id,
                    label: moment.title,
                    type: 'moment',
                    emoji: moment.emoji || '✦',
                    tag: moment.tag || '',
                    children: []
                });
                if (i === 0) {
                    edges.push({ from: 'seed-root', to: moment.id });
                } else {
                    edges.push({ from: moments[i-1].id, to: moment.id });
                }
            });

            // Compute positions: top-down chain
            var maxWidth = 100;
            var totalNodes = nodes.length;
            var availableHeight = 100 - startY - 5;
            var ySpacing = totalNodes > 1 ? availableHeight / (totalNodes - 1) : 0;

            nodes.forEach(function(node, i) {
                node.x = startX;
                node.y = startY + (totalNodes > 1 ? i * ySpacing : 0);
            });

            return { nodes: nodes, edges: edges };
        }

        // Multiple branches: build hierarchy with trunk root branching out
        // Compute positions: root at top center, branches radially outward
        var allNodes = nodes;
        var level = {};
        var maxLevel = 0;

        // Assign levels using simple BFS
        allNodes.forEach(function(n) { level[n.id] = 0; });
        edges.forEach(function(e) {
            var childLevel = (level[e.from] || 0) + 1;
            if (childLevel > (level[e.to] || 0)) {
                level[e.to] = childLevel;
            }
            if (childLevel > maxLevel) maxLevel = childLevel;
        });

        // Group nodes by level
        var nodesByLevel = {};
        allNodes.forEach(function(n) {
            var lvl = level[n.id] || 0;
            if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
            nodesByLevel[lvl].push(n);
        });

        // Compute positions
        Object.keys(nodesByLevel).forEach(function(lvlStr) {
            var lvl = parseInt(lvlStr, 10);
            var lvlNodes = nodesByLevel[lvl];
            var count = lvlNodes.length;
            // Position: evenly spaced across (100 - margins)
            var leftMargin = 10;
            var rightMargin = 10;
            var availableWidth = 100 - leftMargin - rightMargin;
            var spacing = count > 1 ? availableWidth / (count - 1) : 0;

            lvlNodes.forEach(function(node, i) {
                node.x = count > 1 ? leftMargin + i * spacing : startX;
                node.y = startY + lvl * levelSpacing;
            });
        });

        // Adjust deep chains: if a node has a single child, keep them aligned
        // (already handled by level-based positioning)

        return { nodes: allNodes, edges: edges };
    }

    function renderHierarchyTree(container, state, handlers) {
        var branches = getData('branches') || [];
        var rootSeed = getData('rootSeed');
        var paletteObj = getData('palette') || {};
        var treeData = getData('tree') || {};

        var layout = buildHierarchyLayout(branches, rootSeed);
        if (!layout) {
            // Fall back to organic mode if hierarchy can't be built
            renderOrganicTree(container, state, handlers);
            return;
        }

        var selectedMomentId = state.selectedMomentId;
        var hasSelection = Boolean(selectedMomentId);
        var isSingleChain = branches.length === 1 && layout.nodes.length > 1;

        // Build SVG lines for edges
        var svgLines = '';
        layout.edges.forEach(function(edge) {
            var fromNode = layout.nodes.find(function(n) { return n.id === edge.from; });
            var toNode = layout.nodes.find(function(n) { return n.id === edge.to; });
            if (!fromNode || !toNode) return;

            var pColor = paletteColor({ color: toNode.color || 'rose' });
            var muted = hasSelection && selectedMomentId !== toNode.id && selectedMomentId !== fromNode.id;

            // Draw a vertical-then-horizontal connector line
            var x1 = fromNode.x, y1 = fromNode.y;
            var x2 = toNode.x, y2 = toNode.y;
            var midY = y1 + (y2 - y1) * 0.5;

            // L-shaped connector: vertical down from parent, horizontal to child, vertical to child
            var pathData = 'M' + x1 + ' ' + y1 + ' L' + x1 + ' ' + midY + ' L' + x2 + ' ' + midY + ' L' + x2 + ' ' + y2;

            svgLines += '<path d="' + pathData + '" stroke="' + (pColor.stroke || '#d4a0a0') + '" stroke-width="' + (muted ? '0.7' : '1.2') + '" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="' + (muted ? '0.25' : '0.55') + '" />';
        });

        // Build node elements
        var nodeEls = '';
        layout.nodes.forEach(function(node) {
            var isSelected = selectedMomentId === node.id;
            var pColor = paletteColor({ color: node.color || 'rose' });
            var leafShape = 'width:clamp(52px, 4.5vw, 72px);height:clamp(68px, 5.5vw, 92px);border-radius:54% 46% 52% 48% / 43% 58% 42% 57%;background:' + leafGrad({ color: node.color }) + ';box-shadow:' + (isSelected ? '0 0 0 6px rgba(255,241,243,0.9),0 20px 38px rgba(80,45,39,0.18)' : '0 8px 20px rgba(97,61,38,0.10)');

            var dataAttrs = 'data-moment-id="' + escapeHtml(node.id) + '" data-branch-id="' + escapeHtml(node.branchId || '') + '"';

            nodeEls += '<div class="vv-media-leaf' + (isSelected ? ' is-selected' : '') + '" ' + dataAttrs + ' style="left:' + node.x + '%;top:' + node.y + '%">' +
                '<button type="button" class="vv-leaf-shape' + (isSelected ? ' is-active' : '') + '" style="' + leafShape + '" aria-label="' + escapeHtml(node.label) + '">' +
                '  <span class="vv-leaf-inner"></span>' +
                '  <span class="vv-leaf-emoji">' + (node.emoji ? escapeHtml(node.emoji) : '✦') + '</span>' +
                '  <span class="vv-leaf-play">▶</span></button>' +
                (isSingleChain || node.type !== 'moment' ? '' :
                '<div class="vv-leaf-label vv-leaf-label--right"><span class="vv-leaf-label-title">' + escapeHtml(node.label) + '</span>' +
                (node.tag ? '<span class="vv-leaf-label-tag" style="background:' + pColor.soft + ';color:' + pColor.text + '">' + escapeHtml(node.tag) + '</span>' : '') +
                '</div>') +
                '</div>';
        });

        container.innerHTML =
            '<div class="vv-tree-canvas" data-has-selection="' + hasSelection + '" data-layout="hierarchy">' +
            '  <div class="vv-tree-bg-pattern"></div>' +
            '  <div class="vv-tree-glow-top"></div>' +
            '  <div class="vv-tree-glow-bottom"></div>' +
            '  <svg class="vv-tree-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
            '    <defs><filter id="hierarchyShadow"><feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#7c4a3f" floodOpacity="0.12" /></filter></defs>' +
            svgLines +
            '  </svg>' +
            '  <div class="vv-tree-organs">' + nodeEls + '</div>' +
            '  <div class="vv-tree-badge">완성된 공개 러브트리</div>' +
            '</div>';
    }

    // ── Organic (default) layout ───────────────────────────────────────────

    function renderOrganicTree(container, state, handlers) {
        var branches = getData('branches') || [];
        var rootSeed = getData('rootSeed');
        var paletteObj = getData('palette') || {};
        var curvePoint = getData('curvePoint') || function(b,t) {
            var x0=50,y0=b.startY,x1=b.curveA,y1=b.startY-8,x2=b.curveB,y2=b.endY+8,x3=b.endX,y3=b.endY,mt=1-t;
            return {x:mt*mt*mt*x0+3*mt*mt*t*x1+3*mt*t*t*x2+t*t*t*x3,y:mt*mt*mt*y0+3*mt*mt*t*y1+3*mt*t*t*y2+t*t*t*y3};
        };

        var selectedBranchId = state.selectedBranchId;
        var selectedMomentId = state.selectedMomentId;
        var hasSelection = Boolean(selectedBranchId || selectedMomentId);

        var svg = '';
        var branchNames = '';
        var mediaLeafs = '';

        branches.forEach(function(branch) {
            var selected = selectedBranchId === branch.id;
            var muted = hasSelection && !selected;
            var bPalette = paletteColor(branch);
            var d = 'M50 ' + branch.startY + ' C' + branch.curveA + ' ' + (branch.startY - 8) + ', ' + branch.curveB + ' ' + (branch.endY + 8) + ', ' + branch.endX + ' ' + branch.endY;

            svg += '<path d="' + d + '" stroke="rgba(113,76,60,.14)" stroke-width="' + (selected ? '5.1' : '3.65') + '" stroke-linecap="round" fill="none" opacity="' + (muted ? '0.18' : '1') + '" />';
            svg += '<path d="' + d + '" stroke="' + bPalette.stroke + '" stroke-width="' + (selected ? '2.95' : '1.95') + '" stroke-linecap="round" fill="none" opacity="' + (muted ? '0.25' : '1') + '" />';
            svg += '<path d="' + d + '" stroke="rgba(255,255,255,.70)" stroke-width=".62" stroke-linecap="round" fill="none" />';
            svg += '<circle cx="50" cy="' + branch.startY + '" r="' + (selected ? '1.65' : '1.18') + '" fill="' + bPalette.stroke + '" opacity="' + (muted ? '.25' : '.82') + '" />';

            var labelPoint = curvePoint(branch, 0.78);

            branchNames += '<button type="button" class="vv-branch-label ' + (selected ? 'is-selected' : '') + '" data-branch-id="' + escapeHtml(branch.id) + '" style="left:' + labelPoint.x + '%;top:' + labelPoint.y + '%;color:' + bPalette.text + '">' + escapeHtml(branch.name) + '</button>';

            branch.moments.forEach(function(moment) {
                var point = curvePoint(branch, moment.t);
                var bSelected = selectedMomentId === moment.id;
                mediaLeafs += renderLeaf(moment, branch, point, bSelected, selected, muted, curvePoint, paletteColor);
            });
        });

        var rootEl = '';
        if (rootSeed) {
            rootEl = '<div class="vv-root-seed vv-root-seed-overview-anchor" data-overview-anchor="true" aria-label="러브트리의 시작점">' +
                '<div class="vv-root-seed-shape" style="background:linear-gradient(135deg,' + (paletteObj.rose || {soft:'#fff1f3',stroke:'#e99aac'}).soft + ',' + (paletteObj.rose || {}).stroke + ' 40%,white)">' +
                '<div class="vv-root-seed-inner"></div>' +
                '<span class="vv-root-seed-emoji">' + escapeHtml(rootSeed.emoji) + '</span>' +
                '</div>' +
                '<span class="vv-root-seed-label">러브트리의 시작점</span>' +
                '</div>';
        }

        container.innerHTML =
            '<div class="vv-tree-canvas" data-has-selection="' + hasSelection + '" data-layout="organic">' +
            '  <div class="vv-tree-bg-pattern"></div>' +
            '  <div class="vv-tree-glow-top"></div>' +
            '  <div class="vv-tree-glow-bottom"></div>' +
            '  <svg class="vv-tree-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
            '    <defs><filter id="trunkShadow"><feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#7c4a3f" floodOpacity="0.16" /></filter></defs>' +
            '    <path d="M50 91 C48 78, 52 66, 50 54 C48 43, 52 32, 50 12" stroke="#9f745b" stroke-width="5.35" stroke-linecap="round" fill="none" opacity="0.34" />' +
            '    <path d="M50 91 C48 78, 52 66, 50 54 C48 43, 52 32, 50 12" stroke="#7f5b47" stroke-width="2.15" stroke-linecap="round" fill="none" opacity="0.86" />' +
            svg +
            '  </svg>' +
            '  <div class="vv-tree-organs">' + branchNames + mediaLeafs + rootEl + '</div>' +
            '  <div class="vv-tree-badge">완성된 공개 러브트리</div>' +
            '</div>';
    }

    function renderLeaf(moment, branch, point, selected, branchSelected, muted, curvePoint, paletteColorFn) {
        var cluster = moment.cluster;
        var leafClasses = 'vv-media-leaf ' + (selected ? 'is-selected' : '') + ' ' + (muted ? 'is-dimmed' : '');
        var labelPoint = curvePoint(branch, 0.78);
        var labelSide = branch.side === 'left' ? 'vv-leaf-label--left' : 'vv-leaf-label--right';
        var showLabel = branchSelected && !cluster;

        if (cluster) {
            var pal = paletteColorFn(branch);
            var sizeClass = branchSelected || selected ? 'vv-cluster-lg' : 'vv-cluster-sm';
            return '<div class="' + leafClasses + ' vv-cluster ' + sizeClass + '" data-moment-id="' + escapeHtml(moment.id) + '" data-branch-id="' + escapeHtml(branch.id) + '" style="left:' + point.x + '%;top:' + point.y + '%" aria-label="' + escapeHtml(moment.title) + '">' +
                '<span class="vv-cluster-leaf" style="left:16%;top:18%;background:' + leafGrad(branch) + '"></span>' +
                '<span class="vv-cluster-leaf" style="left:28%;top:0%;background:' + leafGrad(branch) + '"></span>' +
                '<span class="vv-cluster-leaf" style="left:0%;top:5%;background:' + leafGrad(branch) + '"></span>' +
                '<span class="vv-cluster-label">+' + escapeHtml(moment.cluster) + '</span></div>';
        }

        var stemAngle = branch.side === 'left' ? -18 : 18;
        var leafW = (branchSelected || selected) ? 'clamp(66px, 5vw, 88px)' : 'clamp(56px, 4vw, 74px)';
        var leafH = (branchSelected || selected) ? 'clamp(84px, 6vw, 112px)' : 'clamp(72px, 5vw, 94px)';
        var leafShape = 'style="width:' + leafW + ';height:' + leafH + ';border-radius:54% 46% 52% 48% / 43% 58% 42% 57%;background:' + leafGrad(branch) + ';box-shadow:' + (selected ? '0 0 0 6px rgba(255,241,243,0.9),0 20px 38px rgba(80,45,39,0.18)' : (branchSelected ? '0 10px 28px rgba(97,61,38,0.2)' : '0 8px 20px rgba(97,61,38,0.10)')) + ';"';

        var p = paletteColorFn(branch);
        return '<div class="' + leafClasses + '" data-moment-id="' + escapeHtml(moment.id) + '" data-branch-id="' + escapeHtml(branch.id) + '" style="left:' + point.x + '%;top:' + point.y + '%">' +
            '<span class="vv-leaf-stem" style="transform:rotate(' + stemAngle + 'deg);opacity:' + (branchSelected || selected ? '0.75' : '0.38') + '"></span>' +
            '<button type="button" class="vv-leaf-shape ' + (selected ? 'is-active' : '') + '" ' + leafShape + ' aria-label="' + escapeHtml(moment.title) + '">' +
            '  <span class="vv-leaf-inner"></span>' +
            '  <span class="vv-leaf-emoji">' + escapeHtml(moment.emoji) + '</span>' +
            '  <span class="vv-leaf-play">▶</span></button>' +
            (showLabel ? '<div class="vv-leaf-label ' + labelSide + '"><span class="vv-leaf-label-title">' + escapeHtml(moment.title) + '</span><span class="vv-leaf-label-tag" style="background:' + p.soft + ';color:' + p.text + '">' + escapeHtml(moment.tag) + '</span></div>' : '') +
            '</div>';
    }

    // ── Public API ────────────────────────────────────────────────────────

    function renderTree(container, state, handlers) {
        if (!container) return;
        var layoutMode = (state && state.layoutMode) || 'organic';
        if (layoutMode === 'hierarchy') {
            renderHierarchyTree(container, state, handlers);
        } else {
            renderOrganicTree(container, state, handlers);
        }
    }

    window.LoveBudVisitorViewerRenderTree = { renderTree: renderTree };
})();
