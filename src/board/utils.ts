import type { Box, Vector, Direction } from './element.js';

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
