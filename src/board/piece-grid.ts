import AdjacencySpace from "./adjacency-space.js";
import { rotateDirection } from './utils.js';
import Space from '../board/space.js';

import type Game from './game.js'
import type Piece from './piece.js'
import type { default as GameElement, Vector, Direction, DirectionWithDiagonals } from "./element.js";
import type { ElementContext, ElementUI } from './element.js';

/**
 * A grid that tracks adjacency for pieces placed within it. This is useful for
 * tile placement games, e.g. dominoes. Only pieces can be placed in a PieceGrid
 * and each must have a column and row. Pieces that have been assigned irregular
 * shapes using {@link Piece#setShape} will be rendered as taking up more than a
 * single cell in the grid, depending on their shape. Adjacency is calculated
 * for the entire shape.
 * @category Board
 */
export default class PieceGrid<G extends Game> extends AdjacencySpace<G> {

  /**
   * If true, the space will be automatically enlarged when new places are added
   * using {@link Action#placePiece}.
   * @category Adjacency
   */
  extendableGrid: boolean = true;
  /**
   * Initial number of rows to render, but this can increase if {@link
   * extendableGrid} is true.
   * @category Adjacency
   */
  rows: number = 1;
  /**
   * Initial number of columns to render, but this can increase if {@link
   * extendableGrid} is true.
   * @category Adjacency
   */
  columns: number = 1;
  /**
   * Whether to consider tiles that touch at the corners to be adjacent when
   * using adjacenciesByCell.
   * @category Adjacency
   */
  diagonalAdjacency: boolean = false

  _ui: ElementUI<this> = {
    layouts: [],
    appearance: {},
    getBaseLayout: () => ({
      rows: this.rows,
      columns: this.columns,
      aspectRatio: 1,
      alignment: 'center',
      direction: 'square'
    })
  };

  constructor(ctx: ElementContext) {
    super(ctx);
    this.onEnter(Space, () => { throw Error(`Only pieces can be added to the PieceGrid ${this.name}`) });
  }

  isAdjacent(el1: GameElement, el2: GameElement): boolean {
    return this.adjacenciesByCell(el1 as Piece<G>, el2 as Piece<G>).length > 0;
  }

  _sizeNeededFor(element: GameElement) {
    if (!element._size) return {width: 1, height: 1};
    if (element.rotation % 180 === 90) return {
      width: element._size.height,
      height: element._size.width
    }
    return {
      width: element._size.width,
      height: element._size.height
    }
  }

  // internal
  cellsAround(piece: Piece<G>, pos: Vector) {
    const adjacencies: Partial<Record<DirectionWithDiagonals, string>> = {
      up: piece._cellAt({y: pos.y - 1, x: pos.x}),
      down: piece._cellAt({y: pos.y + 1, x: pos.x}),
      left: piece._cellAt({y: pos.y, x: pos.x - 1}),
      right: piece._cellAt({y: pos.y, x: pos.x + 1})
    };
    if (this.diagonalAdjacency) {
      adjacencies.upleft = piece._cellAt({y: pos.y - 1, x: pos.x - 1});
      adjacencies.upright = piece._cellAt({y: pos.y - 1, x: pos.x + 1});
      adjacencies.downleft = piece._cellAt({y: pos.y + 1, x: pos.x - 1});
      adjacencies.downright = piece._cellAt({y: pos.y + 1, x: pos.x + 1});
    }
    return adjacencies;
  }

  // internal
  isOverlapping(piece: Piece<G>, other?: Piece<G>): boolean {
    if (!other) {
      return this._t.children.some(p => p !== piece && this.isOverlapping(piece, p as Piece<G>));
    }
    const p1: Vector = {x: piece.column!, y: piece.row!};
    const p2: Vector = {x: other.column!, y: other.row!};
    if (!piece._size && !other._size) return p2.y === p1.y && p2.x === p1.x;
    if (piece.rotation % 90 !== 0 || other.rotation % 90 !== 0) return false; // unsupported to calculate for irregular shapes at non-orthoganal orientations
    if (!piece._size) return (other._cellAt({y: p1.y - p2.y, x: p1.x - p2.x}) ?? ' ') !== ' ';
    if (!other._size) return (piece._cellAt({y: p2.y - p1.y, x: p2.x - p1.x}) ?? ' ') !== ' ';
    const gridSize1 = this._sizeNeededFor(piece);
    const gridSize2 = this._sizeNeededFor(other);
    if (
      p2.y >= p1.y + gridSize1.height ||
      p2.y + gridSize2.height <= p1.y ||
      p2.x >= p1.x + gridSize1.width ||
      p2.x + gridSize2.width <= p1.x
    ) return false;
    const size = Math.max(piece._size.height, piece._size.width);
    for (let x = 0; x !== size; x += 1) {
      for (let y = 0; y !== size; y += 1) {
        if ((piece._cellAt({x, y}) ?? ' ') !== ' ' && (other._cellAt({x: x + p1.x - p2.x, y: y + p1.y - p2.y}) ?? ' ') !== ' ') {
          return true;
        }
      }
    }
    return false;
  }

