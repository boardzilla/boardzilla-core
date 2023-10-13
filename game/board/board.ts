import Space from './space'
import { deserializeObject } from '../action/utils';

import type { ElementJSON, ElementClass, Box } from './types';
import type { GameElement } from './';
import type { Player } from '../player';

// TODO add B generic to all board elements
// e.g. can:
//   game: Game<P, typeof this>
//   board: typeof this

export default class Board<P extends Player> extends Space<P> {
  pile: GameElement<P>;

  constructor(...classes: ElementClass<P, GameElement<P>>[]) {
    super({ classRegistry: classes });
    this.board = this;
    this._ctx.removed = this.createElement(Space, 'removed');
    this.pile = this._ctx.removed;
  }

  // also gets removed elements
  allJSON(seenBy?: number): ElementJSON[] {
    return [this.toJSON(seenBy)].concat(
      this._ctx.removed._t.children.map(el => el.toJSON(seenBy))
    );
  }

  fromJSON(boardJSON: ElementJSON[]) {
    let { className, children, _id, ...rest } = boardJSON[0];
    if (this.game) rest = deserializeObject({...rest}, this.game);
    if (this.constructor.name !== className) throw Error(`Cannot create board from JSON. ${className} must equal ${this.constructor.name}`);

    // reset all on self
    for (const key of Object.keys(this)) {
      if (!['_ctx', '_t', '_ui', '_eventHandlers', 'board', 'game', 'pile'].includes(key) && !(key in rest))
        rest[key] = undefined;
    }
    Object.assign(this, {...rest});
    if (children) this.createChildrenFromJSON(children);
    this._ctx.removed.createChildrenFromJSON(boardJSON.slice(1));
  }

  // UI

  _ui: GameElement<P>['_ui'] & { frame?: Box };

  applyLayouts(force=false) {
    if (Board.aspectRatio) {
      this._ui.frame = {
        left: 0,
        top: 0,
        width: Board.aspectRatio > 1 ? Board.aspectRatio * 100 : 100,
        height: Board.aspectRatio < 1 ? 100 / Board.aspectRatio : 100
      };
    }
    return super.applyLayouts(force);
  }
}
