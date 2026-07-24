(function exposeCollision(global) {
  function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function computeRotatedBox(width, height, degrees) {
    const radians = Math.abs(toRadians(degrees));
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    return {
      width: width * cos + height * sin,
      height: width * sin + height * cos,
    };
  }

  function polygonForItem(item, dx = 0, dy = 0, padding = 0) {
    const halfW = item.width / 2 + padding;
    const halfH = item.height / 2 + padding;
    const angle = toRadians(item.rotation);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const centerX = item.x + dx;
    const centerY = item.y + dy;
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ];

    return corners.map((point) => ({
      x: centerX + point.x * cos - point.y * sin,
      y: centerY + point.x * sin + point.y * cos,
    }));
  }

  function boundsForPolygon(polygon) {
    return polygon.reduce(
      (bounds, point) => ({
        left: Math.min(bounds.left, point.x),
        right: Math.max(bounds.right, point.x),
        top: Math.min(bounds.top, point.y),
        bottom: Math.max(bounds.bottom, point.y),
      }),
      { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
    );
  }

  function axesForPolygon(polygon) {
    const axes = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      const edge = { x: next.x - current.x, y: next.y - current.y };
      const normal = { x: -edge.y, y: edge.x };
      const length = Math.hypot(normal.x, normal.y) || 1;
      axes.push({ x: normal.x / length, y: normal.y / length });
    }
    return axes;
  }

  function projectPolygon(polygon, axis) {
    let min = Infinity;
    let max = -Infinity;
    polygon.forEach((point) => {
      const value = point.x * axis.x + point.y * axis.y;
      min = Math.min(min, value);
      max = Math.max(max, value);
    });
    return { min, max };
  }

  function polygonsOverlapSAT(a, b) {
    const axes = axesForPolygon(a).concat(axesForPolygon(b));
    return axes.every((axis) => {
      const projectionA = projectPolygon(a, axis);
      const projectionB = projectPolygon(b, axis);
      return projectionA.max > projectionB.min && projectionB.max > projectionA.min;
    });
  }

  function itemBounds(item, dx = 0, dy = 0) {
    return boundsForPolygon(polygonForItem(item, dx, dy));
  }

  function intersectsTile(bounds, settings) {
    return (
      bounds.right >= 0 &&
      bounds.left <= settings.width &&
      bounds.bottom >= 0 &&
      bounds.top <= settings.height
    );
  }

  function wrapOffsets(item, settings) {
    const offsets = [];
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const dx = offsetX * settings.width;
        const dy = offsetY * settings.height;
        if (intersectsTile(itemBounds(item, dx, dy), settings)) offsets.push({ dx, dy });
      }
    }
    return offsets;
  }

  function collidesWithExisting(candidate, existingItems, settings, padding = 0) {
    const candidatePolygon = polygonForItem(candidate, 0, 0, padding / 2);

    return existingItems.some((item) => {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const dx = offsetX * settings.width;
          const dy = offsetY * settings.height;
          const itemPolygon = polygonForItem(item, dx, dy, padding / 2);
          if (polygonsOverlapSAT(candidatePolygon, itemPolygon)) return true;
        }
      }
      return false;
    });
  }

  global.PatternCollision = {
    collidesWithExisting,
    computeRotatedBox,
    itemBounds,
    polygonForItem,
    polygonsOverlapSAT,
    wrapOffsets,
  };
})(window);