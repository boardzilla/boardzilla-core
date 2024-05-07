import SingleLayout from './single-layout.js';

import type { BaseGame } from './game.js';
import type { ElementUI } from './element.js';

/**
 * A Stack hides all movement information within to avoid exposing the identity
 * of pieces inside the stack. Useful for decks of cards where calling
 * `shuffle()` should prevent players from knowing the order of the cards. By
 * default elements in a stack are hidden and are rendered as a stack with a
 * small offset and a limited number of items. Use configureLayout to change
 * this.
 */
export default class Stack<G extends BaseGame> extends SingleLayout<G> {
  _ui: ElementUI<this> = {
    layouts: [],
    appearance: {},
    getBaseLayout: () => ({
      columns: 1,
      offsetRow: { x: 2, y: 2 },
      scaling: 'fit',
      alignment: 'center',
      direction: 'ltr',
      limit: 10,
    })
  };

  afterCreation() {
    this._t.order = 'stacking';
    this.contentsWillBeHidden();
  }
}
