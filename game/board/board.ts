import Space from './space'
import type { ElementJSON, ElementClass } from './types';
import type { GameElement } from './';

export default class Board extends Space {
  pile: GameElement;

  constructor(...classes: ElementClass<GameElement>[]) {
    super({ classRegistry: classes });
    this.board = this;
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
    this._t.children.splice(0, this._t.children.length);
    this._ctx.removed._t.children.splice(0, this._ctx.removed._t.children.length);

    if (children) this.createChildrenFromJSON(children);

    // add removed elements
    for (const json of boardJSON.slice(1)) {
      const { className, children, _id, name, ...rest } = json;
      const elementClass = this._ctx.classRegistry.find(c => c.name === className);
      if (!elementClass) throw Error(`No class found ${className}. Declare any classes in \`game.defineBoard\``);
      const unconnected = this._ctx.removed.create(elementClass, name, rest);
      // TODO worried about removed children. Should removal even preserve parent-child relationships?
      if (children) unconnected.createChildrenFromJSON(children);
    };
  }
}
