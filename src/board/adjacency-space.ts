import Space from './space.js';
import GameElement from './element.js';

import type { BaseGame } from './game.js';
import type { ElementUI, LayoutAttributes } from './element.js';

/**
 * Abstract base class for all adjacency spaces
 */
export default abstract class AdjacencySpace<G extends BaseGame> extends Space<G> {

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
   * Adjacency grids are stricter and can only contain elements of a certain
   * type. Rather than adding multiple, overlapping layouts for different
   * elements, there is a single layout that can be modified using {@link
   * configureLayout}.
   * @category UI
   */
  layout() {
    throw Error("Additional layouts may not be added to grids or connected spaces. The base layout can instead be configured with configureLayout.");
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
    this._ui.layouts = [{
      applyTo: GameElement,
      attributes: {
        ...this._ui.getBaseLayout(),
        ...layoutConfiguration,
      }
    }]
  }

  resetUI() {
    if (!this._ui.layouts.length) this.configureLayout({});
    this._ui.appearance = {};
    for (const child of this._t.children) child.resetUI();
  }
}
