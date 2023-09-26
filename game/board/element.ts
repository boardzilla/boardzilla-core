import ElementCollection from './element-collection';
import { isA, shuffleArray, times } from '../utils';
import { serializeObject, deserializeObject } from '../action/utils';

import type {
  ElementAttributes,
  ElementContext,
  ElementClass,
  ElementFinder,
  ElementJSON,
} from './types';

import type { Player } from '../player';
import type Board from './board';

import type { UndirectedGraph } from 'graphology';

export default class GameElement {
  name: string;
  player?: Player;
  board: Board;
  top: typeof this.last;
  bottom: typeof this.first;
  topN: typeof this.lastN;
  bottomN: typeof this.firstN;

  // ctx shared for all elements in the tree
  _ctx: ElementContext

  // tree info
  _t: {
    children: ElementCollection<GameElement>,
    parent?: GameElement,
    id: number,
    graph?: UndirectedGraph
  };

  _visible?: {
    default: boolean,
    except?: number[]
  }

  static isGameElement = true;
  static hiddenAttributes: string[] = [];

  constructor(ctx: Partial<ElementContext>) {
    this._ctx = ctx as ElementContext;
    if (!ctx.top) {
      this._ctx.top = this;
      this._ctx.sequence = 0;
    }

    this._t = {
      children: new ElementCollection(),
      id: this._ctx.sequence++,
    }

    Object.getPrototypeOf(this).top = this.last;
    Object.getPrototypeOf(this).topN = this.lastN;
    Object.getPrototypeOf(this).bottom = this.first;
    Object.getPrototypeOf(this).bottomN = this.firstN;
  }

  setId(id?: number) {
    if (id !== undefined) {
      this._t.id = id;
      if (this._ctx.sequence < id) this._ctx.sequence = id;
    }
  }

