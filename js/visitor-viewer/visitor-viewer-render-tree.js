(function() {
    'use strict';

    var data = window.LoveBudVisitorViewerData;
    if (!data) return;
    var palette = data.palette;
    var branches = data.branches;
    var rootSeed = data.rootSeed;
    var curvePoint = data.curvePoint;

    function renderTree(container, state, handlers) {
        if (!container) return;
        var selectedBranchId = state.selectedBranchId;
        var selectedMomentId = state.selectedMomentId;
        var hasSelection = Boolean(selectedBranchId || selectedMomentId);

        var svg = buildSvg(hasSelection);
        var branchEls = '';
        var branchNames = '';
        var mediaLeafs = '';

        branches.forEach(function(branch) {
            var selected = selectedBranchId === branch.id;
            var muted = hasSelection && !selected;
            var bPalette = palette[branch.color];
            var d = 'M50 ' + branch.startY + ' C' + branch.curveA + ' ' + (branch.startY - 8) + ', ' + branch.curveB + ' ' + (branch.endY + 8) + ', ' + branch.endX + ' ' + branch.endY;

            svg += '<path d="' + d + '" stroke="rgba(113,76,60,.14)" stroke-width="' + (selected ? '4.35' : '3.05') + '" stroke-linecap="round" fill="none" opacity="' + (muted ? '0.18' : '1') + '" />';
            svg += '<path d="' + d + '" stroke="' + bPalette.stroke + '" stroke-width="' + (selected ? '2.45' : '1.65') + '" stroke-linecap="round" fill="none" opacity="' + (muted ? '0.25' : '1') + '" />';
            svg += '<path d="' + d + '" stroke="rgba(255,255,255,.70)" stroke-width=".48" stroke-linecap="round" fill="none" />';
            svg += '<circle cx="50" cy="' + branch.startY + '" r="' + (selected ? '1.65' : '1.18') + '" fill="' + bPalette.stroke + '" opacity="' + (muted ? '.25' : '.82') + '" />';

            var labelPoint = curvePoint(branch, 0.78);

            branchNames += '<button type="button" class="vv-branch-label ' + (selected ? 'is-selected' : '') + '" data-branch-id="' + branch.id + '" style="left:' + labelPoint.x + '%;top:' + labelPoint.y + '%;color:' + bPalette.text + '">' + branch.name + '</button>';

            branch.moments.forEach(function(moment) {
                var point = curvePoint(branch, moment.t);
                var bSelected = selectedMomentId === moment.id;
                mediaLeafs += renderLeaf(moment, branch, point, bSelected, selected, muted, handlers);
            });
        });

        var rootSelected = selectedMomentId === rootSeed.id;
        var rootEl = '<button type="button" class="vv-root-seed ' + (rootSelected ? 'is-selected' : '') + '" data-moment-id="' + rootSeed.id + '" data-branch-id="' + rootSeed.branchId + '" aria-label="시작된 순간 열기">' +
            '<div class="vv-root-seed-shape" style="background:linear-gradient(135deg,' + rootSeed.color.replace('from-', '').replace('via-', ',').replace('to-', ',') + ')"></div>' +
            '<span class="vv-root-seed-emoji">' + rootSeed.emoji + '</span>' +
            '<span class="vv-root-seed-label">시작된 순간</span>' +
            '</button>';

        container.innerHTML =
            '<div class="vv-tree-canvas" data-has-selection="' + hasSelection + '">' +
            '  <div class="vv-tree-bg-pattern"></div>' +
            '  <div class="vv-tree-glow-top"></div>' +
            '  <div class="vv-tree-glow-bottom"></div>' +
            '  <svg class="vv-tree-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
            '    <defs>' +
            '      <linearGradient id="trunkGrad" x1="0" y1="1" x2="0" y2="0">' +
            '        <stop offset="0%" stopColor="#855747" />' +
            '        <stop offset="38%" stopColor="#b47a65" />' +
            '        <stop offset="72%" stopColor="#d99b9a" />' +
            '        <stop offset="100%" stopColor="#f2b2c0" />' +
            '      </linearGradient>' +
            '      <filter id="trunkShadow"><feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#7c4a3f" floodOpacity="0.16" /></filter>' +
            '    </defs>' +
            '    <path d="M49 94 C42 83 52 72 48 60 C44 45 54 30 49 9" stroke="rgba(118,73,58,.15)" stroke-width="7.6" stroke-linecap="round" fill="none" />' +
            '    <path d="M50 94 C44 80 53 70 49 58 C45 44 55 29 50 8" stroke="url(#trunkGrad)" stroke-width="5.35" stroke-linecap="round" fill="none" filter="url(#trunkShadow)" />' +
            '    <path d="M51.8 91 C49 78 55 67 51.4 56 C49 42 55 29 51.6 10" stroke="rgba(255,255,255,.48)" stroke-width=".85" stroke-linecap="round" fill="none" />' +
            '    <path d="M47.4 88 C45.8 73 50.5 63 48 52 C46 39 50 26 48.6 11" stroke="rgba(93,55,45,.16)" stroke-width=".55" stroke-linecap="round" fill="none" />' +
            '    <path d="M50 94 C45 96 41 97 36 97" stroke="rgba(133,87,71,.34)" stroke-width="1.4" stroke-linecap="round" fill="none" />' +
            '    <path d="M50 94 C55 96 60 97 65 97" stroke="rgba(133,87,71,.30)" stroke-width="1.25" stroke-linecap="round" fill="none" />' +
            '    <path d="M50 92 C48 96 48 98 46 99" stroke="rgba(133,87,71,.24)" stroke-width=".9" stroke-linecap="round" fill="none" />' +
            svg +
            '  </svg>' +
            '  <div class="vv-tree-organs">' +
            branchNames +
            mediaLeafs +
            rootEl +
            '  </div>' +
            '  <div class="vv-tree-badge">완성된 공개 러브트리</div>' +
            '</div>';

        container.querySelectorAll('.vv-branch-label').forEach(function(btn) {
            btn.addEventListener('click', function() { handlers.onSelectBranch(btn.dataset.branchId); });
        });
        container.querySelectorAll('[data-moment-id]').forEach(function(btn) {
            btn.addEventListener('click', function() { handlers.onSelectMoment(btn.dataset.momentId, btn.dataset.branchId); });
        });
    }

    function renderLeaf(moment, branch, point, selected, branchSelected, muted, handlers) {
        var cluster = moment.cluster;
        var leafClasses = 'vv-media-leaf ' + (selected ? 'is-selected' : '') + ' ' + (muted ? 'is-dimmed' : '');
        var labelPoint = curvePoint(branch, 0.78);
        var labelSide = branch.side === 'left' ? 'vv-leaf-label--left' : 'vv-leaf-label--right';
        var showLabel = branchSelected && !cluster;

        if (cluster) {
            var pal = palette[branch.color];
            var sizeClass = branchSelected || selected ? 'vv-cluster-lg' : 'vv-cluster-sm';
            return '<div class="' + leafClasses + ' vv-cluster ' + sizeClass + '" data-moment-id="' + moment.id + '" style="left:' + point.x + '%;top:' + point.y + '%" aria-label="' + moment.title + '">' +
                '<span class="vv-cluster-leaf" style="left:16%;top:18%;background:linear-gradient(135deg,' + moment.color.replace(/-/g, ' ').replace(/from-/, '').replace(/via-/, ',').replace(/to-/, ',') + ')"></span>' +
                '<span class="vv-cluster-leaf" style="left:28%;top:0%;background:linear-gradient(135deg,' + moment.color.replace(/-/g, ' ').replace(/from-/, '').replace(/via-/, ',').replace(/to-/, ',') + ')"></span>' +
                '<span class="vv-cluster-leaf" style="left:0%;top:5%;background:linear-gradient(135deg,' + moment.color.replace(/-/g, ' ').replace(/from-/, '').replace(/via-/, ',').replace(/to-/, ',') + ')"></span>' +
                '<span class="vv-cluster-label">+' + moment.cluster + '</span>' +
                '</div>';
        }

        var stemAngle = branch.side === 'left' ? -18 : 18;
        var leafShape = 'style="border-radius:54% 46% 52% 48% / 43% 58% 42% 57%;background:linear-gradient(135deg,' + moment.color.replace(/from-/, '').replace(/via-/, ',').replace(/to-/, ',') + ')"';

        return '<div class="' + leafClasses + '" data-moment-id="' + moment.id + '" style="left:' + point.x + '%;top:' + point.y + '%">' +
            '<span class="vv-leaf-stem" style="transform:rotate(' + stemAngle + 'deg);opacity:' + (branchSelected || selected ? '0.75' : '0.38') + '"></span>' +
            '<button type="button" class="vv-leaf-shape ' + (selected ? 'is-active' : '') + '" ' + leafShape + ' aria-label="' + moment.title + '">' +
            '  <span class="vv-leaf-inner"></span>' +
            '  <span class="vv-leaf-emoji">' + moment.emoji + '</span>' +
            '</button>' +
            (showLabel ? '<div class="vv-leaf-label ' + labelSide + '"><span class="vv-leaf-label-title">' + moment.title + '</span><span class="vv-leaf-label-tag" style="background:' + palette[branch.color].soft + ';color:' + palette[branch.color].text + '">' + moment.tag + '</span></div>' : '') +
            '</div>';
    }

    window.LoveBudVisitorViewerRenderTree = { renderTree: renderTree };
})();