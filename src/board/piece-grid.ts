import AdjacencySpace from "./adjacency-space.js";
import { rotateDirection } from './utils.js';
import Space from '../board/space.js';

import type Game from './game.js'
import type Piece from './piece.js'
import type { default as GameElement, Vector, Direction, LayoutAttributes } from "./element.js";
import type { ElementContext } from './element.js';

export default class PieceGrid<G extends Game> extends AdjacencySpace<G> {

  constructor(ctx: ElementContext) {
    super(ctx);
    this.onEnter(Space, () => { throw Error(`Only pieces can be added to the PieceGrid ${this.name}`); });
  }

  isAdjacent(el1: GameElement, el2: GameElement): boolean {
    return this.adjacenciesByCell(el1 as Piece<G>, el2 as Piece<G>).length > 0;
  }

  configureLayout(layoutConfiguration: Partial<LayoutAttributes<GameElement>>) {
    if ('margin' in layoutConfiguration || 'offsetRow' in layoutConfiguration || 'offsetColumn' in layoutConfiguration) {
      throw Error("PieceGrid cannot have margin or offsets");
    }
    super.configureLayout(layoutConfiguration);
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
      return Object.values(other._cellsAround({x: p1.x - p2.x, y: p1.y - p2.y})).reduce(
        (all, adj) => all.concat(adj !== undefined && adj !== ' ' ? [{piece: other, from: '.', to: adj}] : []),
        [] as {piece: Piece<G>, from: string, to: string}[]
      );
    }
    if (!other._size) {
      return Object.values(piece._cellsAround({x: p2.x - p1.x, y: p2.y - p1.y})).reduce(
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
        for (const cell of Object.values(other._cellsAround({x: x + p1.x - p2.x, y: y + p1.y - p2.y}))) {
          if (cell !== undefined && cell !== ' ') {
            adjacencies.push({piece: other, from: thisCell, to: cell});
          }
        }
      }
    }
    return adjacencies;
  }

  adjacenciesByEdge(piece: Piece<G>, other?: Piece<G>): {piece: Piece<G>, from?: string, to?: string}[] {
    if (!other) {
      // TODO reduce to single layout
      const layout = this._ui.computedLayouts?.find(l => l?.children.includes(this));
      const children = layout?.children ?? this._t.children;
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
      return (Object.entries(other._cellsAround({x: p1.x - p2.x, y: p1.y - p2.y})) as [Direction, string][]).reduce(
        (all, [dir, adj]) => all.concat(adj !== undefined && adj !== ' ' ? [{piece: other, from: undefined, to: other._size?.edges?.[adj][rotateDirection(dir, 180 - other.rotation)]}] : []),
        [] as {piece: Piece<G>, from?: string, to?: string}[]
      );
    }
    if (!other._size) {
      return (Object.entries(piece._cellsAround({x: p2.x - p1.x, y: p2.y - p1.y})) as [Direction, string][]).reduce(
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
        for (const [dir, cell] of Object.entries(other._cellsAround({x: x + p1.x - p2.x, y: y + p1.y - p2.y})) as [Direction, string][]) {
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
