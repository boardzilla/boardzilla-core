import ConnectedSpaceMap from "./connected-space-map.js";

import type Game from './game.js';
import type Space from './space.js';
import type { default as GameElement, ElementClass, ElementUI } from "./element.js";

export default abstract class FixedGrid<G extends Game> extends ConnectedSpaceMap<G> {

  rows: number;
  columns: number;
  space: ElementClass<Space<G>>

  _ui: ElementUI<this> = {
    layouts: [],
    appearance: {},
    getBaseLayout: () => ({
      rows: this.rows,
      columns: this.columns,
      sticky: true,
      alignment: 'center',
      direction: 'square'
    })
  };

  static unserializableAttributes = [...ConnectedSpaceMap.unserializableAttributes, 'space'];

  afterCreation() {
    const name = this.name + '-' + this.space.name.toLowerCase();
    const grid: Space<G>[][] = [];
    for (const [column, row] of this._gridPositions()) {
      const space = this.createElement(this.space, name, {column, row});
      space._t.parent = this;
      this._t.children.push(space);
      this._graph.addNode(space._t.id, {space});
      grid[column] ??= [];
      grid[column][row] = space;
    }
    for (const space of this._t.children) {
      for (const [column, row, distance] of this._adjacentGridPositionsTo(space.column!, space.row!)) {
        if (grid[column]?.[row]) this._graph.addDirectedEdge(space._t.id, grid[column][row]._t.id, {distance: distance ?? 1});
      }
    }
    this.configureLayout({ rows: this.rows, columns: this.columns });
  }

  create<T extends GameElement>(_className: ElementClass, _name: string): T {
    throw Error("Fixed grids automatically create it's own spaces. Spaces can be destroyed but not created");
  }

  _adjacentGridPositionsTo(_column: number, _row: number): [number, number, number?][] {
    return []; // unimplemented
  }

  _gridPositions(): [number, number][] {
    return []; // unimplemented
  }
}
