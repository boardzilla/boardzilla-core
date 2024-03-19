import type { Box, Vector, Direction } from './element.js';

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

export function cellBoxRC(
  column: number,
  row: number,
  area: Box,
  size: {width: number, height: number},
  columns: number,
  rows: number,
  startingOffset: Vector,
  cellGap?: Vector,
  offsetColumn?: Vector,
  offsetRow?: Vector,
): Box | undefined {
  if (column > columns || row > rows) return;
  column -= 1;
  row -= 1;

  return {
    left: area!.left + startingOffset.x + (
      cellGap ?
        column * (size.width + cellGap!.x) :
        (size!.width * (column * offsetColumn!.x + row * offsetRow!.x)) / 100
    ),
    top: area!.top + startingOffset.y + (
      cellGap ?
        row * (size.height + cellGap!.y) :
        (size!.height * (row * offsetRow!.y + column * offsetColumn!.y)) / 100
    ),
    width: size.width,
    height: size.height,
  }
}

export function cellSizeForArea(
  rows: number,
  columns: number,
  area: { width: number, height: number },
  gap?: Vector,
  offsetColumn?: Vector,
  offsetRow?: Vector,
  rhomboid?: boolean
) {
  let width: number;
  let height: number;

  if (offsetColumn === undefined) {
    width = (area.width - (gap!.x || 0) * (columns - 1)) / columns;
    height = (area.height - (gap!.y || 0) * (rows - 1)) / rows;
  } else {
    width = area.width / (
      (rhomboid ? (rows - 1) * Math.abs(offsetRow!.x / 100) : 0) +
        1 + (columns - 1) * Math.abs(offsetColumn.x / 100)
    )
    height = area.height / (
      (rhomboid ? (columns - 1) * Math.abs(offsetColumn.y / 100) : 0) +
        1 + (rows - 1) * Math.abs(offsetRow!.y / 100)
    )
  }

  return { width, height };
}

// find the edge boxes and calculate the total size needed
// @internal
export function getTotalArea(
  corners: [number, number][],
  area: Box,
  size: {width: number, height: number},
  columns: number,
  rows: number,
  startingOffset: Vector,
  cellGap?: Vector,
  offsetColumn?: Vector,
  offsetRow?: Vector,
): Box {
  const boxes = corners.map(corner => (
    cellBoxRC(corner[0], corner[1], area, size, columns, rows, startingOffset, cellGap, offsetColumn, offsetRow)
  ));

  const cellArea = {
    top: Math.min(...boxes.map(b => b!.top)),
    bottom: Math.max(...boxes.map(b => b!.top + b!.height)),
    left: Math.min(...boxes.map(b => b!.left)),
    right: Math.max(...boxes.map(b => b!.left + b!.width)),
  };

  return {
    width: cellArea.right - cellArea.left,
    height: cellArea.bottom - cellArea.top,
    left: cellArea.left,
    top: cellArea.top
  }
}

export function rotateDirection(dir: Direction, rotation: number) {
  rotation = (rotation % 360 + 360) % 360;
  if (rotation === 0) return dir;
  let angle: number;
  if (dir === 'up') {
    angle = rotation;
  } else if (dir === 'down') {
    angle = (rotation + 180) % 360;
  } else if (dir === 'right') {
    angle = (rotation + 90) % 360;
  } else {
    angle = (rotation + 270) % 360;
  }

  if (angle === 0) {
    return 'up';
  } else if (angle === 90) {
    return 'right';
  } else if (angle === 180) {
    return 'down';
  }
  return 'left';
}