  // internal
  _fitPieceInFreePlace(piece: Piece<G>, rows: number, columns: number, origin: {column: number, row: number}) {
    const tryLaterally = (vertical: boolean, d: number): boolean => {
      for (let lateral = 0; lateral < d + (vertical ? 0 : 1); lateral = -lateral + (lateral < 1 ? 1 : 0)) {
        if (vertical) {
          if (row + lateral <= 0 || row + lateral + gridSize.height - 1 > rows) continue;
          piece.row = row + lateral + origin.row - 1;
        } else {
          if (column + lateral <= 0 || column + lateral + gridSize.width - 1 > columns) continue;
          piece.column = column + lateral + origin.column - 1;
        }
        if (!this.isOverlapping(piece)) return true;
      }
      return false;
    }

    let gridSize = this._sizeNeededFor(piece);
    piece._rotation ??= 0;
    const row = piece.row === undefined ? Math.floor((rows - gridSize.height) / 2) : piece.row - origin.row + 1;
    const column = piece.column === undefined ? Math.floor((columns - gridSize.width) / 2) : piece.column - origin.column + 1;
    let possibleRotations = [piece._rotation, ...(piece._size ? [piece._rotation + 90, piece._rotation + 180, piece._rotation + 270] : [])];
    while (possibleRotations.length) {
      piece._rotation = possibleRotations.shift()!;
      gridSize = this._sizeNeededFor(piece);
      for (let distance = 0; distance < rows || distance < columns; distance += 1) {
        if (column - distance > 0 && column - distance + gridSize.width - 1 <= columns) {
          piece.column = column - distance + origin.column - 1;
          if (tryLaterally(true, distance || 1)) return;
        }
        if (distance && column + distance > 0 && column + distance + gridSize.width - 1 <= columns) {
          piece.column = column + distance + origin.column - 1;
          if (tryLaterally(true, distance)) return;
        }
        if (distance && row - distance > 0 && row - distance + gridSize.height - 1 <= rows) {
          piece.row = row - distance + origin.row - 1;
          if (tryLaterally(false, distance)) return;
        }
        if (distance && row + distance > 0 && row + distance + gridSize.height - 1 <= rows) {
          piece.row = row + distance + origin.row - 1;
          if (tryLaterally(false, distance)) return;
        }
      }
    }
    piece.row = undefined;
    piece.column = undefined;
  }

  /**
   * Returns a list of other Pieces in the grid that have a touching edge (or
   * touching corner if {@link diagonalAdjacency} is true} with this shape. Each
   * item in the list contains the adjacent Piece, as well as the string
   * representation of cells in both pieces, as provided in {@link
   * Piece#setShape}.
   * @category Adjacency
   *
   * @param piece - The piece to check for adjacency
   * @param other - An optional other piece to check against. If undefined, it
   * will check for all pieces against the first argument
   *
   * @example
   *
   * A domino named "domino12" is adjacent to a domino named "domino34" with the
   * 2 touching the 3:
   *
   * domino12.setShape('12');
   * domino34.setShape('34');
   * board.adjacenciesByCell(domino12) =>
   *    [
   *      {
   *        piece: domino34,
   *        from: '2',
   *        to: '3'
   *      }
   *    ]
   */
  adjacenciesByCell(piece: Piece<G>, other?: Piece<G>): {piece: Piece<G>, from: string, to: string}[] {
    if (!other) {
      return this._t.children.reduce(
        (all, p) => all.concat(p !== piece ? this.adjacenciesByCell(piece, p as Piece<G>) : []),
        [] as {piece: Piece<G>, from: string, to: string}[]
      );
    }
    const p1: Vector = {x: piece.column!, y: piece.row!};
    const p2: Vector = {x: other.column!, y: other.row!};

    // unsupported to calculate at non-orthoganal orientations
    if (p1.y === undefined || p1.x === undefined || piece.rotation % 90 !== 0 || p2.y === undefined || p2.x === undefined || other.rotation % 90 !== 0) return [];

    if (!piece._size) {
      return Object.values(this.cellsAround(other, {x: p1.x - p2.x, y: p1.y - p2.y})).reduce(
        (all, adj) => all.concat(adj !== undefined && adj !== ' ' ? [{piece: other, from: '.', to: adj}] : []),
        [] as {piece: Piece<G>, from: string, to: string}[]
      );
    }
    if (!other._size) {
      return Object.values(this.cellsAround(piece, {x: p2.x - p1.x, y: p2.y - p1.y})).reduce(
        (all, adj) => all.concat(adj !== undefined && adj !== ' ' ? [{piece: other, from: adj, to: '.'}] : []),
        [] as {piece: Piece<G>, from: string, to: string}[]
      );
    }
    const gridSize1 = this._sizeNeededFor(piece);
    const gridSize2 = this._sizeNeededFor(other);
    if (
      p2.y >= p1.y + 1 + gridSize1.height ||
      p2.y + 1 + gridSize2.height <= p1.y ||
      p2.x >= p1.x + 1 + gridSize1.width ||
      p2.x + 1 + gridSize2.width <= p1.x
    ) return [];
    const size = Math.max(piece._size.height, piece._size.width);
    const adjacencies = [] as {piece: Piece<G>, from: string, to: string}[];
    for (let x = 0; x !== size; x += 1) {
      for (let y = 0; y !== size; y += 1) {
        const thisCell = piece._cellAt({x, y});
        if (thisCell === undefined || thisCell === ' ') continue;
        for (const cell of Object.values(this.cellsAround(other, {x: x + p1.x - p2.x, y: y + p1.y - p2.y}))) {
          if (cell !== undefined && cell !== ' ') {
            adjacencies.push({piece: other, from: thisCell, to: cell});
          }
        }
      }
    }
    return adjacencies;
  }

