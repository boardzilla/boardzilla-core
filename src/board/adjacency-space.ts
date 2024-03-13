import Space from './space.js';
import GameElement from './element.js';

import type Game from './game.js';
import type { LayoutAttributes } from './element.js';

export default abstract class AdjacencySpace<G extends Game> extends Space<G> {

  static _baseLayout: LayoutAttributes<GameElement> = {
    margin: 0,
    scaling: 'fit',
    sticky: true,
    alignment: 'center',
    gap: 0,
    direction: 'square'
  };

  isAdjacent(_el1: GameElement, _el2: GameElement): boolean {
    throw Error("Abstract AdjacencySpace has no implementation");
  }

  _positionOf(element: GameElement) {
    const positionedParent = this._positionedParentOf(element);
    return {column: positionedParent.column, row: positionedParent.row};
  }

  _positionedParentOf(element: GameElement): GameElement {
    if (!element._t.parent) throw Error(`Element not found within adjacency space "${this.name}"`);
    return element._t.parent === this ? element : this._positionedParentOf(element._t.parent);
  }

  layout() {
    throw Error("Additional layouts may not be added to grids or connected spaces. The base layout can instead be configured with configureLayout.");
  }

  configureLayout(layoutConfiguration: Partial<LayoutAttributes<GameElement>>) {
    const keys = Object.keys(layoutConfiguration);
    if (keys.includes('scaling') || keys.includes('alignment')) {
      throw Error("Layouts for grids cannot have alignment, scaling");
    }
    this._ui.layouts = [{
      applyTo: GameElement,
      attributes: {
        ...(this.constructor as typeof GameElement)._baseLayout,
        ...layoutConfiguration,
      }
    }]
  }

  resetUI() {
    if (!this._ui.layouts.length) this.configureLayout({});
    this._ui.appearance = {};
    this._ui.computedStyle = undefined;
    for (const child of this._t.children) child.resetUI();
  }
}
