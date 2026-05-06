(function () {
    function createEditorCanvasEdges(options) {
        const {
            svg,
            canvasViewport = {}
        } = options || {};

        const drawBranch = (startPos, endPos) => {
            if (typeof canvasViewport.drawBranch === 'function') {
                canvasViewport.drawBranch(svg, startPos, endPos);
                return;
            }

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const cp1x = startPos.x + (endPos.x - startPos.x) / 2;
            const d = `M ${startPos.x},${startPos.y} Q ${cp1x},${startPos.y} ${endPos.x},${endPos.y}`;
            path.setAttribute('d', d);
            path.setAttribute('class', 'branch-line');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'var(--secondary)');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('opacity', '0.5');
            svg.appendChild(path);
        };

        return {
            drawBranch
        };
    }

    window.createEditorCanvasEdges = createEditorCanvasEdges;
})();
