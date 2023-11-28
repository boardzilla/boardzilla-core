import { GameElement, ElementCollection } from './index.js';

import type { Box, Vector } from './element.js';

export function union(...queries: (GameElement | ElementCollection | undefined)[]): ElementCollection {
  let c = new ElementCollection();
  for (const q of queries) {
    if (q) {
      if ('forEach' in q) {
        q.forEach(e => c.push(e));
      } else {
        c.push(q);
      }
    }
  }
  return c;
}

export function translate(original: Box, transform: Box): Box {
  return shift(
    scale(original, { x: transform.width / 100, y: transform.height / 100 }),
    { x: transform.left, y: transform.top }
  );
}

export function scale(a: Box, v: Vector): Box {
  return {
    left: a.left * v.x,
    top: a.top * v.y,
    width: a.width * v.x,
    height: a.height * v.y
  }
}

export function shift(a: Box, v: Vector): Box {
  return {
    left: a.left + v.x,
    top: a.top + v.y,
    width: a.width,
    height: a.height
  }
}

export function cellSizeForArea(
  rows: number,
  columns: number,
  area: { width: number, height: number },
  gap?: Vector,
  offsetColumn?: Vector,
  offsetRow?: Vector
) {
  let width: number;
  let height: number;

  if (offsetColumn === undefined) {
    width = (area.width - (gap!.x || 0) * (columns - 1)) / columns;
    height = (area.height - (gap!.y || 0) * (rows - 1)) / rows;
  } else {
    width = area.width / (
      (rows - 1) * Math.abs(offsetColumn.x / 100) + 1 +
        (columns - 1) * Math.abs(offsetRow!.x / 100)
    )
    height = area.height / (
      (columns - 1) * Math.abs(offsetRow!.y / 100) + 1 +
        (rows - 1) * Math.abs(offsetColumn.y / 100)
    )
  }

  return { width, height };
}
