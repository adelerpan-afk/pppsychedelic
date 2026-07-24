(function exposeStats(global) {
  function toroidalDistance(a, b, settings) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.hypot(Math.min(dx, settings.width - dx), Math.min(dy, settings.height - dy));
  }

  function averageDistance(items, settings) {
    if (items.length < 2) return 0;
    let total = 0;
    let pairs = 0;

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        total += toroidalDistance(items[i], items[j], settings);
        pairs += 1;
      }
    }

    return pairs ? total / pairs : 0;
  }

  function areaOf(item) {
    return item.width * item.height;
  }

  function calculatePatternStats(items, settings, wrapOffsets) {
    const canvasArea = settings.width * settings.height;
    const areas = items.map(areaOf);
    const totalArea = areas.reduce((sum, area) => sum + area, 0);
    const duplicateEdgeObjects = items.reduce((sum, item) => {
      return sum + Math.max(0, wrapOffsets(item, settings).length - 1);
    }, 0);

    return {
      averageDistance: averageDistance(items, settings),
      canvasSize: `${settings.width} x ${settings.height}`,
      coverage: canvasArea ? (totalArea / canvasArea) * 100 : 0,
      duplicateEdgeObjects,
      largestObject: areas.length ? Math.max(...areas) : 0,
      objectCount: items.length,
      smallestObject: areas.length ? Math.min(...areas) : 0,
    };
  }

  global.PatternStats = {
    calculatePatternStats,
  };
})(window);