  all<F extends GameElement>(className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): ElementCollection<GameElement>;
  all<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  all<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children.all<GameElement>(GameElement, className, ...finders);
    }
    return this._t.children.all<F>(className, ...finders);
  }

  first<F extends GameElement>(className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): GameElement | undefined;
  first<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  first<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement>(GameElement, {limit: 1}, className, ...finders)[0];
    }
    return this._t.children.all<F>(className, ...finders)[0];
  }

  firstN<F extends GameElement>(n: number, className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): ElementCollection<GameElement>;
  firstN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  firstN<F extends GameElement>(n: number, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement>(GameElement, {limit: n}, className, ...finders);
    }
    return this._t.children._finder(className, {limit: n}, ...finders);
  }

  last<F extends GameElement>(className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): GameElement | undefined;
  last<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  last<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement>(GameElement, {limit: 1, order: 'desc'}, className, ...finders)[0];
    }
    return this._t.children._finder(className, {limit: 1, order: 'desc'}, ...finders)[0];
  }

  lastN<F extends GameElement>(n: number, className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): ElementCollection<GameElement>;
  lastN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  lastN<F extends GameElement>(n: number, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement>(GameElement, {limit: n, order: 'desc'}, className, ...finders);
    }
    return this._t.children._finder(className, {limit: n, order: 'desc'}, ...finders);
  }

  // find sibling elements
  others<F extends GameElement>(className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): ElementCollection<GameElement>;
  others<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  others<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if (!this._t.parent) new ElementCollection<GameElement>();
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      const otherFinder = this._otherFinder<GameElement>([className, ...finders]);
      return this._t.parent!._t.children._finder<GameElement>(GameElement, {}, otherFinder, className, ...finders);
    }
    const otherFinder = this._otherFinder<GameElement>(finders);
    return this._t.parent!._t.children._finder(className, {}, otherFinder, ...finders);
  }

  _otherFinder<T extends GameElement>(finders: ElementFinder<T>[]): ElementFinder<GameElement> {
    return (el: T) => el !== (this as GameElement);
  }

  container<T extends GameElement>(className?: ElementClass<T>): T | undefined {
    if (!className) return this._t.parent as T;
    if (this._t.parent) return isA(this._t.parent, className) ?
      this._t.parent as T:
      this._t.parent.container(className);
  }

  sort(fn?: (a: GameElement, b: GameElement) => number) {
    return this._t.children.sort(fn)
  }

  sortBy(key: string, direction?: "asc" | "desc") {
    return this._t.children.sortBy(key, direction)
  }

  shuffle() {
    shuffleArray(this._t.children, this._ctx.game?.random || Math.random);
  }

  owner() {
    return this.player !== undefined ? this.player : this._t.parent?.player;
  }

  get mine() {
    if (!this._ctx.player) return false;
    return this.owner() === this._ctx.player;
  }

  showToAll() {
    delete(this._visible);
  }

  showOnlyTo(player: number) {
    this._visible = {
      default: false,
      except: [player]
    };
  }

  showTo(...player: number[]) {
    if (this._visible === undefined) return;
    if (this._visible.default) {
      if (!this._visible.except) return;
      this._visible.except = this._visible.except.filter(i => !player.includes(i));
    } else {
      this._visible.except = Array.from(new Set([...(this._visible.except instanceof Array ? this._visible.except : []), ...player]))
    }
  }

  hideFromAll() {
    this._visible = {default: false};
  }

  hideFrom(...player: number[]) {
    if (this._visible?.default === false && !this._visible.except) return;
    if (this._visible === undefined || this._visible.default === true) {
      this._visible = {
        default: true,
        except: Array.from(new Set([...(this._visible?.except instanceof Array ? this._visible.except : []), ...player]))
      };
    } else {
      if (!this._visible.except) return;
      this._visible.except = this._visible.except.filter(i => !player.includes(i));
    }
  }

  isVisibleTo(p: number) {
    if (this._visible === undefined) return true;
    if (this._visible.default) {
      return !this._visible.except || !(this._visible.except.includes(p));
    } else {
      return this._visible.except?.includes(p) || false;
    }
  }

  static hide<T extends GameElement>(this: ElementClass<T>,...attrs: (string & keyof T)[]): void {
    this.hiddenAttributes = attrs;
  }

  hidden(): this {
    return Object.create(
      Object.getPrototypeOf(this),
      Object.fromEntries(
        Object.entries(
          Object.getOwnPropertyDescriptors(this)).filter(
            ([attr]) => !(this.constructor as typeof GameElement).hiddenAttributes.includes(attr)
          )
      )
    );
  }

  create<T extends GameElement>(className: ElementClass<T>, name: string, attrs?: ElementAttributes<T>): T {
    if (this._ctx.game?.phase === 'started') throw Error('Board elements cannot be created once game has started.');
    const el = this.createElement(className, name, attrs);
    el._t.parent = this;
    this._t.children.push(el);
    return el;
  }

  createMany<T extends GameElement>(n: number, className: ElementClass<T>, name: string, attrs?: ElementAttributes<T>): T[] {
    return times(n, () => this.create(className, name, attrs));
  }

  createElement<T extends GameElement>(className: ElementClass<T>, name: string, attrs?: ElementAttributes<T>): T {
    if (!this._ctx.classRegistry.includes(className)) {
      // importing classes from webpack are not equivalent. this ensures(?) we are using the same classes
      const classNameBasedOnName = this._ctx.classRegistry.find(c => c.name === className.name) as ElementClass<T>;
      if (!classNameBasedOnName) throw Error(`No class found ${className.name}. Declare any classes in \`game.defineBoard\``);
      className = classNameBasedOnName;
    }
    const el = new className(this._ctx);
    el.board = this.board;
    el.name = name;
    Object.assign(el, attrs);
    return el;
  }

  branch() {
    const branches = [];
    let node = this as GameElement;
    while (node._t.parent) {
      branches.unshift(node._t.parent._t.children.indexOf(node));
      node = node._t.parent;
    }
    branches.unshift(this._ctx.removed._t.children.indexOf(node) + 1);
    return branches.join("/");
  }

  atBranch(b: string) {
    let branch = b.split('/');
    let index = parseInt(branch[0]);
    let node = index === 0 ? this._ctx.top : this._ctx.removed._t.children[index - 1];
    branch.shift();
    while (branch[0] !== undefined) {
      node = node._t.children[parseInt(branch[0])];
      branch.shift();
    }
    return node;
  }

  atID(id: number): GameElement | undefined {
    return this._t.children.find(c => c._t.id === id) || this._t.children.find(c => c.atID(id))?.atID(id)
  }

  isDescendantOf(el: GameElement): boolean {
    return this._t.parent === el || !!this._t.parent?.isDescendantOf(el)
  }

  toJSON(seenBy?: number) {
    let attrs: Record<any, any>;
    let { _t, _ctx, board, ...rest } = this;
    if ('pile' in rest) delete rest.pile;
    if ('_eventHandlers' in rest) delete rest['_eventHandlers'];

    // remove methods
    rest = Object.fromEntries(Object.entries(rest).filter(
      ([, value]) => typeof value !== 'function'
    )) as typeof rest;

    // remove hidden attributes
    if (seenBy !== undefined && !this.isVisibleTo(seenBy)) {
      rest = Object.fromEntries(Object.entries(rest).filter(
        ([attr]) => !(this.constructor as typeof GameElement).hiddenAttributes.includes(attr)
      )) as typeof rest;
    }

    attrs = rest;

    const json: ElementJSON = Object.assign(serializeObject(attrs, seenBy !== undefined), { className: this.constructor.name });
    if (seenBy === undefined || 'isSpace' in this) json._id = _t.id;
    if (_t.children.length) json.children = Array.from(_t.children.map(c => c.toJSON(seenBy)));
    return json;
  }

  createChildrenFromJSON(childrenJSON: ElementJSON[]) {
    // truncate non-spaces
    const spaces = this._t.children.filter(c => 'isSpace' in c);
    this._t.children = new ElementCollection();

    for (const json of childrenJSON) {
      let { className, children, _id, name, ...rest } = json;
      if (this._ctx.game) rest = deserializeObject({...rest}, this._ctx.game);
      let child: GameElement | undefined = undefined;
      if (_id !== undefined) {
        child = spaces.find(c => c._t.id === _id);
        if (child) {
          // reset all on child
          for (const key of Object.keys(child)) {
            if (!['_ctx', '_t', '_eventHandlers', 'board', 'name'].includes(key) && !(key in rest))
              rest[key] = undefined;
          }
          Object.assign(child, rest);
        }
      }
      if (!child) {
        const elementClass = this._ctx.classRegistry.find(c => c.name === className);
        if (!elementClass) throw Error(`No class found ${className}. Declare any classes in \`game.defineBoard\``);
        child = this.createElement(elementClass, name, rest);
        child.setId(_id);
        child._t.parent = this;
      }
      this._t.children.push(child);
      child.createChildrenFromJSON(children || []);
    };
  }
}
