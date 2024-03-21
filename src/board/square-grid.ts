import FixedGrid from "./fixed-grid.js";
import { times } from '../utils.js';

import type Game from './game.js';

/**
 * A Square grid. Create the SquareGrid with 'rows' and 'columns' values to
 * automatically create the spaces.
 *
 * @example
 * game.create(SquareGrid, 'chess-board', { rows: 8, columns: 8 })
 */
export default class SquareGrid<G extends Game> extends FixedGrid<G> {
  /**
   * Optionally add a measurement for diagonal adjacencies on this grid. If
   * undefined, diagonals are not considered directly adjacent.
   * @category Adjacency
   */
  diagonalDistance?: number;

  _adjacentGridPositionsTo(column: number, row: number): [number, number, number?][] {
    const positions: [number, number, number?][] = [];
    if (column > 1) {
      positions.push([column - 1, row]);
      if (this.diagonalDistance !== undefined) {
        positions.push([column - 1, row - 1, this.diagonalDistance]);
        positions.push([column - 1, row + 1, this.diagonalDistance]);
      }
    }
    if (column < this.columns) {
      positions.push([column + 1, row]);
      if (this.diagonalDistance !== undefined) {
        positions.push([column + 1, row - 1, this.diagonalDistance]);
        positions.push([column + 1, row + 1, this.diagonalDistance]);
      }
    }
    positions.push([column, row - 1]);
    positions.push([column, row + 1]);
    return positions;
  }

  _gridPositions(): [number, number][] {
    const positions: [number, number][] = [];
    times(this.rows, row => times(this.columns, col => positions.push([col, row])));
    return positions;
  }
}
