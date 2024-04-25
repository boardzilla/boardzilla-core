import FixedGrid from "./fixed-grid.js";
import { times } from '../utils.js';

import type Game from './game.js';
import type { ElementUI } from "./element.js";

/**
 * A Hex grid. Create the HexGrid with 'rows' and 'columns' values to
 * automatically create the spaces. Optionally use {@link shape} and {@link
 * axes} to customize the type of hex.
 * @category Board
 *
 * @example
 * game.create(HexGrid, 'catan-board', { rows: 5, columns: 5, shape: 'hex' })
 */
export default class HexGrid<G extends Game> extends FixedGrid<G> {

  /**
   * Determines which direction the rows and columns go within the
   * hex. E.g. with east-by-southwest axes, The cell at {row: 1, column: 2} is
   * directly east of {row: 1, column: 1}. The cell at {row: 2, column: 1} is
   * directly southwest of {row: 1, column: 1}.
   * @category Adjacency
   */
  axes: 'east-by-southwest' | 'east-by-southeast' | 'southeast-by-south' | 'northeast-by-south' = 'east-by-southwest';
  /**
   * Determines the overall shape of the spaces created.
   *
   * rhomboid - A rhomboid shape. This means a cell will exist at every row and
   * column combination. A 3x3 rhomboid hex contains 9 cells.
   *
   * hex - A hex shape. This means the hex will be at most row x columns but
   * will be missing cells at the corners. A 3x3 hex shape contains 7 cells.
   *
   * square - A square shape. This means the hex will be at most row x columns
   * but will be shaped to keep a square shape. Some cells will therefore have a
   * column value outside the range of columns. A 3x3 square hex contains 8
   * cells, 3 on each side, and two in the middle.
   * @category Adjacency
   */
  shape: 'square' | 'hex' | 'rhomboid' = 'rhomboid';

  _ui: ElementUI<this> = {
    layouts: [],
    appearance: {},
    getBaseLayout: () => ({
      rows: this.rows,
      columns: this.columns,
      sticky: true,
      alignment: 'center',
      direction: 'square',
      offsetColumn: {
        'east-by-southwest': {x: 100, y: 0},
        'east-by-southeast': {x: 100, y: 0},
        'southeast-by-south': {x: 100, y: 50},
        'northeast-by-south': {x: 100, y: -50}
      }[this.axes],
      offsetRow: {
        'east-by-southwest': {x: -50, y: 100},
        'east-by-southeast': {x: 50, y: 100},
        'southeast-by-south': {x: 0, y: 100},
        'northeast-by-south': {x: 0, y: 100}
      }[this.axes]
    })
  };

  _adjacentGridPositionsTo(column: number, row: number): [number, number][] {
    const positions: [number, number][] = [];
    if (column > 1) {
      positions.push([column - 1, row]);
      if (['east-by-southwest', 'northeast-by-south'].includes(this.axes)) {
        positions.push([column - 1, row - 1]);
      }
      if (['east-by-southeast', 'southeast-by-south'].includes(this.axes)) {
        positions.push([column - 1, row + 1]);
      }
    }
    if (column < this.columns) {
      positions.push([column + 1, row]);
      if (['east-by-southeast', 'southeast-by-south'].includes(this.axes)) {
        positions.push([column + 1, row - 1]);
      }
      if (['east-by-southwest', 'northeast-by-south'].includes(this.axes)) {
        positions.push([column + 1, row + 1]);
      }
    }
    if (row > 1) positions.push([column, row - 1]);
    if (row < this.rows) positions.push([column, row + 1]);
    return positions;
  }

  _gridPositions(): [number, number][] {
    const positions: [number, number][] = [];
    if (this.shape === 'hex') {
      const topCorner = Math.ceil((Math.min(this.rows, this.columns) - 1) / 2);
      const bottomCorner = Math.floor((Math.min(this.rows, this.columns) - 1) / 2);
      const topRight = ['east-by-southwest', 'northeast-by-south'].includes(this.axes);
      times(this.rows, row => times(this.columns - Math.max(topCorner + 1 - row, 0) - Math.max(row - this.rows + bottomCorner, 0), col => {
        positions.push([col + Math.max(topRight ? bottomCorner + row - this.rows : topCorner - row + 1, 0), row]);
      }));
    } else if (this.shape === 'square') {
      const squished = ['east-by-southeast', 'southeast-by-south'].includes(this.axes);
      if (['east-by-southwest', 'east-by-southeast'].includes(this.axes)) {
        times(this.rows, row => times(this.columns - (row % 2 ? 0 : 1), col => {
          positions.push([col + (squished ? 1 - Math.ceil(row / 2) : Math.floor(row / 2)), row])
        }));
      } else {
        times(this.columns, col => times(this.rows - (col % 2 ? 0 : 1), row => {
          positions.push([col, row + (squished ? Math.floor(col / 2) : 1 - Math.ceil(col / 2))])
        }));
      }
    } else {
      times(this.rows, row => times(this.columns, col => positions.push([col, row])));
    }
    return positions;
  }

  _cornerPositions(): [number, number][] {
    if (this.shape === 'hex') {
      const topCorner = Math.ceil((Math.min(this.rows, this.columns) - 1) / 2);
      const bottomCorner = Math.floor((Math.min(this.rows, this.columns) - 1) / 2);
      if (['east-by-southwest', 'northeast-by-south'].includes(this.axes)) {
        return [
          [1, 1],
          [this.columns - topCorner, 1],
          [1, Math.floor(this.rows / 2) + 1],
          [this.columns, Math.floor(this.rows / 2) + 1],
          [1 + bottomCorner, this.rows],
          [this.columns, this.rows],
        ];
      } else {
        return [
          [1 + topCorner, 1],
          [this.columns, 1],
          [1, Math.floor(this.rows / 2) + 1],
          [this.columns, Math.floor(this.rows / 2) + 1],
          [1, this.rows],
          [this.columns - bottomCorner, this.rows],
        ];
      }
    } else if (this.shape === 'square') {
      if (['east-by-southwest'].includes(this.axes)) {
        return [
          [1, 1],
          [this.columns, 1],
          [1 + Math.floor(this.rows / 2), this.rows],
          [this.columns - 1 + Math.ceil(this.rows / 2), this.rows],
        ];
      } else if (['east-by-southeast'].includes(this.axes)) {
        return [
          [1, 1],
          [this.columns, 1],
          [2 - Math.ceil(this.rows / 2), this.rows],
          [this.columns - Math.floor(this.rows / 2), this.rows],
        ];
      } else if (['southeast-by-south'].includes(this.axes)) {
        return [
          [1, 1],
          [1, this.rows],
          [this.columns, 2 - Math.ceil(this.columns / 2)],
          [this.columns, this.rows - Math.floor(this.columns / 2)],
        ];
      } else {
        return [
          [1, 1],
          [1, this.rows],
          [this.columns, 1 + Math.floor(this.columns / 2)],
          [this.columns, this.rows - 1 + Math.ceil(this.columns / 2)],
        ];
      }
    }
    return [
      [1, 1],
      [this.columns, 1],
      [1, this.rows],
      [this.columns, this.rows],
    ];
  }
}
