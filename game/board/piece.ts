import GameElement from './element'
import Space from './space'

import type { Player } from '../player';

export default class Piece<P extends Player> extends GameElement<P> {
  putInto(to: GameElement<P>, options?: {position?: number, fromTop?: number, fromBottom?: number}) {
    if (to.isDescendantOf(this)) throw Error(`Cannot put ${this} into itself`);
    let pos: number = to._t.order === 'stacking' ? 0 : to._t.children.length;
    if (options?.position !== undefined) pos = options.position >= 0 ? options.position : to._t.children.length + options.position + 1;
    if (options?.fromTop !== undefined) pos = options.fromTop;
    if (options?.fromBottom !== undefined) pos = to._t.children.length - options.fromBottom;
    const previousParent = this._t.parent;
    const position = this._t.parent!._t.children.indexOf(this);
    this._t.parent!._t.children.splice(position, 1);
    this._t.parent = to;
    to._t.children.splice(pos, 0, this);
    if (to instanceof Space && previousParent !== to) to.triggerEvent("enter", this);
  }

  remove() {
    return this.putInto(this._ctx.removed);
  }
}
