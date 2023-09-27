import Space from './space'
import { deserializeObject } from '../action/utils';

import type { ElementJSON, ElementClass } from './types';
import type { GameElement } from './';
import type { Player } from '../player';

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
    if (this._ctx.game) rest = deserializeObject({...rest}, this._ctx.game);
    if (this.constructor.name !== className) throw Error(`Cannot create board from JSON. ${className} must equal ${this.constructor.name}`);

    // reset all on self
    for (const key of Object.keys(this)) {
      if (!['_ctx', '_t', '_eventHandlers', 'board', 'game', 'pile'].includes(key) && !(key in rest))
        rest[key] = undefined;
    }
    Object.assign(this, {...rest});
    if (children) this.createChildrenFromJSON(children);
    this._ctx.removed.createChildrenFromJSON(boardJSON.slice(1));
  }
}
