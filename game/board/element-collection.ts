import {Piece, GameElement} from './'

import {
  ElementClass,
  ElementFinder,
  ElementUI,
} from './types';
import type { Sorter } from '../types';
import type { Player } from '../player';

/**
 * Operations that return groups of {@link GameElement| | GameElement's} return
 * this Array-like class. 
 */
export default class ElementCollection<P extends Player, T extends GameElement<P>> extends Array<T> {

  slice(...a: any[]):ElementCollection<P, T> {return super.slice(...a) as ElementCollection<P, T>};

  /**
   * As {@link GameElement#all}, but finds all elements within this collection
   * and its contained elements recursively.
   * @category Queries
   *
   * @param {class} className - Optionally provide a class as the first argument
   * as a class filter. This will only match elements which are instances of the
   * provided class
   *
   * @param finders - All other parameters are filters. See {@link
   * ElementFinder} for more information.
   *
   * @returns An {@link ElementCollection} of as many matching elements as can be
   * found. The collection is typed to `ElementCollection<className>` if one was
   * provided.
   */
  all<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  all<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  all<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement<P>>(GameElement<P>, {}, className, ...finders);
    }
    return this._finder(className, {}, ...finders);
  }

  /** @internal */
  _finder<F extends GameElement<P>>(
    className: ElementClass<P, F>,
    options: {limit?: number, order?: 'asc' | 'desc'},
    ...finders: ElementFinder<P, F>[]
  ): ElementCollection<P, F> {
    const fns: ((e: F) => boolean)[] = finders.map(finder => {
      if (typeof finder === 'object') {
        const attrs = finder;
        return el => Object.entries(attrs).every(([k1, v1]) => {
          let kvpairs = Object.entries(el);
          if ('mine' in attrs) {
            if (!el._ctx.player) throw Error('Using "mine" in a non-player context');
            kvpairs = kvpairs.concat([["mine", el.mine]]);
          }
          if ('empty' in attrs) {
            kvpairs = kvpairs.concat([["empty", el.isEmpty()]]);
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
    const coll = new ElementCollection<P, F>();

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
        if (options.limit !== undefined && coll.length >= options.limit) break;
        finderFn(el, 'desc');
      }
    } else {
      for (const el of this) {
        if (options.limit !== undefined && coll.length >= options.limit) break;
        finderFn(el, 'asc');
      };
    }

    return coll;
  }

  /**
   * As {@link GameElement#first}, except finds the first element within this
   * collection and its contained elements recursively that matches the
   * arguments provided. See {@link GameElement#all} for parameter details.
   * @category Queries
   * @returns A matching element, if found
   */
  first<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  first<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  first<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement<P>>(GameElement<P>, {limit: 1}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1}, ...finders)[0];
  }

  /**
   * As {@link GameElement#firstN}, except finds the first `n` elements within
   * this collection and its contained elements recursively that match the
   * arguments provided. See {@link all} for parameter details.
   * @category Queries
   * @param n - number of matches
   *
   * @returns An {@link ElementCollection} of as many matching elements as can be
   * found, up to `n`. The collection is typed to `ElementCollection<className>`
   * if one was provided.
   */
  firstN<F extends GameElement<P>>(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  firstN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  firstN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement<P>>(GameElement<P>, {limit: n}, className, ...finders);
    }
    return this._finder(className, {limit: n}, ...finders);
  }

  /**
   * As {@link GameElement#last}, expect finds the last element within this
   * collection and its contained elements recursively that matches the
   * arguments provided. See {@link all} for parameter details.
   * @category Queries
   * @returns A matching element, if found
   */
  last<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  last<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  last<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement<P>>(GameElement<P>, {limit: 1, order: 'desc'}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1, order: 'desc'}, ...finders)[0];
  }

  /**
   * As {@link GameElement#lastN}, expect finds the last n elements within this
   * collection and its contained elements recursively that match the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   * @param n - number of matches
   *
   * @returns An {@link ElementCollection} of as many matching elements as can be
   * found, up to `n`. The collection is typed to `ElementCollection<className>`
   * if one was provided.
   */
  lastN<F extends GameElement<P>>(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  lastN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  lastN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement<P>>(GameElement<P>, {limit: n, order: 'desc'}, className, ...finders);
    }
    return this._finder(className, {limit: n, order: 'desc'}, ...finders);
  }

  /**
   * Alias for {@link first}
   */
  top<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  top<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  top<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement<P>>(GameElement<P>, {limit: 1}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1}, ...finders)[0];
  }

  /**
   * Alias for {@link firstN}
   */
  topN<F extends GameElement<P>>(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  topN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  topN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement<P>>(GameElement<P>, {limit: n}, className, ...finders);
    }
    return this._finder(className, {limit: n}, ...finders);
  }

  /**
   * Alias for {@link last}
   */
  bottom<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  bottom<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  bottom<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement<P>>(GameElement<P>, {limit: 1, order: 'desc'}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1, order: 'desc'}, ...finders)[0];
  }

  /**
   * Alias for {@link lastN}
   */
  bottomN<F extends GameElement<P>>(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  bottomN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  bottomN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement<P>>(GameElement<P>, {limit: n, order: 'desc'}, className, ...finders);
    }
    return this._finder(className, {limit: n, order: 'desc'}, ...finders);
  }

  /**
   * Sorts this collection by some {@link Sorter}.
   * @category Structure
   */
  sortBy<E extends T>(key: Sorter<E> | (Sorter<E>)[], direction?: "asc" | "desc") {
    const rank = (e: E, k: Sorter<E>) => typeof k === 'function' ? k(e) : e[k]
    const [up, down] = direction === 'desc' ? [-1, 1] : [1, -1];
    return this.sort((a, b) => {
      const keys = key instanceof Array ? key : [key];
      for (const k of keys) {
        const r1 = rank(a as E, k);
        const r2 = rank(b as E, k);
        if (r1 > r2) return up;
        if (r1 < r2) return down;
      }
      return 0;
    });
  }

  /**
   * Returns a copy of this collection sorted by some {@link Sorter}.
   * @category Structure
   */
  sortedBy(key: Sorter<T> | (Sorter<T>)[], direction: "asc" | "desc" = "asc") {
    return (this.slice(0, this.length) as this).sortBy(key, direction);
  }

  /**
   * Returns the sum of all elements in this collection measured by a provided key
   * @category Queries
   *
   * @example
   * deck.create(Card, '2', { pips: 2 });
   * deck.create(Card, '3', { pips: 3 });
   * deck.all(Card).sum('pips'); // => 5
   */
  sum(key: ((e: T) => number) | (keyof {[K in keyof T]: T[K] extends number ? never: K})) {
    return this.reduce((sum, n) => sum + (typeof key === 'function' ? key(n) : n[key] as unknown as number), 0);
  }

  /**
   * Returns the element in this collection with the highest value of the
   * provided key(s).
   * @category Queries
   *
   * @param attributes - any number of {@link Sorter | Sorter's} used for
   * comparing. If multiple are provided, subsequent ones are used to break ties
   * on earlier ones.
   *
   * @example
   * army.create(Soldier, 'a', { strength: 2, initiative: 3 });
   * army.create(Soldier, 'b', { strength: 3, initiative: 1 });
   * army.create(Soldier, 'c', { strength: 3, initiative: 2 });
   * army.all(Solider).withHighest('strength', 'initiative'); // => Soldier 'c'
   */
  withHighest(...attributes: Sorter<T>[]): T | undefined {
    return this.sortedBy(attributes, 'desc')[0];
  }

  /**
   * Returns the element in this collection with the lowest value of the
   * provided key(s).
   * @category Queries
   *
   * @param attributes - any number of {@link Sorter | Sorter's} used for
   * comparing. If multiple are provided, subsequent ones are used to break ties
   * on earlier ones.
   *
   * @example
   * army.create(Soldier, 'a', { strength: 2, initiative: 3 });
   * army.create(Soldier, 'b', { strength: 3, initiative: 1 });
   * army.create(Soldier, 'c', { strength: 2, initiative: 2 });
   * army.all(Solider).withLowest('strength', 'initiative'); // => Soldier 'c'
   */
  withLowest(...attributes: Sorter<T>[]): T | undefined {
    return this.sortedBy(attributes, 'asc')[0];
  }

  max<K extends keyof T>(key: K): T[K] | undefined {
    const el = this.sortedBy(key, 'desc')[0]
    return el && el[key];
  }

  min<K extends keyof T>(key: K): T[K] | undefined {
    const el = this.sortedBy(key, 'asc')[0]
    return el && el[key];
  }

  areAllEqual(key: keyof T): boolean {
    if (this.length === 0) return true;
    return this.every(el => el[key] === this[0][key]);
  }

  remove() {
    for (const el of this) {
      if (!(el instanceof Piece)) throw Error('cannot move Space');
      el.remove();
    }
  }

  putInto(to: GameElement<P>, options?: {position?: number, fromTop?: number, fromBottom?: number}) {
    for (const el of this) {
      if (!(el instanceof Piece)) throw Error('cannot move Space');
      el.putInto(to, options);
    }
  }

  // UI
  layout(
    applyTo: T['_ui']['layouts'][number]['applyTo'],
    attributes: Partial<GameElement<P>['_ui']['layouts'][number]['attributes']>
  ) {
    for (const el of this) el.layout(applyTo, attributes);
  }

  appearance(appearance: ElementUI<P, T>['appearance']) {
    for (const el of this) el.appearance(appearance);
  }
}
