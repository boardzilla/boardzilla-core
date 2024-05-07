import GameElement from './element.js';

import type { BaseGame } from './game.js';
import type { ElementUI, LayoutAttributes } from './element.js';
import SingleLayout from './single-layout.js';

/**
 * Abstract base class for all adjacency spaces
 */
export default abstract class AdjacencySpace<G extends BaseGame> extends SingleLayout<G> {

  _ui: ElementUI<this> = {
    layouts: [],
    appearance: {},
    getBaseLayout: () => ({
      sticky: true,
      alignment: 'center',
      direction: 'square'
    })
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

  /**
   * Change the layout attributes for this space's layout.
   * @category UI
   */
  configureLayout(layoutConfiguration: Partial<LayoutAttributes<GameElement>>) {
    const keys = Object.keys(layoutConfiguration);
    if (keys.includes('scaling') || keys.includes('alignment')) {
      throw Error("Layouts for grids cannot have alignment, scaling");
    }
    super.configureLayout(layoutConfiguration);
  }
}
