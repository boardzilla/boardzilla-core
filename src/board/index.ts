import GameElement from './element.js';
import ElementCollection from './element-collection.js';
export { GameElement, ElementCollection };
export { default as Space } from './space.js';
export { default as Piece } from './piece.js';
export { default as AdjacencySpace } from './adjacency-space.js';
export { default as ConnectedSpaceMap } from './connected-space-map.js';
export { default as FixedGrid } from './fixed-grid.js';
export { default as SquareGrid } from './square-grid.js';
export { default as HexGrid } from './hex-grid.js';
export { default as PieceGrid } from './piece-grid.js';
export { default as Game } from './game.js';

export type { ActionLayout } from './game.js';
export type { LayoutAttributes, Box, Vector } from './element.js';
export type { ElementFinder, Sorter } from './element-collection.js';

/**
 * Returns an {@link ElementCollection} by combining a list of {@link
 * GameElement}'s or {@link ElementCollection}'s,
 * @category Flow
 */
export function union<T extends GameElement>(...queries: (T | ElementCollection<T> | undefined)[]): ElementCollection<T> {
  let c = new ElementCollection<T>();
  for (const q of queries) {
    if (q) {
      if ('forEach' in q) {
        q.forEach(e => c.includes(e) || c.push(e));
      } else if (!c.includes(q)) {
        c.push(q);
      }
    }
  }
  return c;
}
