window.LoveBudEditorCanvasLayoutHelpers = {
  getMetrics(canvas) {
    return {
      width: Math.max(canvas.clientWidth || 0, 720),
      height: Math.max(canvas.clientHeight || 0, 520)
    };
  },

  getRootBasePosition(metrics, constants) {
    return {
      x: Math.max(
        360,
        Math.min(Math.round(metrics.width * 0.42), metrics.width - constants.ROOT_RIGHT_GUTTER)
      ),
      y: Math.max(
        260,
        Math.min(Math.round(metrics.height * 0.48), metrics.height - constants.ROOT_BOTTOM_GUTTER)
      )
    };
  },

  getRadiusL1(metrics) {
    return Math.max(180, Math.min(250, Math.round(metrics.width * 0.20)));
  },

  getRadiusL2(metrics) {
    return Math.max(130, Math.min(190, Math.round(metrics.width * 0.14)));
  },

  distributeAngles(count, baseAngle = -10) {
    if (count <= 0) return [baseAngle];
    if (count === 1) return [baseAngle];

    const totalSpread = Math.min(220, Math.max(90, (count - 1) * 36));
    const startAngle = baseAngle - totalSpread / 2;

    return Array.from({ length: count }, (_, i) => {
      return startAngle + (totalSpread * i / (count - 1));
    });
  },

  offsetByAngle(origin, radius, angle) {
    return {
      x: origin.x + radius * Math.cos(angle * Math.PI / 180),
      y: origin.y + radius * Math.sin(angle * Math.PI / 180)
    };
  }
};
