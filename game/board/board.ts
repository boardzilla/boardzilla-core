import Space from './space'
import type { ElementJSON, ElementClass } from './types';
import type { GameElement } from './';

export default class Board extends Space {
  pile: GameElement;

  constructor(...classes: ElementClass<GameElement>[]) {
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
    const { className, children, _id, ...rest } = boardJSON[0];
    if (this.constructor.name !== className) throw Error(`Cannot create board from JSON. ${className} must equal ${this.constructor.name}`);

    // reset all on self
    Object.assign(this, {...rest});
    if (children) this.createChildrenFromJSON(children);
    this._ctx.removed.createChildrenFromJSON(boardJSON.slice(1));
  }
}
