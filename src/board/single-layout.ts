import Space from './space.js';

import type { BaseGame } from './game.js';
import type { ElementUI } from './element.js';

/**
 * Abstract base class for all adjacency spaces
 */
export default abstract class SingleLayout<G extends BaseGame> extends Space<G> {

  _ui: ElementUI<this> = {
    layouts: [],
    appearance: {},
    getBaseLayout: () => ({
      alignment: 'center',
      direction: 'square'
    })
  };

  /**
   * Single layout space can only contain elements of a certain type. Rather
   * than adding multiple, overlapping layouts for different elements, there is
   * a single layout that can be modified using {@link configureLayout}.
   * @category UI
   */
  layout() {
    throw Error("Space cannot have additional layouts added. The layout can instead be configured with configureLayout.");
  }

  resetUI() {
    if (!this._ui.layouts.length) this.configureLayout({});
    this._ui.appearance = {};
    for (const child of this._t.children) child.resetUI();
  }
}
