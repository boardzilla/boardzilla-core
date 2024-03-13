import FixedGrid from "./fixed-grid.js";
import { times } from '../utils.js';

import type Game from './game.js';

export default class HexGrid<G extends Game> extends FixedGrid<G> {
  /**
   * If set to 'true', inverts the column lines to go NW-SE instead of NE-SW.
   */
  inverseColumns?: boolean = false;
  shape: 'square' | 'hex' | 'rhomboid'

  _adjacentGridPositionsTo(column: number, row: number): [number, number, number?][] {
    const positions: [number, number, number?][] = [];
    if (column > 1) {
      positions.push([column - 1, row]);
      if (!this.inverseColumns && row > 1) positions.push([column - 1, row - 1]);
      if (this.inverseColumns && row < this.rows) positions.push([column - 1, row + 1]);
    }
    if (column < this.columns) {
      positions.push([column + 1, row]);
      if (this.inverseColumns && row > 1) positions.push([column + 1, row - 1]);
      if (!this.inverseColumns && row < this.rows) positions.push([column + 1, row + 1]);
    }
    if (row > 1) positions.push([column, row - 1]);
    if (row < this.rows) positions.push([column, row + 1]);
    return positions;
  }

  _gridPositions(): [number, number][] {
    const positions: [number, number][] = [];
    times(this.columns, col => times(this.rows, row => positions.push([col, row])));
    return positions;
  }
}
