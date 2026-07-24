(function exposeDistribution(global) {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function wrap(value, size) {
    return ((value % size) + size) % size;
  }

  function toroidalDistance(a, b, settings) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.hypot(Math.min(dx, settings.width - dx), Math.min(dy, settings.height - dy));
  }

  function keepInsideCanvas(point, settings, item) {
    if (settings.allowEdgeCuts) {
      return {
        x: wrap(point.x, settings.width),
        y: wrap(point.y, settings.height),
      };
    }

    const box = global.PatternCollision.computeRotatedBox(item.width, item.height, item.rotation);
    return {
      x: clamp(point.x, box.width / 2, settings.width - box.width / 2),
      y: clamp(point.y, box.height / 2, settings.height - box.height / 2),
    };
  }

  function randomPosition(settings, random, item) {
    return keepInsideCanvas(
      {
        x: random() * settings.width,
        y: random() * settings.height,
      },
      settings,
      item,
    );
  }

  function gridPosition(index, settings, random) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(settings.count * (settings.width / settings.height))));
    const rows = Math.max(1, Math.ceil(settings.count / cols));
    const col = index % cols;
    const row = Math.floor(index / cols) % rows;
    const cellW = settings.width / cols;
    const cellH = settings.height / rows;

    return {
      x: (col + 0.5) * cellW + (random() - 0.5) * cellW * settings.jitter,
      y: (row + 0.5) * cellH + (random() - 0.5) * cellH * settings.jitter,
    };
  }

  function radiusOf(item) {
    return Math.hypot(item.width, item.height) / 2;
  }

  function scoreCandidate(point, placed, settings) {
    if (!placed.length) return Infinity;
    return placed.reduce((best, item) => {
      return Math.min(best, toroidalDistance(point, item, settings) - radiusOf(item));
    }, Infinity);
  }

  function blueNoisePosition(settings, random, item, placed) {
    const sampleCount = placed.length < 4 ? 12 : 28;
    let bestPoint = randomPosition(settings, random, item);
    let bestScore = -Infinity;

    for (let i = 0; i < sampleCount; i += 1) {
      const point = randomPosition(settings, random, item);
      const score = scoreCandidate(point, placed, settings);
      if (score > bestScore) {
        bestScore = score;
        bestPoint = point;
      }
    }

    return bestPoint;
  }

  function poissonDiskPosition(settings, random, item, placed, attempt) {
    if (!placed.length || attempt % 17 === 0) return blueNoisePosition(settings, random, item, placed);

    const base = placed[Math.floor(random() * placed.length)];
    const baseRadius = radiusOf(base);
    const itemRadius = radiusOf(item);
    const minDistance = Math.max(settings.spacing, settings.minPoissonDistance || 0) + baseRadius + itemRadius;
    const radius = minDistance * (1 + random());
    const angle = random() * Math.PI * 2;

    return keepInsideCanvas(
      {
        x: base.x + Math.cos(angle) * radius,
        y: base.y + Math.sin(angle) * radius,
      },
      settings,
      item,
    );
  }

  function positionForAttempt({ index, attempt, settings, random, item, placed }) {
    if (settings.distribution === "grid" && attempt === 0) {
      return keepInsideCanvas(gridPosition(index, settings, random), settings, item);
    }

    if (settings.distribution === "blue-noise") {
      return blueNoisePosition(settings, random, item, placed);
    }

    if (settings.distribution === "poisson-disk") {
      return poissonDiskPosition(settings, random, item, placed, attempt);
    }

    return randomPosition(settings, random, item);
  }

  global.PatternDistribution = {
    blueNoisePosition,
    gridPosition,
    poissonDiskPosition,
    positionForAttempt,
    randomPosition,
    toroidalDistance,
  };
})(window);