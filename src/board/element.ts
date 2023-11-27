import ElementCollection from './element-collection.js';
import { shuffleArray, times } from '../utils.js';
import { translate, cellSizeForArea } from './utils.js';
import { serializeObject, deserializeObject, humanizeArg } from '../action/utils.js';
import random from 'random-seed';

import type Game from '../game.js';
import type Player from '../player/player.js';
import type Board from './board.js';
import type Space from './space.js';
import type { ElementFinder } from './element-collection.js';

import type { UndirectedGraph } from 'graphology';

type Sorter<T> = keyof {[K in keyof T]: T[K] extends number | string ? never: K} | ((e: T) => number | string)

export type ElementJSON = ({className: string, children?: ElementJSON[]} & Record<string, any>);

export type ElementClass<P extends Player, T extends GameElement<P>> = {
  new(ctx: Partial<ElementContext<P>>): T;
  isGameElement: boolean; // here to help enforce types
  hiddenAttributes: string[];
  visibleAttributes?: string[];
}

export type GameElementSerialization = 'player' | 'name'; // | 'uuid' | 'x' | 'y' | 'left' | 'right' | 'top' | 'bottom' | 'columns' | 'rows' | 'layout' | 'zoom' | 'minWidth' | 'minHeight';
// export type PieceSerialization = GameElementSerialization; // | 'cell';
// export type InteractivePieceSerialization = PieceSerialization; // | 'component';
// export type SpaceSerialization = GameElementSerialization; // | 'label';
// export type BaseType<T> = (T extends Board ? Board : (T extends Space ? Space : Piece));

/**
 * The attributes of this class that inherits GameElement, excluding ones from
 * the base GameElement, except `name` and `player`
 */
export type ElementAttributes<P extends Player, T extends GameElement<P>> =
  Partial<Pick<T, {[K in keyof T]: K extends keyof GameElement<P> ? never : (T[K] extends (...a:any[]) => any ? never : K)}[keyof T] | 'name' | 'player'>>

export type ElementContext<P extends Player> = {
  game: Game<P, Board<P>>;
  top: GameElement<P>;
  removed: GameElement<P>;
  sequence: number;
  player?: P;
  classRegistry: ElementClass<P, GameElement<P>>[];
  moves: Record<string, string>;
  trackMovement: boolean;
};

export type Box = { left: number, top: number, width: number, height: number };
export type Vector = { x: number, y: number };

export type ElementUI<P extends Player, T extends GameElement<P>> = {
  layouts: {
    applyTo: ElementClass<P, GameElement<P>> | GameElement<P> | ElementCollection<P, GameElement<P>> | string,
    attributes: {
      margin?: number | { top: number, bottom: number, left: number, right: number },
      area?: Box,
      rows?: number | {min: number, max?: number} | {min?: number, max: number},
      columns?: number | {min: number, max?: number} | {min?: number, max: number},
      slots?: Box[],
      size?: { width: number, height: number },
      aspectRatio?: number, // w / h
      scaling: 'fit' | 'fill' | 'none'
      gap?: number | { x: number, y: number },
      alignment: 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'bottom left' | 'top right' | 'bottom right' | 'center',
      offsetColumn?: Vector,
      offsetRow?: Vector,
      direction: 'square' | 'ltr' | 'rtl' | 'rtl-btt' | 'ltr-btt' | 'ttb' | 'ttb-rtl' | 'btt' | 'btt-rtl',
      limit?: number,
      haphazardly?: number,
    }
  }[],
  appearance: {
    className?: string,
    render?: ((el: T) => React.JSX.Element | null) | false,
    aspectRatio?: number,
    zoomable?: boolean | ((el: T) => boolean),
    connections?: {
      thickness?: number,
      style?: 'solid' | 'double',
      color?: string,
      fill?: string,
      label?: ({distance, to, from}: {distance: number, to: Space<P>, from: Space<P> }) => React.JSX.Element | null,
      labelScale?: number,
    },
  },
  computedStyle?: Box,
}

/**
 * Abstract base class for all Board elements. Use {@link Space} or {@link
 * Piece} as the base for subclassing your own elements.
 * @category Board
 */
export default class GameElement<P extends Player, B extends Board<P> = Board<P>> {
  /**
   * Element name, used in queries to quickly refer to a given element
   * @category Queries
   */
  name: string;

  /**
   * Player with which this element is identified. This does not affect
   * behaviour but will mark the element as `mine` in queries in the context of
   * this player.
   * @category Queries
   */
  player?: P;

  /**
   * The {@link Board} to which this element belongs
   * @category Structure
   */
  board: B;

  /**
   * A reference to the {@link Game}
   * @category Structure
   */
  game: Game<P, B>;

  /**
   * ctx shared for all elements in the tree
   * @internal
   */
  _ctx: ElementContext<P>

  /**
   * tree info
   * @internal
   */
  _t: {
    children: ElementCollection<P, GameElement<P>>,
    parent?: GameElement<P>,
    id: number,
    order?: 'normal' | 'stacking',
    was?: string,
    graph?: UndirectedGraph,
    setId: (id: number) => void
  };

  /** @internal */
  _visible?: {
    default: boolean,
    except?: number[]
  }

  /** @internal */
  static isGameElement = true;

  /** @internal */
  static hiddenAttributes: string[] = ['name'];

  /** @internal */
  static visibleAttributes: string[] | undefined;

  /**
   * Do not use the constructor directly. Instead Call {@link
   * GameElement#create} or {@link GameElement#createMany} on the element in
   * which you want to create a new element.
   * @category Structure
   */
  constructor(ctx: Partial<ElementContext<P>>) {
    this._ctx = ctx as ElementContext<P>;
    if (!ctx.top) {
      this._ctx.top = this;
      this._ctx.sequence = 0;
    }

    this.game = this._ctx.game as Game<P, B>;

    this._t = {
      children: new ElementCollection(),
      id: this._ctx.sequence++,
      setId: (id?: number) => {
        if (id !== undefined) {
          this._t.id = id;
          if (this._ctx.sequence < id) this._ctx.sequence = id;
        }
      }
    }
  }

  /** @internal */
  toString() {
    return humanizeArg(this);
  }

