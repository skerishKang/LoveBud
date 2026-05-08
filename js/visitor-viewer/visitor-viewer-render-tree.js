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

    function renderTree(container, state, handlers) {
        if (!container) return;
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

            svg += '<path d="' + d + '" stroke="rgba(113,76,60,.14)" stroke-width="' + (selected ? '4.35' : '3.05') + '" stroke-linecap="round" fill="none" opacity="' + (muted ? '0.18' : '1') + '" />';
            svg += '<path d="' + d + '" stroke="' + bPalette.stroke + '" stroke-width="' + (selected ? '2.45' : '1.65') + '" stroke-linecap="round" fill="none" opacity="' + (muted ? '0.25' : '1') + '" />';
            svg += '<path d="' + d + '" stroke="rgba(255,255,255,.70)" stroke-width=".48" stroke-linecap="round" fill="none" />';
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
            rootEl = '<button type="button" class="vv-root-seed ' + (selectedMomentId === rootSeed.id ? 'is-selected' : '') + '" data-moment-id="' + escapeHtml(rootSeed.id) + '" data-branch-id="' + escapeHtml(rootSeed.branchId) + '" aria-label="시작된 순간 열기">' +
                '<div class="vv-root-seed-shape" style="background:linear-gradient(135deg,' + (paletteObj.rose || {soft:'#fff1f3',stroke:'#e99aac'}).soft + ',' + (paletteObj.rose || {}).stroke + ' 40%,white)">' +
                '<div class="vv-root-seed-inner"></div>' +
                '<span class="vv-root-seed-emoji">' + escapeHtml(rootSeed.emoji) + '</span>' +
                '<span class="vv-root-seed-play">▶</span>' +
                '</div>' +
                '<span class="vv-root-seed-label">시작된 순간</span>' +
                '</button>';
        }

        container.innerHTML =
            '<div class="vv-tree-canvas" data-has-selection="' + hasSelection + '">' +
            '  <div class="vv-tree-bg-pattern"></div>' +
            '  <div class="vv-tree-glow-top"></div>' +
            '  <div class="vv-tree-glow-bottom"></div>' +
            '  <svg class="vv-tree-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
            '    <defs><filter id="trunkShadow"><feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#7c4a3f" floodOpacity="0.16" /></filter></defs>' +
            '    <path d="M50 91 C48 78, 52 66, 50 54 C48 43, 52 32, 50 12" stroke="#9f745b" stroke-width="3.9" stroke-linecap="round" fill="none" opacity="0.34" />' +
            '    <path d="M50 91 C48 78, 52 66, 50 54 C48 43, 52 32, 50 12" stroke="#7f5b47" stroke-width="1.55" stroke-linecap="round" fill="none" opacity="0.86" />' +
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
        var leafW = (branchSelected || selected) ? '64px' : '52px';
        var leafH = (branchSelected || selected) ? '80px' : '68px';
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

    window.LoveBudVisitorViewerRenderTree = { renderTree: renderTree };
})();
