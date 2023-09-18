import GameElement from './element'

export default class Piece extends GameElement {
  putInto(to: GameElement, options?: {position?: number, fromTop?: number, fromBottom?: number}) {
    if (to.isDescendantOf(this)) throw Error(`Cannot put ${this} into itself`);
    let pos: number = to._t.children.length;
    if (options?.position !== undefined) pos = options.position;
    if (options?.fromBottom !== undefined) pos = options.fromBottom;
    if (options?.fromTop !== undefined) pos = to._t.children.length - options.fromTop;
    const position = this._t.parent!._t.children.indexOf(this);
    this._t.parent!._t.children.splice(position, 1);
    this._t.parent = to;
    to._t.children.splice(pos, 0, this);
    to.triggerEvent("enter", this);
  }

  remove() {
    return this.putInto(this._ctx.removed);
  }
}