  /**
   * Finds all elements within this element recursively that match the arguments
   * provided.
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
  all<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  all(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  all<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children.all<GameElement<P>>(GameElement<P>, className, ...finders);
    }
    return this._t.children.all<F>(className, ...finders);
  }

  /**
   * Finds the first element within this element recursively that matches the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   * @returns A matching element, if found
   */
  first<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  first(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  first<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: 1}, className, ...finders)[0];
    }
    return this._t.children.all<F>(className, ...finders)[0];
  }

  /**
   * Finds the first `n` elements within this element recursively that match the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   * @param n - number of matches
   *
   * @returns An {@link ElementCollection} of as many matching elements as can be
   * found, up to `n`. The collection is typed to `ElementCollection<className>`
   * if one was provided.
   */
  firstN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  firstN(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  firstN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: n}, className, ...finders);
    }
    return this._t.children._finder(className, {limit: n}, ...finders);
  }

  /**
   * Finds the last element within this element recursively that matches the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   * @returns A matching element, if found
   */
  last<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  last(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  last<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: 1, order: 'desc'}, className, ...finders)[0];
    }
    return this._t.children._finder(className, {limit: 1, order: 'desc'}, ...finders)[0];
  }

  /**
   * Finds the last `n` elements within this element recursively that match the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   * @param n - number of matches
   *
   * @returns An {@link ElementCollection} of as many matching elements as can be
   * found, up to `n`. The collection is typed to `ElementCollection<className>`
   * if one was provided.
   */
  lastN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  lastN(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  lastN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: n, order: 'desc'}, className, ...finders);
    }
    return this._t.children._finder(className, {limit: n, order: 'desc'}, ...finders);
  }


  /**
   * Alias for {@link first}
   * @category Queries
   */
  top<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  top(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  top<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: 1}, className, ...finders)[0];
    }
    return this._t.children.all<F>(className, ...finders)[0];
  }

  /**
   * Alias for {@link firstN}
   * @category Queries
   */
  topN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  topN(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  topN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: n}, className, ...finders);
    }
    return this._t.children._finder(className, {limit: n}, ...finders);
  }

  /**
   * Alias for {@link last}
   * @category Queries
   */
  bottom<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  bottom(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  bottom<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: 1, order: 'desc'}, className, ...finders)[0];
    }
    return this._t.children._finder(className, {limit: 1, order: 'desc'}, ...finders)[0];
  }

  /**
   * Alias for {@link lastN}
   * @category Queries
   */
  bottomN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  bottomN(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  bottomN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: n, order: 'desc'}, className, ...finders);
    }
    return this._t.children._finder(className, {limit: n, order: 'desc'}, ...finders);
  }

  /**
   * Finds "sibling" elements (elements that are directly inside the parent of this element) that match the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   */
  others<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  others(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  others<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (!this._t.parent) new ElementCollection<P, GameElement<P>>();
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      const otherFinder = this._otherFinder<GameElement<P>>([className, ...finders]);
      return this._t.parent!._t.children._finder<GameElement<P>>(GameElement<P>, {}, otherFinder, className, ...finders);
    }
    const otherFinder = this._otherFinder<GameElement<P>>(finders);
    return this._t.parent!._t.children._finder(className, {}, otherFinder, ...finders);
  }

  /**
   * Return whether any element within this element recursively matches the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   */
  has<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): boolean;
  has(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): boolean;
  has<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | boolean {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return !!this.first(className, ...finders);
    } else {
      return !!this.first(className, ...finders);
    }
  }

  /** @internal */
  _otherFinder<T extends GameElement<P>>(finders: ElementFinder<P, T>[]): ElementFinder<P, GameElement<P>> {
    return (el: T) => el !== (this as GameElement<P>);
  }

  /**
   * Set this class to use a different ordering style.
   * @category Structure
   * @param order - ordering style
   * - "normal": Elements placed into this element are put at the end of the list (default)
   * - "stacking": Elements placed into this element are put at the beginning of the list. This is prefered for elements that stack. E.g. when placing a card into a stack of cards, if `order` is set to `stacking` the {@link first} method will return the card just placed, i.e. it will be considered to be on the top of the stack
   */
  setOrder(order: typeof this._t.order) {
    this._t.order = order;
  }

  /**
   * Returns this elements parent.
   * @category Queries
   * @param className - If provided, searches up the parent tree to find the first
   * matching element. E.g. if a Token is placed on a Card in a players
   * Tableau. calling `token.container(Tableau)` can be used to find the
   * grandparent.
   */
  container<T extends GameElement<P>>(className?: ElementClass<P, T>): T | undefined {
    if (!className) return this._t.parent as T;
    if (this._t.parent) return this._t.parent instanceof className ?
      this._t.parent as T:
      this._t.parent.container(className);
  }

  /**
   * Returns whether this element has any elements placed within it.
   * @category Structure
   */
  isEmpty() {
    return !this._t.children.length;
  }

  /**
   * Sorts the elements directly contained within this element by some {@link Sorter}.
   * @category Structure
   */
  sortBy<E extends GameElement<P>>(key: Sorter<E> | (Sorter<E>)[], direction?: "asc" | "desc") {
    return this._t.children.sortBy(key, direction)
  }

  /**
   * Re-orders the elements directly contained within this element randomly.
   * @category Structure
   */
  shuffle() {
    shuffleArray(this._t.children, this._ctx.game?.random || Math.random);
  }

  /**
   * Returns the player that owns this element, or the first element that
   * contains this element searching up through the parent hierarchy. This is
   * related to, but different than {@link player}. E.g. if a common card is in
   * a player's hand, typically the `hand.player` will be assigned to that
   * player but the card does not have a `player`. The card.owner() will return
   * the player in whose hand the card is placed. Similarly, if an army is in
   * another player's country, the `army.owner()` will be the player controlling
   * that army (i.e. same as `army.player`) rather than the player who owns the
   * country in which it's placed.
   * @category Structure
   */
  owner() {
    return this.player !== undefined ? this.player : this._t.parent?.player;
  }

  /**
   * Returns whether this element belongs to the "current" player. A player is
   * considered the current player if this is called in the context of an action
   * taken by a given player, or if this is called from a given player's view of
   * the board. It is an error to call this method when not in a player
   * context. When querying for elements using {@link ElementFinder} such as
   * {@link all} and {@link first}, {@link mine} is available as a search key
   * that accepts a value of true/false
   * @category Queries
   */
  get mine() {
    if (!this._ctx.player) return false;
    return this.owner() === this._ctx.player;
  }

  /**
   * Show this element to all players
   * @category Visibility
   */
  showToAll() {
    delete(this._visible);
  }

  /**
   * Show this element only to the given player
   * @category Visibility
   */
  showOnlyTo(player: Player | number) {
    if (typeof player !== 'number') player = player.position;
    this._visible = {
      default: false,
      except: [player]
    };
  }

  /**
   * Show this element to the given players without changing it's visibility to
   * any other players.
   * @category Visibility
   */
  showTo(...player: Player[] | number[]) {
    if (typeof player[0] !== 'number') player = (player as Player[]).map(p => p.position);
    if (this._visible === undefined) return;
    if (this._visible.default) {
      if (!this._visible.except) return;
      this._visible.except = this._visible.except.filter(i => !(player as number[]).includes(i));
    } else {
      this._visible.except = Array.from(new Set([...(this._visible.except instanceof Array ? this._visible.except : []), ...(player as number[])]))
    }
  }

  /**
   * Hide this element only to the given player
   * @category Visibility
   */
  hideFromAll() {
    this._visible = {default: false};
  }

  /**
   * Hide this element from the given players without changing it's visibility to
   * any other players.
   * @category Visibility
   */
  hideFrom(...player: Player[] | number[]) {
    if (typeof player[0] !== 'number') player = (player as Player[]).map(p => p.position);
    if (this._visible?.default === false && !this._visible.except) return;
    if (this._visible === undefined || this._visible.default === true) {
      this._visible = {
        default: true,
        except: Array.from(new Set([...(this._visible?.except instanceof Array ? this._visible.except : []), ...(player as number[])]))
      };
    } else {
      if (!this._visible.except) return;
      this._visible.except = this._visible.except.filter(i => !(player as number[]).includes(i));
    }
  }

  /**
   * Returns whether this element is visible to the given player
   * @category Visibility
   */
  isVisibleTo(player: Player | number) {
    if (typeof player !== 'number') player = player.position;
    if (this._visible === undefined) return true;
    if (this._visible.default) {
      return !this._visible.except || !(this._visible.except.includes(player));
    } else {
      return this._visible.except?.includes(player) || false;
    }
  }

  /**
   * Returns whether this element is visible to the current player. Can only be
   * called when in a player context, during an action taken by a player or
   * while the board is viewed by a given player.
   * @category Visibility
   */
  isVisible() {
    if (!this._ctx.player) throw Error('Cannot use isVisible outside of a player context');
    return this.isVisibleTo(this._ctx.player.position);
  }

  /**
   * Provide list of attributes that are obscured when instances of this element
   * class are hidden. E.g. In a game with multiple card decks with different
   * backs, the identity of the card is hiddem, but the deck it belongs to is
   * not. In this case, Card may have attributes: suit; pip; deck and calling:
   * `Card.hide('suit', 'pip')` will cause suit and pip to be invisible when the
   * card is flipped, while still revealing which deck it is.
   * @category Visibility
   */
  static hide<P extends Player, T extends GameElement<P>>(this: ElementClass<P, T>, ...attrs: (string & keyof T)[]): void {
    this.hiddenAttributes = attrs;
  }

  /**
   * Provide list of attributes that are visible when instances of this element
   * class are visible. E.g. In a game with multiple card decks with different
   * backs, identified by Card#deck, the identity of the card is hiddem, but the
   * deck it belongs to is not. In this case calling
   * `Card.hideAllExcept('deck')` will cause all attributes other than 'deck' to
   * be hidden when card is flipped, while still revealing which deck it is.
   * @category Visibility
   */
  static hideAllExcept<P extends Player, T extends GameElement<P>>(this: ElementClass<P, T>, ...attrs: (string & keyof T)[]): void {
    this.visibleAttributes = attrs;
  }

  /**
   * Create an element inside this element. This can only be called during the
   * game setup (see {@link createGame}. Any game elements that are required
   * must be created before the game starts. Elements that only appear later in
   * the game can be created inside the {@link Board#pile} or made invisible.
   * @category Structure
   *
   * @param className - Class to create. This class must be included in the `elementClasses` in {@link createGame}.
   * @param name - Sets {@link GameElement#name | name}
   * @param attributes - Sets any attributes of the class that are defined in
   * your own class that extend {@link Space}, {@link Piece}, or {@link
   * Board}. Can also include {@link player}.
   *
   * @example
   * deck.create(Card, 'ace-of-hearts', { suit: 'H', value: '1' });
   */
  create<T extends GameElement<P>>(className: ElementClass<P, T>, name: string, attributes?: ElementAttributes<P, T>): T {
    if (this._ctx.game?.phase === 'started') throw Error('Board elements cannot be created once game has started.');
    const el = this.createElement(className, name, attributes);
    el._t.parent = this;
    if (this._t.order === 'stacking') {
      this._t.children.unshift(el);
    } else {
      this._t.children.push(el);
    }
    return el;
  }

  /**
   * Create n elements inside this element of the same class. This can only be
   * called during the game setup (see {@link createGame}. Any game elements
   * that are required must be created before the game starts. Elements that
   * only appear later in the game can be created inside the {@link Board#pile}
   * or made invisible.
   * @category Structure
   *
   * @param n - Number to create
   * @param className - Class to create. This class must be included in the `elementClasses` in {@link createGame}.
   * @param name - Sets {@link GameElement#name | name}
   * @param attributes - Sets any attributes of the class that are defined in
   * your own class that extend {@link Space}, {@link Piece}, or {@link
   * Board}. Can also include {@link player}. If a function is supplied here, a
   * single number argument will be passed with the number of the added element,
   * starting with 1.
   */
  createMany<T extends GameElement<P>>(n: number, className: ElementClass<P, T>, name: string, attributes?: ElementAttributes<P, T> | ((n: number) => ElementAttributes<P, T>)): ElementCollection<P, T> {
    return new ElementCollection<P, T>(...times(n, i => this.create(className, name, typeof attributes === 'function' ? attributes(i) : attributes)));
  }

  createGrid<T extends Space<P>>(
    {rows, columns, style}: {
      rows: number,
      columns: number,
      style?: 'square' | 'hex' | 'hex-inverse'
    }, className: ElementClass<P, T>,
    name: string,
    attributes?: ElementAttributes<P, T> | ((row: number, column: number) => ElementAttributes<P, T>)
  ): ElementCollection<P, T> {
    const grid = new ElementCollection<P, T>();
    times(rows, row =>
      times(columns, column => {
        const el = this.create(className, name, typeof attributes === 'function' ? attributes(row, column) : attributes);
        grid[(row - 1) * columns + column - 1] = el;
        if (row > 1) el.connectTo(grid[(row - 2) * columns + column - 1]);
        if (column > 1) el.connectTo(grid[(row - 1) * columns + column - 2]);
        if (style === 'hex' && row > 1 && column > 1) el.connectTo(grid[(row - 2) * columns + column - 2]);
        if (style === 'hex-inverse' && row > 1 && column < columns) el.connectTo(grid[(row - 2) * columns + column]);
        return el;
      })
    );
    return grid;
  }

  /**
   * Base element creation method
   * @internal
   */
  createElement<T extends GameElement<P>>(className: ElementClass<P, T>, name: string, attrs?: ElementAttributes<P, T>): T {
    if (!this._ctx.classRegistry.includes(className)) {
      const classNameBasedOnName = this._ctx.classRegistry.find(c => c.name === className.name) as ElementClass<P, T>;
      if (!classNameBasedOnName) throw Error(`No class found ${className.name}. Declare any classes in \`game.defineBoard\``);
      className = classNameBasedOnName;
    }
    const el = new className(this._ctx);
    el.board = this.board;
    el.name = name;
    Object.assign(el, attrs);
    return el;
  }

  /**
   * Returns a string identifying the tree position of the element suitable for
   * anonymous reference
   * @internal
   */
  branch() {
    const branches = [];
    let node = this as GameElement<P>;
    while (node._t.parent) {
      branches.unshift(node._t.parent._t.children.indexOf(node));
      node = node._t.parent;
    }
    branches.unshift(this._ctx.removed._t.children.indexOf(node) >= 0 ? 1 : 0);
    return branches.join("/");
  }

  /**
   * Returns the element at the given position returned by {@link branch}
   * @internal
   */
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

  /**
   * Returns the element for the given id
   * @internal
   */
  atID(id: number): GameElement<P> | undefined {
    return this._t.children.find(c => c._t.id === id) || this._t.children.find(c => c.atID(id))?.atID(id)
  }

  /**
   * Whether this element has the given element in its parent hierarchy
   * @category Structure
   */
  isDescendantOf(el: GameElement<P>): boolean {
    return this._t.parent === el || !!this._t.parent?.isDescendantOf(el)
  }

  /**
   * JSON representation
   * @param seenBy - optional player position viewing the board
   * @internal
   */
  toJSON(seenBy?: number) {
    let attrs: Record<any, any>;
    ({ ...attrs } = this);
    for (const attr of ['_t', '_ctx', '_ui', 'board', 'game', 'pile', '_eventHandlers', 'players', 'finish', 'message']) delete attrs[attr];

    // remove methods
    attrs = Object.fromEntries(Object.entries(attrs).filter(
      ([, value]) => typeof value !== 'function'
    )) as typeof attrs;

    // remove hidden attributes
    if (seenBy !== undefined && !this.isVisibleTo(seenBy)) {
      attrs = Object.fromEntries(Object.entries(attrs).filter(
        ([attr]) => !(this.constructor as typeof GameElement<P>).hiddenAttributes.includes(attr) && ((this.constructor as typeof GameElement<P>).visibleAttributes === undefined || (this.constructor as typeof GameElement<P>).visibleAttributes?.includes(attr))
      )) as typeof attrs;
    }

    const json: ElementJSON = Object.assign(serializeObject(attrs, seenBy !== undefined), { className: this.constructor.name });
    if (seenBy === undefined || 'isSpace' in this) json._id = this._t.id;
    if (this._t.children.length) json.children = Array.from(this._t.children.map(c => c.toJSON(seenBy)));
    if (this._t.order) json.order = this._t.order;
    if (this._t.was) json.was = this._t.was;
    return json;
  }

  /** @internal */
  createChildrenFromJSON(childrenJSON: ElementJSON[], branch: string) {
    // truncate non-spaces
    const spaces = this._t.children.filter(c => 'isSpace' in c);
    this._t.children = new ElementCollection();

    for (let i = 0; i !== childrenJSON.length; i++) {
      const json = childrenJSON[i];
      let { className, children, was, _id, name, order, ...rest } = json;
      if (this._ctx.game) rest = deserializeObject({...rest}, this._ctx.game);
      let child: GameElement<P> | undefined = undefined;
      if (_id !== undefined) { // try to match space, preserve the object and any references
        child = spaces.find(c => c._t.id === _id);
        if (child) {
          // reset all on child
          for (const key of Object.keys(child)) {
            if (!['_ctx', '_t', '_ui', '_eventHandlers', 'board', 'game', 'name'].includes(key) && !(key in rest))
              rest[key] = undefined;
          }
          Object.assign(child, rest);
        }
      }
      if (!child) {
        const elementClass = this._ctx.classRegistry.find(c => c.name === className);
        if (!elementClass) throw Error(`No class found ${className}. Declare any classes in \`game.defineBoard\``);
        child = this.createElement(elementClass, name, rest) as GameElement<P>;
        child._t.setId(_id);
        child._t.parent = this;
        child._t.order = order;
        child._t.was = was;
        if (this._ctx.trackMovement) child._t.was = branch + '/' + i;
      }
      this._t.children.push(child);
      child.createChildrenFromJSON(children || [], branch + '/' + i);
    }
  }

  /**
   * UI
   */

  /** @internal */
  _ui: ElementUI<P, GameElement<P>> = {
    layouts: [],
    appearance: {},
  }

  /** @internal */
  resetUI() {
    this._ui.layouts = [{
      applyTo: GameElement,
      attributes: {
        margin: 0,
        scaling: 'fit',
        alignment: 'center',
        gap: 0,
        direction: 'square'
      }
    }];
    this._ui.appearance = {};
    this._ui.computedStyle = undefined;
    for (const child of this._t.children) child.resetUI();
  }

  /**
   * Viewport relative to a square perfectly containing the board. The `left`
   * and `top` values are from 0-100. The x and y values in this method are on
   * the same scale, unlike {@link relativeTransformToBoard}.
   * @category UI
   */
  absoluteTransform(): Box {
    return this.board._ui.frame ? translate(this.relativeTransformToBoard(), this.board._ui.frame) : this.relativeTransformToBoard();
  }

  /**
   * Viewport relative to the board. The `left` and `top` values are percentages
   * from 0-100, where `left: 100` is the right edge of the board and `top: 100`
   * the bottom. The x and y values in this method are therefore not necessarily
   * on the same scale, unlike {@link absoluteTransform}.
   * @category UI
   */
  relativeTransformToBoard(): Box {
    let transform: Box = this._ui.computedStyle || { left: 0, top: 0, width: 100, height: 100 };
    let parent = this._t.parent;
    while (parent?._ui.computedStyle) {
      transform = translate(transform, parent._ui.computedStyle)
      parent = parent._t.parent;
    }
    return transform;
  }

  /**
   * Apply a layout to some of the elements directly contained within this element
   * @category UI
   *
   * @param applyTo - Which elements this layout applies to. Provided value can be:
   * - A specific {@link GameElement}
   * - The name of an element
   * - A specific set of elements ({@link ElementCollection})
   * - A class of elements
   *
   * If multiple layout declarations would apply to the same element, only one
   * will be used. The order of specificity is as above. If a class is used and
   * mutiple apply, the more specific class will be used.
   *
   * @param {Object} attributes - A list of attributes describing the
   * layout. All units of measurement are percentages of this elements width and
   * height from 0-100, unless otherwise noted (`margin` and `gap`)
   *
   * @param {Box} attributes.area - A box defining the layout's bounds within
   * this element. If unspecified, the entire area is used, i.e. `{ left: 0,
   * top: 0, width: 100, height: 100 }`
   *
   * @param attributes.margin - Instead of providing `area`, providing a
   * `margin` defines the bounding box in terms of a margin around the edges of
   * this element. This value is an absolute percentage of the board's size so
   * that margins specified on different layouts with the same value will exactly match
   *
   * @param attributes.rows - The number of rows to allot for placing elements
   * in this layout. If a number is provided, this is fixed. If min/max values
   * are provided, the layout will allot at least `min` and up to `max` as
   * needed. If `min` is omitted, a minimum of 1 is implied. If `max` is
   * omitted, as many are used as needed. Default is `{min: 1, max: Infinity}`.
   *
   * @param attributes.columns - Columns, as per `rows`
   *
   * @param attributes.slots - If supplied, this overrides all other attributes
   * to define a set of strictly defined boxes for placing each element. Any
   * elements that exceed the number of slots provided are not displayed.
   *
   * @param attributes.size - Size alloted for each element placed in this
   * layout. Unless `scaling` is `"none"`, a `size` provided here will be used
   * only to define an aspect ratio but may scale up or down to fit as
   * needed. As such, when using any `scaling` other than `"none"`, providing an
   * `aspectRatio` instead is sufficient.
   *
   * @param attributes.aspectRatio - Aspect ratio for each element placed in
   * this layout. This value is a ratio of width over height. Elements will
   * adhere to this ratio unless they have their own specified `aspectRatio` in
   * their {@link appearance}. This value is ignored is `size` is provided.
   *
   * @param attributes.scaling - Scaling strategy for the elements placed in this layout.
   * - *none*: Elements use the `size` value and do not scale. If no `size` is provided, this behaves like `fit` (default)
   * - *fit*: elements scale up or down to fit within the area alloted without squshing
   * - *fill*: elements scale up or down to completely fill the area, squishing themselves together as needed along one dimension.
   *
   * @param attributes.gap - If provided, this places a gap between elements. If
   * scaling is 'fill', this is considered a maximum but may shrink or even
   * become negative in order to fill the area. This value is an absolute
   * percentage of the board's size so that gaps specified on different layouts
   * with the same value will exactly match
   *
   * @param attributes.alignment - If more room is provided than needed, this
   * determines how the elements will align themselves within.
   *
   * @param attributes.offsetColumn - Instead of `gap`, providing an
   * `offsetColumn`/`offsetRow` specifies that the contained elements must
   * offset one another by a specified amount as a percentage of the elements
   * size, i.e. `offsetColumn=100` is equivalent to a `gap` of 0. This allows
   * non-orthogonal grids like hex or diamond. If one of
   * `offsetColumn`/`offsetRow` is provided but not the other, the unspecified
   * one will be 90° to the one specified. Like `gap`, if `scaling` is set to
   * `fill`, these offsets may squish to fill space.
   *
   * @param attributes.offsetRow - As above
   *
   * @param attributes.direction - Specifies the direction in which elements
   * placed here should fill up the rows and columns of the layout. Rows or
   * columns will increase to their specified maximum as needed. Therefore if,
   * for example, `direction` is `"ltr"` and `columns` has no maximum, there will
   * never be a second row added. Values are:
   * - *square*: fill rows and columns equally to maintain as square a grid as possible (default)
   * - *ltr*: fill columns left to right, then rows top to bottom once maximum columns reached
   * - *rtl*: fill columns right to left, then rows top to bottom once maximum columns reached
   * - *ltr-btt*: fill columns left to right, then rows bottom to top once maximum columns reached
   * - *rtl-btt*: fill columns right to left, then rows bottom to top once maximum columns reached
   * - *ttb*: fill rows top to bottom, then columns left to right once maximum rows reached
   * - *btt*: fill rows bottom to top, then columns left to right once maximum rows reached
   * - *ttb-rtl*: fill rows top to bottom, then columns right to left once maximum rows reached
   * - *btt-rtl*: fill rows bottom to top, then columns right to left once maximum rows reached
   *
   * @param attributes.limit - If specified, no more than `limit` items will be
   * visible. This is useful for displaying e.g. decks of cards where showing
   * only 2 or 3 cards provides a deck-like appearance without needed to render
   * more cards underneath that aren't visible.
   *
   * @param attributes.haphazardly - A number specifying an amount of randomness
   * added to the layout to provide a more natural looking placement
   */
  layout(applyTo: typeof this._ui.layouts[number]['applyTo'], attributes: {
    margin?: number | { top: number, bottom: number, left: number, right: number },
    area?: Box,
    rows?: number | {min: number, max?: number} | {min?: number, max: number},
    columns?: number | {min: number, max?: number} | {min?: number, max: number},
    slots?: Box[],
    size?: { width: number, height: number },
    aspectRatio?: number, // w / h
    scaling?: 'fit' | 'fill' | 'none'
    gap?: number | { x: number, y: number },
    alignment?: 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'bottom left' | 'top right' | 'bottom right' | 'center',
    offsetColumn?: Vector,
    offsetRow?: Vector,
    direction?: 'square' | 'ltr' | 'rtl' | 'rtl-btt' | 'ltr-btt' | 'ttb' | 'ttb-rtl' | 'btt' | 'btt-rtl',
    limit?: number,
    haphazardly?: number,
  }) {
    const {area, margin, size, aspectRatio, scaling, gap, offsetColumn, offsetRow} = attributes
    if (this._ui.layouts.length === 0) this.resetUI();
    if (area && margin) console.warn('Both `area` and `margin` supplied in layout. `margin` is ignored');
    if (size && aspectRatio) console.warn('Both `size` and `aspectRatio` supplied in layout. `aspectRatio` is ignored');
    if (gap && (offsetColumn || offsetRow)) console.warn('Both `gap` and `offset` supplied in layout. `gap` is ignored');
    if (!size) {
      if (scaling === 'none' && aspectRatio) throw Error("Layout `scaling` must be 'fit' or 'fill' for `aspectRatio` and no `size`");
      if (!scaling) attributes.scaling = 'fit';
    }
    if (!margin && !area) attributes.margin = 0;
    this._ui.layouts.push({ applyTo, attributes: Object.assign({ scaling: 'fit', alignment: 'center', direction: 'square' }, attributes) });

    this._ui.layouts.sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (a.applyTo instanceof GameElement) aVal = 3
      if (b.applyTo instanceof GameElement) bVal = 3
      if (typeof a.applyTo === 'string') aVal = 2
      if (typeof b.applyTo === 'string') bVal = 2
      if (a.applyTo instanceof Array) aVal = 1
      if (b.applyTo instanceof Array) bVal = 1
      if (aVal !== 0 || bVal !== 0) return aVal - bVal;
      const ac = a.applyTo as ElementClass<P, any>;
      const bc = b.applyTo as ElementClass<P, any>;
      return ac.prototype instanceof bc ? 1 : (bc.prototype instanceof ac ? -1 : 0);
    });

    for (const child of this._t.children) child._ui.computedStyle = undefined;
    // TODO invalidate on children mutate
  }

  /**
   * recalc all elements computedStyle
   * @category UI
   * @internal
   */
  applyLayouts(force=false) {
    if (this._ui.appearance.render === false) return;

    if (!this._ui.computedStyle) {
      force = true;
      this._ui.computedStyle = { left: 0, top: 0, width: 100, height: 100 };
    }

    const layoutItems = this.getLayoutItems();
    const absoluteTransform = this.absoluteTransform();

    for (let l = this._ui.layouts.length - 1; l >= 0; l--) {
      const { attributes } = this._ui.layouts[l];
      let children = layoutItems[l];
      if (!children) continue;

      let cellBox: (n: number) => Box | undefined;
      let cell: ((n: number) => { row: number, column: number });

      const { slots, direction, gap, scaling, alignment, limit } = attributes;
      let { size, aspectRatio, offsetColumn, offsetRow, haphazardly } = attributes;
      const area = this.getArea(attributes);
      if (limit) children = children.slice(0, limit);

      if (slots) {
        cellBox = n => n < slots.length ? slots[n] : undefined
      } else {
        // calculate # of rows/cols
        const minRows = typeof attributes.rows === 'number' ? attributes.rows : attributes.rows?.min || 1;
        const minColumns = typeof attributes.columns === 'number' ? attributes.columns : attributes.columns?.min || 1;
        const maxRows = typeof attributes.rows === 'number' ? attributes.rows : attributes.rows?.max || Infinity;
        const maxColumns = typeof attributes.columns === 'number' ? attributes.columns : attributes.columns?.max || Infinity;
        let rows = minRows;
        let columns = minColumns;
        const alignOffset = {
          left: alignment.includes('left') ? 0 : (alignment.includes('right') ? 1 : 0.5),
          top: alignment.includes('top') ? 0 : (alignment.includes('bottom') ? 1 : 0.5),
        };

        // expand grid as needed in direction specified
        if (rows * columns < children.length) {
          if (['ltr', 'ltr-btt', 'rtl', 'rtl-btt'].includes(direction)) {
            columns = Math.max(columns, Math.min(maxColumns, Math.ceil(children.length / rows)));
            rows = Math.max(rows, Math.min(maxRows, Math.ceil(children.length / columns)));
          }
          if (['ttb', 'btt', 'ttb-rtl', 'btt-rtl'].includes(direction)) {
            rows = Math.max(rows, Math.min(maxRows, Math.ceil(children.length / columns)));
            columns = Math.max(columns, Math.min(maxColumns, Math.ceil(children.length / rows)));
          }
        }

        if (direction === 'ltr')
          cell = (n: number) => ({ column: n % columns, row: Math.floor(n / columns) });
        else if (direction === 'ltr-btt')
          cell = (n: number) => ({ column: n % columns, row: rows - 1 - Math.floor(n / columns) });
        else if (direction === 'rtl')
          cell = (n: number) => ({ column: columns - 1 - n % columns, row: Math.floor(n / columns) });
        else if (direction === 'rtl-btt')
          cell = (n: number) => ({ column: columns - 1 - n % columns, row: rows - 1 - Math.floor(n / columns) });
        else if (direction === 'ttb')
          cell = (n: number) => ({ column: Math.floor(n / rows), row: n % rows });
        else if (direction === 'btt')
          cell = (n: number) => ({ column: Math.floor(n / rows), row: rows - 1 - n % rows });
        else if (direction === 'ttb-rtl')
          cell = (n: number) => ({ column: columns - 1 - Math.floor(n / rows), row: n % rows });
        else if (direction === 'btt-rtl')
          cell = (n: number) => ({ column: columns - 1 - Math.floor(n / rows), row: rows - 1 - n % rows });
        else {
          // for square, expand/shrink grid as needed in either direction
          let vColumns = Math.ceil(Math.sqrt(children.length));
          let vRows = Math.ceil(children.length / vColumns);
          if (vColumns > maxColumns) {
            vColumns = maxColumns;
            vRows = Math.ceil(children.length / vColumns);
          }
          if (vRows > maxRows) {
            vRows = maxRows;
            vColumns = Math.min(maxColumns, Math.ceil(children.length / vRows));
          }
          if (vRows > rows) rows = vRows;
          if (vColumns > columns) columns = vColumns;

          // center used cells within the minimum grid, possibly using fractional row/col
          //console.log('virtual grid', vColumns, vRows, columns, rows);
          cell = n => ({
            column: (alignOffset.left === 1 ? vColumns - 1 - n % vColumns : n % vColumns) + alignOffset.left * (columns - vColumns),
            row: (alignOffset.top === 1 ? vRows - 1 - Math.floor(n / vColumns) : Math.floor(n / vColumns)) + alignOffset.top * (rows - vRows)
          });
        }

        // calculate offset or gap
        let cellGap: Vector | undefined = undefined;

        if (offsetColumn || offsetRow) {
          if (!offsetRow) offsetRow = { x: -offsetColumn!.y, y: offsetColumn!.x };
          if (!offsetColumn) offsetColumn = { x: offsetRow!.y, y: -offsetRow!.x };
        } else {
          // gaps are absolute and convert by ratio
          cellGap = {
            x: (gap && (typeof gap === 'number' ? gap : gap.x) || 0) / absoluteTransform.width * 100,
            y: (gap && (typeof gap === 'number' ? gap : gap.y) || 0) / absoluteTransform.height * 100,
          };
        }

        if (!size) {
          // start with largest size needed to accommodate
          size = cellSizeForArea(rows, columns, area, cellGap, offsetColumn, offsetRow);

          if (!aspectRatio) {
            // find all aspect ratios of child elements and choose best fit
            let minRatio = Infinity;
            let maxRatio = 0;
            for (const c of children) {
              const r = c._ui.appearance.aspectRatio;
              if (r !== undefined) {
                if (r < minRatio) minRatio = r;
                if (r > maxRatio) maxRatio = r;
              }
            }
            if (minRatio < Infinity || maxRatio > 0) {
              if (maxRatio > 1 && minRatio < 1) aspectRatio = 1;
              else if (minRatio > 1) aspectRatio = minRatio;
              else aspectRatio = maxRatio;
            }
          }

          if (aspectRatio) {
            aspectRatio *= absoluteTransform.height / absoluteTransform.width;
            if (aspectRatio > 1) {
              size.height = size.width / aspectRatio;
            } else {
              size.width = aspectRatio * size.height;
            }
          }
        }

        if (haphazardly) {
          haphazardly *= .2 + Math.max(0, cellGap ?
            cellGap.x / size.width + cellGap.y / size.height :
            (Math.abs(offsetColumn!.x) + Math.abs(offsetColumn!.y) + Math.abs(offsetRow!.y) + Math.abs(offsetColumn!.y) - 200) / 100);
        } else {
          haphazardly = 0;
        }
        //console.log('haphazardly', haphazardly);

        const startingOffset = {x: 0, y: 0};
        const cellBoxRC = ({ row, column }: { row: number, column: number }): Box | undefined => {
          //console.log('cell # ', n, row, column, size, area, cellGap);
          if (column > maxColumns || row > maxRows) return;

          return {
            left: area!.left + startingOffset.x + (
              cellGap ?
                column * (size!.width + cellGap!.x) :
                (size!.width * (column * offsetColumn!.x + row * offsetRow!.x)) / 100
            ),
            top: area!.top + startingOffset.y + (
              cellGap ?
                row * (size!.height + cellGap!.y) :
                (size!.height * (row * offsetRow!.y + column * offsetColumn!.y)) / 100
            ),
            width: size!.width,
            height: size!.height,
          }
        }

        // find the edge boxes and calculate the total size needed
        const getTotalArea = (): Box => {
          const boxes = [
            cellBoxRC({ row: 0, column: 0 })!,
            cellBoxRC({ row: rows - 1, column: 0 })!,
            cellBoxRC({ row: rows - 1, column: columns - 1 })!,
            cellBoxRC({ row: 0, column: columns - 1 })!,
          ];

          const cellArea = {
            top: Math.min(...boxes.map(b => b.top)),
            bottom: Math.max(...boxes.map(b => b.top + b.height)),
            left: Math.min(...boxes.map(b => b.left)),
            right: Math.max(...boxes.map(b => b.left + b.width)),
          };

          return {
            width: cellArea.right - cellArea.left,
            height: cellArea.bottom - cellArea.top,
            left: cellArea.left,
            top: cellArea.top
          }
        }
        let totalAreaNeeded = getTotalArea();

        //console.log('size, area', size, area, totalAreaNeeded)

        let scale: Vector = {x: 1, y: 1};

        if (scaling === 'fill') {
          // match the dimension furthest, spilling one dimesion out of bounds
          const s = Math.max(area.width / totalAreaNeeded.width, area.height / totalAreaNeeded.height);
          scale = {x: s, y: s};
        } else if (scaling === 'fit') {
          // match the closest dimension, pushing one dimesion inside
          const s = Math.min(area.width / totalAreaNeeded.width, area.height / totalAreaNeeded.height);
          scale = {x: s, y: s};
        }

        // bound by max size for min rows/cols
        const largestCellSize = cellSizeForArea(minRows, minColumns, area, cellGap, offsetColumn, offsetRow);

        if (size.width * scale.x > largestCellSize.width) {
          const reduction = largestCellSize.width / size.width / scale.x;
          scale.x *= reduction;
          scale.y *= reduction;
        }
        if (size.height * scale.y > largestCellSize.height) {
          const reduction = largestCellSize.height / size.height / scale.y;
          scale.x *= reduction;
          scale.y *= reduction;
        }

        size.width *= scale.x;
        size.height *= scale.y;

        if (!cellGap) { // non-othogonal grid
          if (scaling === 'fill') {
            // reduce offset along dimesion needed to squish
            if (area.width * scale.x / totalAreaNeeded.width > area.height * scale.y / totalAreaNeeded.height) {
              const offsetScale = (area.height - size.height) / (totalAreaNeeded.height * scale.y - size.height);
              if (offsetScale < 1) {
                scale.y = area.height / totalAreaNeeded.height;
                offsetColumn!.y *= offsetScale;
                offsetRow!.y *= offsetScale;
              }
            } else {
              const offsetScale = (area.width - size.width) / (totalAreaNeeded.width * scale.x - size.width);
              if (offsetScale < 1) {
                scale.x = area.width / totalAreaNeeded.width;
                offsetColumn!.x *= offsetScale;
                offsetRow!.x *= offsetScale;
              }
            }

            totalAreaNeeded = getTotalArea();
          }
          // align in reduced area
          startingOffset.x += area.left - totalAreaNeeded.left + alignOffset.left * (area.width - totalAreaNeeded.width * scale.x);
          startingOffset.y += area.top - totalAreaNeeded.top + alignOffset.top * (area.height - totalAreaNeeded.height * scale.y);

        } else { // orthogonal

          if (scaling === 'fill') {
            // reduce gap to squish it to fit, creating overlap
            if (rows > 1) cellGap.y = Math.min(cellGap.y || 0, (area.height - rows * size.height) / (rows - 1));
            if (columns > 1) cellGap.x = Math.min(cellGap.x || 0, (area.width - columns * size.width) / (columns - 1));
          }

          // center in reduced area
          const newWidth = columns * (size.width + cellGap.x!) - cellGap.x!;
          startingOffset.x += alignOffset.left * (area.width - newWidth);
          const newHeight = rows * (size.height + cellGap.y!) - cellGap.y!;
          startingOffset.y += alignOffset.top * (area.height - newHeight);
        }

        //console.log('size, area after fit/fill adj', size, area, scale, cellGap)
        cellBox = n => cellBoxRC(cell(n));
      }

      // apply the final box to each child
      const prandom = random.create('ge' + this.name).random;
      for (let i = 0; i !== children.length; i++) {
        const box = cellBox(i);
        if (!box) continue;
        const child = children[i];
        let aspectRatio = child._ui.appearance.aspectRatio;
        if (aspectRatio) aspectRatio *= absoluteTransform.height / absoluteTransform.width;

        let { width, height } = box;
        if (aspectRatio && aspectRatio !== width / height) {
          if (aspectRatio > width / height) {
            height = width / aspectRatio;
          } else {
            width = aspectRatio * height;
          }
        }
        let left = box.left + (box.width - width) / 2;
        let top = box.top + (box.height - height) / 2;
        if (haphazardly) {
          let wiggle = {x: 0, y: 0};
          let overlap = Infinity;
          for (let tries = 0; tries < 10; tries ++) {
            const rx = prandom();
            const ry = prandom();
            const w = {
              x: haphazardly ? Math.min(
                area.left + area.width - left - width,
                Math.max(area.left - left, (rx - ((left - area.left) / (area.width - width) - .5) / 2 - .5) * haphazardly * (size!.width + size!.height))
              ): 0,
              y: haphazardly ? Math.min(
                area.top + area.height - top - height,
                Math.max(area.top - top, (ry - ((top - area.top) / (area.height - height) - .5) / 2 - .5) * haphazardly * (size!.width + size!.height))
              ): 0
            }
            let worstOverlapThisTry = Infinity;
            if (children.every(c => {
              if (!c._ui.computedStyle) return true;
              const cbox = c._ui.computedStyle;
              const childOverlap = Math.min(
                Math.max(0, cbox.left + cbox.width - left - w.x),
                Math.max(0, cbox.top + cbox.height - top - w.y),
                Math.max(0, left + width + w.x - cbox.left),
                Math.max(0, top + height + w.y - cbox.top)
              );
              if (childOverlap === 0) return true;
              worstOverlapThisTry = Math.min(childOverlap, worstOverlapThisTry);
            })) {
              wiggle = w;
              break;
            }
            if (worstOverlapThisTry < overlap) {
              overlap = worstOverlapThisTry;
              wiggle = w;
            }
          }
          left += wiggle.x
          top += wiggle.y
        }
        child._ui.computedStyle = { width, height, left, top };

        child.applyLayouts(force);
      }
    }
  }

  /** @internal */
  getLayoutItems() {
    const layoutItems: GameElement<P>[][] = [];
    for (const child of this._t.children) {
      for (let l = this._ui.layouts.length - 1; l >= 0; l--) {
        const { applyTo } = this._ui.layouts[l];

        if ((typeof applyTo === 'function' && child instanceof applyTo) ||
          (typeof applyTo === 'string' && child.name === applyTo) ||
          child === applyTo ||
          (applyTo instanceof ElementCollection && applyTo.includes(child))) {

          layoutItems[l] = layoutItems[l] ? layoutItems[l].concat([child]) : [child];
          break;
        }
      }
    }
    return layoutItems;
  }

  /**
   * calculate working area
   * @internal
   */
  getArea(attributes: { margin?: number | { top: number, bottom: number, left: number, right: number }, area?: Box }): Box {
    let { area, margin } = attributes;
    if (area) return area;
    if (!margin) return { left: 0, top: 0, width: 100, height: 100 };

    // margins are absolute, so translate
    const absoluteTransform = this.absoluteTransform();
    const transform: Vector = {
      x: absoluteTransform.width / 100,
      y: absoluteTransform.height / 100
    }

    margin = (typeof margin === 'number') ? { left: margin, right: margin, top: margin, bottom: margin } : {...margin};
    margin.left /= transform.x;
    margin.right /= transform.x;
    margin.top /= transform.y;
    margin.bottom /= transform.y;

    return {
      left: margin.left,
      top: margin.top,
      width: 100 - margin.left - margin.right,
      height: 100 - margin.top - margin.bottom
    };
  }

  /**
   * Define the appearance of this element. Any values provided override previous ones.
   * @category UI
   *
   * @param appearance - Possible values are:
   * @param appearance.className - A class name to add to the dom element
   *
   * @param appearance.render - A function that takes this element as its only
   * argument and returns JSX for the element. See {@link /styling.md} for more
   * on usage.
   *
   * @param appearance.aspectRatio - The aspect ratio for this element. This
   * value is a ratio of width over height. All layouts defined in {@link
   * layout} will respect this aspect ratio.
   *
   * @param appearance.connections - If the elements immediately within this
   * element are connected using {@link Space#connectTo}, this makes those
   * connections visible as connecting lines. Providing a `label` will place a
   * label over top of this line by calling the provided function with the
   * distance of the connection specified in {@link Space#connectTo} and using
   * the retured JSX. If `labelScale` is provided, the label is scaled by this
   * amount.
   */
  appearance(appearance: ElementUI<P, this>['appearance']) {
    Object.assign(this._ui.appearance, appearance);
  }

  /** @internal */
  getMoveTransform() {
    if (!this._ui.computedStyle || !this._t.was || this._t.was === this.branch()) return;
    const previousPosition = this.board._ui.previousStyles[this._t.was];
    if (!previousPosition) return;
    const newPosition = this.relativeTransformToBoard();
    return {
      scaleX: previousPosition.width / newPosition.width,
      scaleY: previousPosition.height / newPosition.height,
      translateX: (previousPosition.left - newPosition.left) / newPosition.width * 100,
      translateY: (previousPosition.top - newPosition.top) / newPosition.height * 100,
    };
  }

  /** @internal */
  doneMoving() {
    const branch = this.branch();
    this._t.was = branch;
    if (this._ui.computedStyle) {
      this.board._ui.previousStyles[branch] = this.relativeTransformToBoard();
    }
  }
}