  /**
   * Returns a list of other Pieces in the grid that have a touching edge with
   * this shape. Each item in the list contains the adjacent Piece, as well as
   * the string representation of the edges in both pieces, as provided in
   * {@link Piece#setEdges}.
   * @category Adjacency
   *
   * @param piece - The piece to check for adjacency
   * @param other - An optional other piece to check against. If undefined, it
   * will check for all pieces against the first argument
   *
   * @example
   *
   * A tile named "corner" is adjacent directly to the left of a tile named
   * "bridge".
   *
   * corner.setEdges({
   *   up: 'road',
   *   right: 'road'
   * });
   *
   * bridge.setEdges({
   *   up: 'river',
   *   down: 'river',
   *   left: 'road'
   *   right: 'road'
   * });
   *
   * board.adjacenciesByCell(corner) =>
   *    [
   *      {
   *        piece: bridge,
   *        from: 'road',
   *        to: 'road'
   *      }
   *    ]
   */
  adjacenciesByEdge(piece: Piece<G>, other?: Piece<G>): {piece: Piece<G>, from?: string, to?: string}[] {
    if (!other) {
      const children = this._t.children;
      return children.reduce(
        (all, p) => all.concat(p !== piece ? this.adjacenciesByEdge(piece, p as Piece<G>) : []),
        [] as {piece: Piece<G>, from?: string, to?: string}[]
      );
    }
    const p1: Vector = {x: piece.column!, y: piece.row!};
    const p2: Vector = {x: other.column!, y: other.row!};
    if (p2.y === undefined || p2.x === undefined || other.rotation % 90 !== 0) return [];

    if (piece.rotation % 90 !== 0 || other.rotation % 90 !== 0) return []; // unsupported to calculate at non-orthoganal orientations
    if (!piece._size) {
      return (Object.entries(this.cellsAround(other, {x: p1.x - p2.x, y: p1.y - p2.y})) as [Direction, string][]).reduce(
        (all, [dir, adj]) => all.concat(adj !== undefined && adj !== ' ' ? [{piece: other, from: undefined, to: other._size?.edges?.[adj][rotateDirection(dir, 180 - other.rotation)]}] : []),
        [] as {piece: Piece<G>, from?: string, to?: string}[]
      );
    }
    if (!other._size) {
      return (Object.entries(this.cellsAround(piece, {x: p2.x - p1.x, y: p2.y - p1.y})) as [Direction, string][]).reduce(
        (all, [dir, adj]) => all.concat(adj !== undefined && adj !== ' ' ? [{piece: other, from: piece._size?.edges?.[adj][rotateDirection(dir, 180 - piece.rotation)], to: undefined}] : []),
        [] as {piece: Piece<G>, from?: string, to?: string}[]
      );
    }
    const gridSize1 = this._sizeNeededFor(piece);
    const gridSize2 = this._sizeNeededFor(other);
    if (
      p2.y >= p1.y + 1 + gridSize1.height ||
      p2.y + 1 + gridSize2.height <= p1.y ||
      p2.x >= p1.x + 1 + gridSize1.width ||
      p2.x + 1 + gridSize2.width <= p1.x
    ) return [];
    const size = Math.max(piece._size.height, piece._size.width);
    const adjacencies = [] as {piece: Piece<G>, from?: string, to?: string}[];
    for (let x = 0; x !== size; x += 1) {
      for (let y = 0; y !== size; y += 1) {
        const thisCell = piece._cellAt({x, y});
        if (thisCell === undefined || thisCell === ' ') continue;
        for (const [dir, cell] of Object.entries(this.cellsAround(other, {x: x + p1.x - p2.x, y: y + p1.y - p2.y})) as [Direction, string][]) {
          if (cell !== undefined && cell !== ' ') {
            adjacencies.push({
              piece: other,
              from: piece._size?.edges?.[thisCell][rotateDirection(dir, -piece.rotation)],
              to: other._size?.edges?.[cell][rotateDirection(dir, 180 - other.rotation)]
            });
          }
        }
      }
    }
    return adjacencies;
  }
}
