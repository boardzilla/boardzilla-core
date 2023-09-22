import {Piece, GameElement} from './'

import {
  ElementClass,
  ElementFinder
} from './types';

export default class ElementCollection<T extends GameElement> extends Array<T> {
  top: typeof this.last;
  bottom: typeof this.first;

  constructor(...collection: T[]) {
    super(...collection);
    this.top = this.last;
    this.bottom = this.first;
  }

  slice(...a: any[]):ElementCollection<T> {return super.slice(...a) as ElementCollection<T>};

  // search this collection and all children
  all<F extends GameElement>(className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): ElementCollection<GameElement>;
  all<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  all<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {}, className, ...finders);
    }
    return this._finder(className, {}, ...finders);
  }

  _finder<F extends GameElement>(
    className: ElementClass<F>,
    options: {limit?: number, order?: 'asc' | 'desc'},
    ...finders: ElementFinder<F>[]
  ): ElementCollection<F> {
    const fns: ((e: F) => boolean)[] = finders.map(finder => {
      if (typeof finder === 'object') {
        const attrs = finder;
        return el => Object.entries(attrs).every(([k1, v1]) => {
          let kvpairs = Object.entries(el);
          if (attrs.mine) {
            if (!el._ctx.player) throw Error('Using "mine" in a non-player context');
            kvpairs = kvpairs.concat([["mine", el.mine]]);
          }
          if (attrs.adjacent) {
            if (!el._ctx.player) throw Error('Using "mine" in a non-player context');
            finders.push(el => el._t.graph?.areNeighbors(this, el) || false);
          }
          return kvpairs.find(([k2, v2]) => k1 === k2 && v1 === v2)
        })
      }
      if (typeof finder === 'string') {
        const name = finder;
        return el => el.name === name;
      }
      return finder;
    })
    const coll = new ElementCollection<F>();

    const finderFn = (el: T, order: 'asc' | 'desc') => {
      if (el instanceof className && fns.every(fn => fn(el as unknown as F))) {
        if (order === 'asc') {
          coll.push(el as unknown as F);
        } else {
          coll.unshift(el as unknown as F);
        }
      }
      if (options.limit !== undefined) {
        coll.push(...el._t.children._finder(className, {limit: options.limit - coll.length, order: options.order}, ...finders));
      } else {
        coll.push(...el._t.children._finder(className, {}, ...finders));
      }
    };

    if (options.order === 'desc') {
      for (let e = this.length - 1; e >= 0; e--) {
        const el = this[e];
        finderFn(el, 'desc');
        if (options.limit !== undefined && coll.length >= options.limit) break;
      }
    } else {
      for (const el of this) {
        finderFn(el, 'asc');
        if (options.limit !== undefined && coll.length >= options.limit) break;
      };
    }

    return coll;
  }

  // search this collection recursively and return first result
  first<F extends GameElement>(className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): GameElement | undefined;
  first<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  first<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: 1}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1}, ...finders)[0];
  }

  // search this collection recursively and return first N results
  firstN<F extends GameElement>(n: number, className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): ElementCollection<GameElement>;
  firstN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  firstN<F extends GameElement>(n: number, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: n}, className, ...finders);
    }
    return this._finder(className, {limit: n}, ...finders);
  }

  // search this collection recursively and return last result
  last<F extends GameElement>(className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): GameElement | undefined;
  last<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  last<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: 1, order: 'desc'}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1, order: 'desc'}, ...finders)[0];
  }

  // search this collection recursively and return last N results
  lastN<F extends GameElement>(n: number, className: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): ElementCollection<GameElement>;
  lastN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  lastN<F extends GameElement>(n: number, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: n, order: 'desc'}, className, ...finders);
    }
    return this._finder(className, {limit: n, order: 'desc'}, ...finders);
  }

  sortBy(key: string | ((el: T) => number), direction?: "asc" | "desc") {
    const [up, down] = direction === 'desc' ? [-1, 1] : [1, -1];
    return this.sort((a: any, b: any) => {
      let aVal: number;
      let bVal: number;
      if (typeof key === 'function') {
        aVal = key(a);
        bVal = key(b);
      } else {
        aVal = a[key];
        bVal = b[key];
      }
      return aVal < bVal ? down : (aVal > bVal ? up : 0);
    });
  }

  sum(key: ((...a: any[]) => number) | (keyof {[K in keyof T]: T[K] extends number ? never: K})) {
    return this.reduce((sum, n) => sum + (typeof key === 'function' ? key(n) : n[key] as unknown as number), 0);
  }

  // TODO have to decide if collection holds-type-restrictions are good idea
  withHighest(...attributes: (keyof T)[]) {
    const sorted = this.slice(0, this.length);
    sorted.sort((a, b) => {
      for (const attr of attributes) {
        if (a[attr] > b[attr]) return -1;
        if (a[attr] < b[attr]) return 1;
      }
      return 0;
    });
    return sorted[0];
  }

  remove() {
    for (const el of this) {
      if (!(el instanceof Piece)) throw Error('cannot move Space');
      el.remove();
    }
  }

  putInto(to: GameElement, options?: {position?: number, fromTop?: number, fromBottom?: number}) {
    for (const el of this) {
      if (!(el instanceof Piece)) throw Error('cannot move Space');
      el.putInto(to, options);
    }
  }
}