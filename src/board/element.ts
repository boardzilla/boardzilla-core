import ElementCollection from './element-collection.js';
import { shuffleArray, times } from '../utils.js';
import {
  translate,
  cellSizeForArea,
  cellBoxRC,
  getTotalArea,
} from './utils.js';
import { serializeObject, deserializeObject } from '../action/utils.js';
import random from 'random-seed';

import type GameManager from '../game-manager.js';
import type { default as Player, BasePlayer } from '../player/player.js';
import type { default as Game, BaseGame } from './game.js';
import type Space from './space.js';
import type ConnectedSpaceMap from './connected-space-map.js';
import type { ElementFinder, Sorter } from './element-collection.js';
import type { Argument } from '../action/action.js';
import type AdjacencySpace from './adjacency-space.js';

export type ElementJSON = ({className: string, children?: ElementJSON[]} & Record<string, any>);

export type ElementClass<T extends GameElement = GameElement> = {
  new(ctx: Partial<ElementContext>): T;
  isGameElement: boolean; // here to help enforce types
  visibleAttributes?: string[];
}

/**
 * Either the name of a property of the object that can be lexically sorted, or
 * a function that will be called with the object to sort and must return a
 * lexically sortable value.
 * @category Board
 */
export type GenericSorter = string | ((e: GameElement) => number | string)

/**
 * The attributes of this class that inherits GameElement, excluding internal
 * ones from the base GameElement
 */
export type ElementAttributes<T extends GameElement> =
  Partial<Pick<T, {[K in keyof T]: K extends keyof GameElement ? never : (T[K] extends (...a:any[]) => any ? never : K)}[keyof T] | 'name' | 'player' | 'row' | 'column' | 'rotation'>>

export type ElementContext = {
  gameManager: GameManager;
  top: GameElement;
  namedSpaces: Record<string, Space<Game>>
  uniqueNames: Record<string, boolean>
  removed: GameElement;
  sequence: number;
  player?: Player;
  classRegistry: ElementClass[];
  moves: Record<string, string>;
  trackMovement: boolean;
};

/**
 * A Box size and position relative to a container
 * @category UI
 */
export type Box = { left: number, top: number, width: number, height: number };
/**
 * An (x, y) Vector
 * @category UI
 */
export type Vector = { x: number, y: number };

export type Direction = 'up' | 'down' | 'left' | 'right'
export type DirectionWithDiagonals = Direction | 'upleft' | 'upright' | 'downleft' | 'downright';

export type ElementUI<T extends GameElement> = {
  layouts: {
    applyTo: ElementClass | GameElement | ElementCollection | string,
    attributes: LayoutAttributes<T>
  }[],
  appearance: {
    className?: string,
    render?: ((el: T) => JSX.Element | null) | false,
    aspectRatio?: number,
    effects?: { attributes: ElementAttributes<T>, name: string }[],
    info?: ((el: T) => JSX.Element | null | boolean) | boolean,
    connections?: {
      thickness?: number,
      style?: 'solid' | 'double',
      color?: string,
      fill?: string,
      label?: ({distance, to, from}: {distance: number, to: Space<Game>, from: Space<Game> }) => React.ReactNode,
      labelScale?: number,
    },
  },
  computedStyle?: Box & { transformOrigin?: string },
  computedLayouts?: {
    area: Box,
    grid?: {
      anchor: Vector,
      origin: { column: number, row: number },
      columns: number,
      rows: number,
      offsetColumn: Vector,
      offsetRow: Vector,
    },
    showBoundingBox?: string | boolean,
    children: GameElement[],
    drawer: ElementUI<T>['layouts'][number]['attributes']['drawer']
  }[],
  getBaseLayout: () => LayoutAttributes<T>,
  ghost?: boolean,
};

/**
 * List of attributes used to create a new layout in {@link GameElement#layout}.
 * @category UI
 */
export type LayoutAttributes<T extends GameElement> = {
  /**
   * Instead of providing `area`, providing a `margin` defines the bounding box
   * in terms of a margin around the edges of this element. This value is an
   * absolute percentage of the board's size so that margins specified on
   * different layouts with the same value will exactly match.
   */
 margin?: number | { top: number, bottom: number, left: number, right: number },
  /**
   * A box defining the layout's bounds within this element. Unless `size` is
   * set too large, no elements will ever overflow this area. If unspecified,
   * the entire area is used, i.e. `{ left: 0, top: 0, width: 100, height: 100
   * }`
   */
  area?: Box,
  /**
   * The number of rows to allot for placing elements in this layout. If a
   * number is provided, this is fixed. If min/max values are provided, the
   * layout will allot at least `min` and up to `max` as needed. If `min` is
   * omitted, a minimum of 1 is implied. If `max` is omitted, as many are used
   * as needed. Default is no limits on either.
   */
  rows?: number | {min: number, max?: number} | {min?: number, max: number},
  /**
   * Columns, as per `rows`
   */
  columns?: number | {min: number, max?: number} | {min?: number, max: number},
  /**
   * If supplied, this overrides all other attributes to define a set of
   * strictly defined boxes for placing each element. Any elements that exceed
   * the number of slots provided are not displayed.
   */
  slots?: Box[],
  /**
   * Size alloted for each element placed in this layout. Overrides `scaling`
   * and all defined aspect ratios for these elements, fixing the size for each
   * element at the specified size.
   */
  size?: { width: number, height: number },
  /**
   * Aspect ratio for each element placed in this layout. This value is a ratio
   * of width over height. Elements will adhere to this ratio unless they have
   * their own specified `aspectRatio` in their {@link
   * GameElement#appearance}. This value is ignored if `size` is provided.
   */
  aspectRatio?: number, // w / h
  /**
   * Scaling strategy for the elements placed in this layout.
   * - *fit*: Elements scale up or down to fit within the area alloted without
   *    squshing
   * - *fill*: Elements scale up or down to completely fill the area, squishing
   *    themselves together as needed along one dimension.
   */
  scaling?: 'fit' | 'fill'
  /**
   * If provided, this places a gap between elements. If scaling is 'fill', this
   * is considered a maximum but may shrink or even become negative in order to
   * fill the area. This value is an absolute percentage of the board's size so
   * that gaps specified on different layouts with the same value will exactly
   * match
   */
  gap?: number | { x: number, y: number },
  /**
   * If more room is provided than needed, this determines how the elements will
   * align themselves within the area.
   */
  alignment: 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'bottom left' | 'top right' | 'bottom right' | 'center',
  /**
   * Instead of `gap`, providing an `offsetColumn`/`offsetRow` specifies that
   * the contained elements must offset one another by a specified amount as a
   * percentage of the elements size, i.e. `offsetColumn=100` is equivalent to a
   * `gap` of 0. This allows non-orthogonal grids like hex or diamond. If one of
   * `offsetColumn`/`offsetRow` is provided but not the other, the unspecified
   * one will be 90° to the one specified. Like `gap`, if `scaling` is set to
   * `fill`, these offsets may squish to fill space.
   */
  offsetColumn?: Vector | number,
  /**
   * As `offsetColumn`
   */
  offsetRow?: Vector | number,
  /**
   * Specifies the direction in which elements placed here should fill up the
   * rows and columns of the layout. Rows or columns will increase to their
   * specified maximum as needed. Therefore if, for example, `direction` is
   * `"ltr"` and `columns` has no maximum, there will never be a second row
   * added. Values are:
   * - *square*: fill rows and columns equally to maintain as square a grid as possible (default)
   * - *ltr*: fill columns left to right, then rows top to bottom once maximum columns reached
   * - *rtl*: fill columns right to left, then rows top to bottom once maximum columns reached
   * - *ltr-btt*: fill columns left to right, then rows bottom to top once maximum columns reached
   * - *rtl-btt*: fill columns right to left, then rows bottom to top once maximum columns reached
   * - *ttb*: fill rows top to bottom, then columns left to right once maximum rows reached
   * - *btt*: fill rows bottom to top, then columns left to right once maximum rows reached
   * - *ttb-rtl*: fill rows top to bottom, then columns right to left once maximum rows reached
   * - *btt-rtl*: fill rows bottom to top, then columns right to left once maximum rows reached
   */
  direction: 'square' | 'ltr' | 'rtl' | 'rtl-btt' | 'ltr-btt' | 'ttb' | 'ttb-rtl' | 'btt' | 'btt-rtl',
  /**
   * If specified, no more than `limit` items will be visible. This is useful
   * for displaying e.g. decks of cards where showing only 2 or 3 cards provides
   * a deck-like appearance without needed to render more cards underneath that
   * aren't visible.
   */
  limit?: number,
  /**
   * If `scaling` is `"fill"`, this will limit the total amount of overlap if
   * elements are squished together in their space before they will start to
   * shrink to fit. This is useful for e.g. cards that can overlap but that must
   * leave a certain amount visible to clearly identify the card.
   */
  maxOverlap?: number,
  /**
   * A number specifying an amount of randomness added to the layout to provide
   * a more natural looking placement
   */
  haphazardly?: number,
  /**
   * Set to true to prevent these elements from automatically changing position
   * within the container grid.
   */
  sticky?: boolean,
  /**
   * Set to true for debugging. Creates a visible box on screen around the
   * defined `area`, tagged with the provided string.
   */
  showBoundingBox?: string | boolean,
  /**
   * Specifies that this layout should inhabit a drawer, a collapsible area that
   * can be hidden to save overall space on the playing area.
   */
  drawer?: {
    closeDirection: 'left' | 'right' | 'down' | 'up',
    /**
     * JSX to appear in the tab while open
     */
    tab: ((el: T) => React.ReactNode) | false,
    /**
     * JSX to appear in the tab while closed, if it differs from the open
     * appearance
     */
    closedTab?: ((el: T) => React.ReactNode) | false,
    /**
     * A function that will be checked at each game state. If it returns true,
     * the tab will automatically open.
     */
    openIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
    /**
     * A function that will be checked at each game state. If it returns true,
     * the tab will automatically close.
     */
    closeIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
  }
};

/**
 * Abstract base class for all Game elements. Do not subclass this
 * directly. Instead use {@link Space} or {@link Piece} as the base for
 * subclassing your own elements.
 * @category Board
 */
export default class GameElement<G extends BaseGame = BaseGame, P extends BasePlayer = BasePlayer> {
  /**
   * Element name, used to distinguish elements. Elements with the same name are
   * generally considered indistibuishable. Names are also used for easy
   * searching of elements.
   * @category Queries
   */
  name: string;

  /**
   * Player with which this element is identified. This does not affect
   * behaviour but will mark the element as `mine` in queries in the context of
   * this player (during an action taken by a player or while the game is
   * viewed by a given player.).
   * @category Queries
   */
  player?: P;

  /**
   * Row of element within its layout grid if specified directly or by a
   * "sticky" layout.
   * @category Structure
   */
  row?: number;

  /**
   * Column of element within its layout grid if specified directly or by a
   * "sticky" layout.
   * @category Structure
   */
  column?: number;

  _rotation?: number; // degrees

  /**
   * The {@link Game} to which this element belongs
   * @category Structure
   */
  game: G;

  /**
   * ctx shared for all elements in the tree
   * @internal
   */
  _ctx: ElementContext

  /**
   * tree info
   * @internal
   */
  _t: {
    children: ElementCollection<GameElement>,
    parent?: GameElement,
    id: number,
    order?: 'normal' | 'stacking',
    was?: string,
    setId: (id: number) => void,
  } = {
    children: new ElementCollection<GameElement>(),
    id: 0,
    setId: () => {}
  };

  _size?: {
    width: number,
    height: number,
    shape: string[],
    edges?: Record<string, Partial<Record<Direction, string>>>
  }

  static isGameElement = true;

  static unserializableAttributes = ['_ctx', '_t', '_ui', 'game'];

  static visibleAttributes: string[] | undefined;

  /**
   * Do not use the constructor directly. Instead Call {@link
   * GameElement#create} or {@link GameElement#createMany} on the element in
   * which you want to create a new element.
   * @category Structure
   */
  constructor(ctx: Partial<ElementContext>) {
    this._ctx = ctx as ElementContext;
    this._ctx.classRegistry ??= [];
    if (!ctx.top) {
      this._ctx.top = this as unknown as GameElement;
      this._ctx.sequence = 0;
    }
    if (!this._ctx.namedSpaces) {
      this._ctx.uniqueNames = {};
      this._ctx.namedSpaces = {};
    }

    this._t = {
      children: new ElementCollection(),
      id: this._ctx.sequence++,
      setId: (id?: number) => {
        if (id !== undefined) {
          this._t.id = id;
          if (this._ctx.sequence < id) this._ctx.sequence = id;
        }
      },
    }
  }

  /**
   * String used for representng this element in game messages when the object
   * is passed directly, e.g. when taking the choice directly from a
   * chooseOnBoard choice.
   * @category Structure
   */
  toString() {
    return this.name || this.constructor.name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  }

  isVisibleTo(_player: Player | number) {
    return true;
  }

  isVisible() {
    return true;
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
  all<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  all(className?: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement<G, P>>;
  all(className?: any, ...finders: ElementFinder[]) {
    return this._t.children.all(className, ...finders);
  }

  /**
   * Finds the first element within this element recursively that matches the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   * @returns A matching element, if found
   */
  first<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  first(className?: ElementFinder, ...finders: ElementFinder[]): GameElement<G, P> | undefined;
  first(className?: any, ...finders: ElementFinder[]) {
    return this._t.children.first(className, ...finders);
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
  firstN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  firstN(n: number, className?: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement<G, P>>;
  firstN(n: number, className?: any, ...finders: ElementFinder[]) {
    return this._t.children.firstN(n, className, ...finders);
  }

  /**
   * Finds the last element within this element recursively that matches the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   * @returns A matching element, if found
   */
  last<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  last(className?: ElementFinder, ...finders: ElementFinder[]): GameElement<G, P> | undefined;
  last(className?: any, ...finders: ElementFinder[]) {
    return this._t.children.last(className, ...finders);
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
  lastN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  lastN(n: number, className: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement<G, P>>;
  lastN(n: number, className: any, ...finders: ElementFinder[]) {
    return this._t.children.lastN(n, className, ...finders);
  }


  /**
   * Alias for {@link first}
   * @category Queries
   */
  top<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  top(className?: ElementFinder, ...finders: ElementFinder[]): GameElement<G, P> | undefined;
  top(className?: any, ...finders: ElementFinder[]) {
    return this._t.children.top(className, ...finders);
  }

  /**
   * Alias for {@link firstN}
   * @category Queries
   */
  topN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  topN(n: number, className?: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement<G, P>>;
  topN(n: number, className?: any, ...finders: ElementFinder[]) {
    return this._t.children.topN(n, className, ...finders);
  }

  /**
   * Alias for {@link last}
   * @category Queries
   */
  bottom<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  bottom(className?: ElementFinder, ...finders: ElementFinder[]): GameElement<G, P> | undefined;
  bottom(className?: any, ...finders: ElementFinder[]) {
    return this._t.children.bottom(className, ...finders);
  }

  /**
   * Alias for {@link lastN}
   * @category Queries
   */
  bottomN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  bottomN(n: number, className?: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement<G, P>>;
  bottomN(n: number, className?: any, ...finders: ElementFinder[]) {
    return this._t.children.bottomN(n, className, ...finders);
  }

  /**
   * Finds "sibling" elements (elements that are directly inside the parent of this element) that match the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   */
  others<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  others(className?: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement<G, P>>;
  others(className?: any, ...finders: ElementFinder[]) {
    if (!this._t.parent) new ElementCollection();
    return this._t.parent!._t.children.all(className, (el: GameElement) => el !== this, ...finders);
  }

  /**
   * Return whether any element within this element recursively matches the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   */
  has<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): boolean;
  has(className?: ElementFinder, ...finders: ElementFinder[]): boolean;
  has(className?: any, ...finders: ElementFinder[]) {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      if (className) finders = [className, ...finders];
      return !!this.first(GameElement, ...finders);
    }
    return !!this.first(className, ...finders);
  }

  /**
   * If this element is adjacent to some other element, using the nearest
   * containing space that has an adjacency map.
   * @category Adjacency
   */
  isAdjacentTo(element: GameElement): boolean {
    const graph = this.containerWithProperty('isAdjacent');
    if (!graph) return false;
    return (graph as AdjacencySpace<G>).isAdjacent(this, element);
  }

  /**
   * Finds the shortest distance between two spaces
   * @category Adjacency
   *
   * @param element - {@link element} to measure distance to
   */
  distanceTo(element: GameElement): number {
    const graph = this.containerWithProperty('distanceBetween');
    if (!graph) return Infinity;
    return (graph as ConnectedSpaceMap<G>).distanceBetween(this, element);
  }

  /**
   * Find all elements adjacent based on row/column placement or based on this
   * element having connections created by Space#connectTo. Uses the same
   * parameters as {@link GameElement#all}
   * @category Adjacency
   */
  adjacencies<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  adjacencies(className?: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement<G, P>>;
  adjacencies(className?: any, ...finders: ElementFinder[]) {
    const graph = this.containerWithProperty('isAdjacent') as AdjacencySpace<G> | undefined;
    if (!graph) return false;
    return (graph as ConnectedSpaceMap<G>).allAdjacentTo(this, className, ...finders);
  }

  /**
   * Finds all spaces connected to this space by a distance no more than
   * `distance`
   *
   * @category Adjacency
   */
  withinDistance<F extends GameElement>(distance: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  withinDistance(distance: number, className?: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement<G, P>>;
  withinDistance(distance: number, className?: any, ...finders: ElementFinder[]) {
    const graph = this.containerWithProperty('allWithinDistanceOf');
    if (!graph) return new ElementCollection();
    return (graph as ConnectedSpaceMap<G>).allWithinDistanceOf(this, distance, className, ...finders);
  }

  /**
   * Set this class to use a different ordering style.
   * @category Structure
   * @param order - ordering style
   * - "normal": Elements placed into this element are put at the end of the
   *   list (default)
   * - "stacking": Elements placed into this element are put at the beginning of
   *   the list. This is prefered for elements that stack. E.g. if a stack of
   *   cards has `order` set to `stacking` the {@link first} method will return
   *   the last card placed in the stack, rather than the first one placed in
   *   the stack.
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
  container<T extends GameElement>(className?: ElementClass<T>): T | undefined {
    if (!className) return this._t.parent as T;
    if (this._t.parent) return this._t.parent instanceof className ?
      this._t.parent as T:
      this._t.parent.container(className);
  }

  /**
   * Returns this elements containing element that also has a given property.
   * @category Queries
   */
  containerWithProperty(property: string, value?: any): GameElement | undefined {
    const parent = this._t.parent;
    if (parent) return property in parent && (value === undefined || parent[property as keyof typeof parent] === value) ?
      parent:
      parent.containerWithProperty(property, value);
  }

  /**
   * Returns whether this element has no elements placed within it.
   * @category Structure
   */
  isEmpty() {
    return !this._t.children.length;
  }

  /**
   * Sorts the elements directly contained within this element by some {@link Sorter}.
   * @category Structure
   */
  sortBy(key: GenericSorter | GenericSorter[], direction?: "asc" | "desc"): ElementCollection<GameElement<G, P>> {
    return this._t.children.sortBy(key as Sorter<GameElement> | Sorter<GameElement>[], direction) as ElementCollection<GameElement<G, P>>
  }

  /**
   * re-orders the elements directly contained within this element randomly.
   * @category Structure
   */
  shuffle() {
    shuffleArray(this._t.children, this._ctx.gameManager?.random || Math.random);
  }

  /**
   * The player that owns this element, or the first element that contains this
   * element searching up through the parent hierarchy. This is related to, but
   * different than {@link player}. E.g. if a standard playing card is in a
   * player's hand, typically the `hand.player` will be assigned to that player
   * but the card itself would not have a `player`. In this case the
   * card.owner() will equal the player in whose hand the card is placed.
   * @category Structure
   */
  get owner(): P | undefined {
    return this.player !== undefined ? this.player as P : this._t.parent?.owner as P;
  }

  /**
   * Whether this element belongs to the player viewing the game. A player is
   * considered to be currently viewing the game if this is called in the
   * context of an action taken by a given player (during an action taken by a
   * player or while the game is viewed by a given player.) It is an error to
   * call this method when not in the context of a player action. When querying
   * for elements using {@link ElementFinder} such as {@link all} and {@link
   * first}, {@link mine} is available as a search key that accepts a value of
   * true/false
   @category Queries
   */
  get mine() {
    if (!this._ctx.player) return false; // throw?
    return this.owner === this._ctx.player;
  }

  /**
   * Create an element inside this element. This can only be called during the
   * game setup (see {@link createGame}. Any game elements that are required
   * must be created before the game starts. Elements that only appear later in
   * the game can be created inside the {@link Game#pile} or made invisible.
   * @category Structure
   *
   * @param className - Class to create. This class must be included in the `elementClasses` in {@link createGame}.
   * @param name - Sets {@link GameElement#name | name}
   * @param attributes - Sets any attributes of the class that are defined in
   * your own class that extend {@link Space}, {@link Piece}, or {@link
   * Game}. Can also include {@link player}.
   *
   * @example
   * deck.create(Card, 'ace-of-hearts', { suit: 'H', value: '1' });
   */
  create<T extends GameElement>(className: ElementClass<T>, name: string, attributes?: ElementAttributes<T>): T {
    if (this._ctx.gameManager?.phase === 'started') throw Error('Game elements cannot be created once game has started.');
    const el = this.createElement(className, name, attributes);
    el._t.parent = this;
    if (this._t.order === 'stacking') {
      this._t.children.unshift(el);
    } else {
      this._t.children.push(el);
    }
    if ('isSpace' in el && name) {
      if (name in this._ctx.uniqueNames) { // no longer unique
        delete this._ctx.namedSpaces[name];
        this._ctx.uniqueNames[name] = false
      } else {
        this._ctx.namedSpaces[name] = el as unknown as Space<Game>;
        this._ctx.uniqueNames[name] = true;
      }
    }
    return el as T;
  }

  /**
   * Create n elements inside this element of the same class. This can only be
   * called during the game setup (see {@link createGame}. Any game elements
   * that are required must be created before the game starts. Elements that
   * only appear later in the game can be created inside the {@link Game#pile}
   * or made invisible.
   * @category Structure
   *
   * @param n - Number to create
   * @param className - Class to create. This class must be included in the `elementClasses` in {@link createGame}.
   * @param name - Sets {@link GameElement#name | name}
   * @param attributes - Sets any attributes of the class that are defined in
   * your own class that extend {@link Space}, {@link Piece}, or {@link
   * Game}. Can also include {@link player}. If a function is supplied here, a
   * single number argument will be passed with the number of the added element,
   * starting with 1.
   */
  createMany<T extends GameElement>(n: number, className: ElementClass<T>, name: string, attributes?: ElementAttributes<T> | ((n: number) => ElementAttributes<T>)): ElementCollection<T> {
    return new ElementCollection<T>(...times(n, i => this.create(className, name, typeof attributes === 'function' ? attributes(i) : attributes)));
  }

  /**
   * Base element creation method
   * @internal
   */
  createElement<T extends GameElement>(className: ElementClass<T>, name: string, attrs?: ElementAttributes<T>): T {
    if (!this._ctx.classRegistry.includes(className)) {
      this._ctx.classRegistry.push(className);
    }
    const el = new className(this._ctx);
    el.game = this.game;
    el.name = name;
    Object.assign(el, attrs);
    if ('afterCreation' in el) (el.afterCreation as () => void).bind(el)();
    return el;
  }

  /**
   * Permanently remove an element. This can only be done while defining the
   * game, and is usually only useful when creating groups of elements, such as
   * {@link createMany} or {@link createGrid} where some of the created elements
   * are not needed.
   * @category Structure
   */
  destroy() {
    if (this._ctx.gameManager?.phase === 'started') throw Error('Game elements cannot be destroy once game has started.');
    const position = this._t.parent!._t.children.indexOf(this);
    this._t.parent!._t.children.splice(position, 1);
  }

  /**
   * Rotation of element if set, normalized to 0-359 degrees
   * @category Structure
   */
  get rotation() {
    if (this._rotation === undefined) return 0;
    return (this._rotation % 360 + 360) % 360;
  }

  set rotation(r: number) {
    this._rotation = r;
  }

  /**
   * Returns a string identifying the tree position of the element suitable for
   * anonymous reference
   * @internal
   */
  branch() {
    const branches = [];
    let node = this as GameElement;
    while (node._t.parent) {
      const index = node._t.parent._t.children.indexOf(node);
      if (index === -1) throw Error(`Reference to element ${this.constructor.name}${this.name ? ':' + this.name : ''} is no longer current`);
      branches.unshift(node._t.parent._t.children.indexOf(node));
      node = node._t.parent;
    }
    branches.unshift(this._ctx.removed === node ? 1 : 0);
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
  atID(id: number): GameElement | undefined {
    return this._t.children.find(c => c._t.id === id) || this._t.children.find(c => c.atID(id))?.atID(id)
  }

  _cellAt(pos: Vector): string | undefined {
    if (!this._size) return pos.x === 0 && pos.y === 0 ? '.' : undefined;
    if (this.rotation === 0) return this._size.shape[pos.y]?.[pos.x];
    if (this.rotation === 90) return this._size.shape[this._size.height - 1 - pos.x]?.[pos.y];
    if (this.rotation === 180) return this._size.shape[this._size.height - 1 - pos.y]?.[this._size.width - 1 - pos.x];
    if (this.rotation === 270) return this._size.shape[pos.x]?.[this._size.width - 1 - pos.y];
  }

  _sizeNeededFor(_element: GameElement) {
    return {width: 1, height: 1};
  }

  /**
   * Set an irregular shape for this element. This is only meaningful for the
   * purposes of finding specifically adjacent cells when placed into a
   * PieceGrid. See {@link PieceGrid#adjacenciesByCell}. When rendered in a
   * PieceGrid, the element will have a size large enough to fill the
   * appropriate number of spaces in the grid, but it's appearance is otherwise
   * unaffected and will be based on {@link appearance}. When not rendered in a
   * PieceGrid, the element will take up a single cell but will be scaled
   * relatively to other elements with a shape in the same layout.
   *
   * @param shape - A set of single characters used as labels for each cell. The
   * cell label characters are provided as an array of strings, with each string
   * being one row of cell labels, with spaces used to indicate empty "holes" in
   * the shape. Each row must be the same length. The specific non-space
   * characters used are used for labelling the adjacencies in {@link
   * PieceGrid#adjacenciesByCell} but are otherwise unimportant.
   * @category Adjacency
   *
   * @example
   *
   * domino12.setShape(
   *   '12'
   * );

   * tetrisPiece.setShape(
   *   'XX ',
   *   ' XX'
   * );
   */
  setShape(...shape: string[]) {
    if (this._ctx.gameManager?.phase === 'started') throw Error('Cannot change shape once game has started.');
    if (shape.some(s => s.length !== shape[0].length)) throw Error("Each row in shape must be same size. Invalid shape:\n" + shape);
    this._size = {
      shape,
      width: shape[0].length,
      height: shape.length
    }
  }

  /**
   * Set the edge labels for this element. These are only meaningful for the
   * purposes of finding specifically adjacent edges when placed into a
   * PieceGrid. See {@link PieceGrid#adjacenciesByEdge}.
   * @category Adjacency
   *
   * @param edges - A set of edge labels for each cell label provided by {@link
   * setShape}. For simple 1-celled shapes, the edges can be provided without
   * cell labels.
   *
   * @example
   *
   * // a bridge tile with a road leading from left to right and a river leading
   * // from top to bottom.
   * simpleTile.setEdge(
   *   up: 'river',
   *   down: 'river',
   *   left: 'road'
   *   right: 'road'
   * });
   *
   * // A tetris-shaped tile with sockets coming out either "end"
   * tetrisPiece.setShape(
   *   'AX ',
   *   ' XB'
   * );
   * tetrisPiece.setEdge({
   *   A: {
   *     left: 'socket'
   *   },
   *   B: {
   *     right: 'socket'
   *   }
   * });
   */
  setEdges(edges: Record<string, Partial<Record<Direction, string>>> | Partial<Record<Direction, string>>) {
    if (this._ctx.gameManager?.phase === 'started') throw Error('Cannot change shape once game has started.');
    if (Object.keys(edges)[0].length === 1) {
      const missingCell = Object.keys(edges).find(c => this._size?.shape.every(s => !s.includes(c)));
      if (missingCell) throw Error(`No cell '${missingCell}' defined in shape`);
      this._size!.edges = edges as Record<string, Record<Direction, string>>;
    } else {
      if (this._size) throw Error("setEdges must use the cell characters from setShape as keys");
      this._size = {shape: ['.'], width: 1, height: 1, edges: {'.': edges}};
    }
  }

  /**
   * Whether this element has the given element in its parent hierarchy
   * @category Structure
   */
  isDescendantOf(el: GameElement): boolean {
    return this._t.parent === el || !!this._t.parent?.isDescendantOf(el)
  }

  attributeList<T extends GameElement>(this: T): ElementAttributes<T> {
    let attrs: Record<string, any>;
    ({ ...attrs } = this);
    for (const attr of (this.constructor as typeof GameElement).unserializableAttributes as string[]) delete attrs[attr];

    // remove methods
    return Object.fromEntries(Object.entries(attrs).filter(
      ([, value]) => typeof value !== 'function'
    )) as ElementAttributes<T>;
  }

  /**
   * JSON representation
   * @param seenBy - optional player position viewing the game
   * @internal
   */
  toJSON(seenBy?: number) {
    let attrs = this.attributeList();

    // remove hidden attributes
    if (seenBy !== undefined && !this.isVisibleTo(seenBy)) {
      attrs = Object.fromEntries(Object.entries(attrs).filter(
        ([attr]) => ['_visible', 'row', 'column', '_rotation', '_size'].includes(attr) ||
          (attr !== 'name' && (this.constructor as typeof GameElement).visibleAttributes?.includes(attr))
      )) as typeof attrs;
    }
    const json: ElementJSON = Object.assign(serializeObject(attrs, seenBy !== undefined), { className: this.constructor.name });
    if (seenBy === undefined || 'isSpace' in this || attrs['name']) json._id = this._t.id; // this should also check for *unique* name or we'll leak information
    if (this._t.order) json.order = this._t.order;
    if (this._t.was) json.was = this._t.was;
    // do not expose hidden deck shuffles
    if (seenBy && this._t.was && this._t.parent?._t.order === 'stacking' && !this.hasChangedParent() && !this.isVisibleTo(seenBy)) json.was = this.branch();
    if (this._t.children.length && (
      !seenBy || !('_screen' in this) || this._screen === undefined ||
        (this._screen === 'all-but-owner' && this.owner?.position === seenBy) ||
        (this._screen instanceof Array && this._screen.includes(this.owner?.position))
    )) {
      json.children = Array.from(this._t.children.map(c => c.toJSON(seenBy)));
    }

    if (globalThis.window) { // guard-rail in dev
      try {
        structuredClone(json);
      } catch (e) {
        console.error(`invalid properties on ${this}:\n${JSON.stringify(json, undefined, 2)}`);
        throw(e);
      }
    }
    return json;
  }

  createChildrenFromJSON(childrenJSON: ElementJSON[], branch: string) {
    // preserve previous children references
    const childrenRefs = [...this._t.children];
    this._t.children = new ElementCollection<GameElement<G, P>>();

    for (let i = 0; i !== childrenJSON.length; i++) {
      const json = childrenJSON[i];
      let { className, children, was, _id, name, order } = json;
      let child: GameElement | undefined = undefined;
      if (_id !== undefined) { // try to match space, preserve the object and any references. this should also match the .was if it's a sibling
        child = childrenRefs.find(c => c._t.id === _id && c.name === name);
      }
      if (!child) {
        const elementClass = this._ctx.classRegistry.find(c => c.name === className);
        if (!elementClass) throw Error(`No class found ${className}. Declare any classes in \`game.registerClasses\``);
        child = this.createElement(elementClass, name);
        child._t.setId(_id);
        child._t.parent = this;
        child._t.order = order;
      }
      child._t.was = was;
      if (this._ctx.trackMovement && !('isSpace' in child)) child._t.was = branch + '/' + i;
      this._t.children.push(child);
      child.createChildrenFromJSON(children || [], branch + '/' + i);
    }
  }

  assignAttributesFromJSON(childrenJSON: ElementJSON[], branch: string) {
    for (let i = 0; i !== childrenJSON.length; i++) {
      const json = childrenJSON[i];
      let { className: _cn, children, was: _w, _id, name: _n, order: _o, ...rest } = json;
      rest = deserializeObject({...rest}, this.game);
      let child = this._t.children[i];
      Object.assign(child, rest);
      child.assignAttributesFromJSON(children || [], branch + '/' + i);
    }
  }

  cloneInto<T extends GameElement>(this: T, into: GameElement): T {
    let attrs = this.attributeList();
    delete attrs.column;
    delete attrs.row;

    const clone = into.createElement(this.constructor as ElementClass<T>, this.name, attrs);
    if (into._t.order === 'stacking') {
      into._t.children.unshift(clone);
    } else {
      into._t.children.push(clone);
    }
    clone._t.parent = into;
    clone._t.order = this._t.order;
    for (const child of this._t.children) child.cloneInto(clone);
    return clone;
  }

  /**
   * UI
   * @internal
   */

  _ui: ElementUI<this> = {
    layouts: [],
    appearance: {},
    getBaseLayout: () => ({
      alignment: 'center',
      direction: 'square'
    })
  };

  resetUI() {
    this._ui.layouts = [{
      applyTo: GameElement,
      attributes: this._ui.getBaseLayout()
    }];
    this._ui.appearance = {};
    this._ui.computedStyle = undefined;
    for (const child of this._t.children) child.resetUI();
  }

  /**
   * Viewport relative to a square perfectly containing the playing area. The
   * `left` and `top` values are from 0-100. The x and y values in this method
   * are on the same scale, unlike {@link relativeTransformToBoard}.
   * @category UI
   * @internal
   */
  absoluteTransform(preComputedRelativeTransform?: Box): Box {
    preComputedRelativeTransform ??= this.relativeTransformToBoard();
    return this.game._ui.frame ? translate(preComputedRelativeTransform, this.game._ui.frame) : preComputedRelativeTransform;
  }

  /**
   * Viewport relative to the playing area. The `left` and `top` values are
   * percentages from 0-100, where `left: 100` is the right edge of the playing
   * area and `top: 100` the bottom. The x and y values in this method are
   * therefore not necessarily on the same scale, unlike {@link
   * absoluteTransform}.
   * @category UI
   * @internal
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
   * Apply a layout to some of the elements directly contained within this
   * element. See also {@link ElementCollection#layout}
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
   * height from 0-100, unless otherwise noted (See `margin` and `gap`)
   */
  layout(
    applyTo: typeof this._ui.layouts[number]['applyTo'],
    attributes: Partial<LayoutAttributes<this>>
  ) {
    let {slots, area, size, aspectRatio, scaling, gap, margin, offsetColumn, offsetRow} = attributes
    if (this._ui.layouts.length === 0) this.resetUI();
    if (slots && (area || margin || scaling || gap || margin || offsetColumn || offsetRow)) {
      console.warn('Layout has `slots` which overrides supplied grid parameters');
      delete attributes.area;
      delete attributes.margin;
      delete attributes.gap;
      delete attributes.scaling;
      delete attributes.offsetRow;
      delete attributes.offsetColumn;
    }
    if (area && margin) {
      console.warn('Both `area` and `margin` supplied in layout. `margin` is ignored');
      delete attributes.margin;
    }
    if (size && aspectRatio) {
      console.warn('Both `size` and `aspectRatio` supplied in layout. `aspectRatio` is ignored');
      delete attributes.aspectRatio;
    }
    if (size && scaling) {
      console.warn('Both `size` and `scaling` supplied in layout. `scaling` is ignored');
      delete attributes.scaling;
    }
    if (gap && (offsetColumn || offsetRow)) {
      console.warn('Both `gap` and `offset` supplied in layout. `gap` is ignored');
      delete attributes.gap;
    }
    this._ui.layouts.push({ applyTo, attributes: { alignment: 'center', direction: 'square', ...attributes} });
  }

  /**
   * recalc all elements computedStyle
   * @category UI
   * @internal
   */
  applyLayouts() {
    if (this._ui.appearance.render === false) return;

    this._ui.computedStyle ??= { left: 0, top: 0, width: 100, height: 100 };

    const layoutItems = this.getLayoutItems();
    const absoluteTransform = this.absoluteTransform();

    for (let l = this._ui.layouts.length - 1; l >= 0; l--) {
      const { attributes } = this._ui.layouts[l];
      let children = layoutItems[l];

      const { slots, direction, gap, alignment, maxOverlap } = attributes;
      let { size, scaling, aspectRatio, haphazardly } = attributes;
      if (!size && !scaling) scaling = 'fit';

      const area = this.getArea(attributes);

      let cellBoxes = slots || [];
      let sizes: number[] = []; // relative sizes of children so they retain scaling against each other
      let maxSize: number = 0;

      if (!this._ui.computedLayouts) this._ui.computedLayouts = [];
      this._ui.computedLayouts[l] = {
        area,
        children: children ?? [],
        showBoundingBox: attributes.showBoundingBox ?? this.game._ui.boundingBoxes,
        drawer: attributes.drawer
      };

      let minColumns = typeof attributes.columns === 'number' ? attributes.columns : attributes.columns?.min || 1;
      let minRows = typeof attributes.rows === 'number' ? attributes.rows : attributes.rows?.min || 1;

      if (!children?.length && minRows === 1 && minColumns === 1) continue;
      children ??= [];

      if (!slots) {
        const cells: [number?, number?][] = [];
        const min: {column?: number, row?: number} = {};
        const max: {column?: number, row?: number} = {};

        // find bounding box for any set positions
        for (let c = 0; c != children.length; c++) {
          const child = children[c];
          const gridSize = this._sizeNeededFor(child);
          if (child.column !== undefined && child.row !== undefined && !child._ui.ghost) {
            cells[c] = [child.column, child.row];
            if (min.column === undefined || child.column < min.column) min.column = child.column;
            if (min.row === undefined || child.row < min.row) min.row = child.row;
            if (max.column === undefined || child.column + gridSize.width - 1 > max.column) max.column = child.column + gridSize.width - 1;
            if (max.row === undefined || child.row + gridSize.height - 1 > max.row) max.row = child.row + gridSize.height - 1;
          }
        }
        min.column ??= 1;
        min.row ??= 1;
        max.column ??= 1;
        max.row ??= 1;

        // calculate # of rows/cols
        minColumns = Math.max(minColumns, max.column - min.column + 1);
        minRows = Math.max(minRows, max.row - min.row + 1);
        let maxColumns = typeof attributes.columns === 'number' ? attributes.columns : attributes.columns?.max || Infinity;
        let maxRows = typeof attributes.rows === 'number' ? attributes.rows : attributes.rows?.max || Infinity;

        let columns = minColumns;
        let rows = minRows;
        let origin = {column: 1, row: 1};
        const alignOffset = {
          left: alignment.includes('left') ? 0 : (alignment.includes('right') ? 1 : 0.5),
          top: alignment.includes('top') ? 0 : (alignment.includes('bottom') ? 1 : 0.5),
        };

        const ghostPiecesIgnoredForLayout = ('extendableGrid' in this && this.extendableGrid) ? children.filter(c => c._ui.ghost) : [];
        const elements = children.length - ghostPiecesIgnoredForLayout.length;

        // expand grid as needed for children in direction specified
        if (children.length) {
          if (direction === 'square') {
            columns = Math.max(minColumns,
              Math.min(
                maxColumns,
                Math.ceil(elements / minRows),
                Math.max(Math.ceil(elements / maxRows), Math.ceil(Math.sqrt(elements)))
              )
            );
            rows = Math.max(minRows,
              Math.min(maxRows,
                Math.ceil(elements / minColumns),
                Math.ceil(elements / columns)
              )
            );
          } else {
            if (rows * columns < elements) {
              if (['ltr', 'ltr-btt', 'rtl', 'rtl-btt'].includes(direction)) {
                columns = Math.max(columns, Math.min(maxColumns, Math.ceil(elements / rows)));
                rows = Math.max(rows, Math.min(maxRows, Math.ceil(elements / columns)));
              }
              if (['ttb', 'btt', 'ttb-rtl', 'btt-rtl'].includes(direction)) {
                rows = Math.max(rows, Math.min(maxRows, Math.ceil(elements / columns)));
                columns = Math.max(columns, Math.min(maxColumns, Math.ceil(elements / rows)));
              }
            }
          }

          // set origin if viewport should shift
          origin = {
            column: Math.min(min.column, max.column, Math.max(1, max.column - columns + 1)),
            row: Math.min(min.row, max.row, Math.max(1, max.row - rows + 1))
          }

          if (ghostPiecesIgnoredForLayout.length) {
            const extension = Math.max(...ghostPiecesIgnoredForLayout.map(p => Math.max(p._size?.width ?? 1, p._size?.height ?? 1)));
            if (extension > 0) {
              if (children.length === ghostPiecesIgnoredForLayout.length) {
                columns = Math.max(columns, extension);
                rows = Math.max(rows, extension);
              } else {
                if (min.column - extension < origin.column) {
                  columns += extension - min.column + origin.column;
                  origin.column = min.column - extension;
                }
                if (max.column + extension >= origin.column + columns) {
                  columns = max.column + extension - origin.column + 1;
                }
                if (min.row - extension < origin.row) {
                  rows += extension - min.row + origin.row;
                  origin.row = min.row - extension;
                }
                if (max.row + extension >= origin.row + rows) {
                  rows = max.row + extension - origin.row + 1;
                }
              }
            }
          }

          let available: Vector;
          let advance: Vector;
          let carriageReturn: Vector;
          let fillDirection = direction;
          if (fillDirection === 'square') {
            if (['left', 'top left', 'top', 'center'].includes(alignment)) {
              fillDirection = 'ltr';
            } else if (['right', 'top right'].includes(alignment)) {
              fillDirection = 'rtl';
            } else if (['bottom','bottom left'].includes(alignment)) {
              fillDirection = 'ltr-btt';
            } else {
              fillDirection = 'rtl-btt';
            }
          }
          switch (fillDirection) {
          case 'ltr':
            available = {x: 1, y: 1};
            advance = {x: 1, y: 0};
            carriageReturn = {x: -columns, y: 1};
            break;
          case 'rtl':
            available = {x: columns, y: 1};
            advance = {x: -1, y: 0};
            carriageReturn = {x: columns, y: 1};
            break;
          case 'ttb':
            available = {x: 1, y: 1};
            advance = {x: 0, y: 1};
            carriageReturn = {x: 1, y: -rows};
            break;
          case 'btt':
            available = {x: 1, y: rows};
            advance = {x: 0, y: -1};
            carriageReturn = {x: 1, y: rows};
            break;
          case 'ltr-btt':
            available = {x: 1, y: rows};
            advance = {x: 1, y: 0};
            carriageReturn = {x: -columns, y: -1};
            break;
          case 'rtl-btt':
            available = {x: columns, y: rows};
            advance = {x: -1, y: 0};
            carriageReturn = {x: columns, y: -1};
            break;
          case 'ttb-rtl':
            available = {x: columns, y: 1};
            advance = {x: 0, y: 1};
            carriageReturn = {x: -1, y: -rows};
            break;
          case 'btt-rtl':
            available = {x: columns, y: rows};
            advance = {x: 0, y: -1};
            carriageReturn = {x: -1, y: rows};
            break;
          }

          if (ghostPiecesIgnoredForLayout) {
            for (let c = 0; c != children.length; c++) {
              const child = children[c];
              if (child.column !== undefined && child.row !== undefined && child._ui.ghost) cells[c] = [child.column, child.row];
            }
          }

          // place unpositioned elements
          let c = 0;
          while (c != children.length) {
            const child = children[c];
            if (cells[c]) {
              c++;
              continue;
            }
            const cell: [number, number] = [available.x + origin.column! - 1, available.y + origin.row! - 1];
            if (cells.every(([x, y]) => x !== cell[0] || y !== cell[1])) {
              cells[c] = cell;
              if (attributes.sticky) {
                child.column = cell[0];
                child.row = cell[1];
              }
              c++;
            }
            available.x += advance.x;
            available.y += advance.y;
            if (available.x > columns || available.x <= 0 || available.y > rows || available.y <= 0) {
              available.x += carriageReturn.x;
              available.y += carriageReturn.y;
            }
            if (available.x > columns || available.x <= 0 || available.y > rows || available.y <= 0) break;
          }
        }

        // calculate offset or gap
        let cellGap: Vector | undefined = undefined;
        let offsetRow: Vector | undefined = undefined;
        let offsetColumn: Vector | undefined = undefined;
        let effecitveRowsWithOffsets = '_gridPositions' in this && 'rows' in this ? this.rows as number : rows;
        let effecitveColumnsWithOffsets = '_gridPositions' in this && 'columns' in this ? this.columns as number : columns;
        let rhomboid = !('_gridPositions' in this) || !('shape' in this) || this.shape === 'rhomboid';

        if (attributes.offsetColumn || attributes.offsetRow) {
          offsetColumn = typeof attributes.offsetColumn === 'number' ? {x: attributes.offsetColumn, y: 0} : attributes.offsetColumn;
          offsetRow = typeof attributes.offsetRow === 'number' ? {x: 0, y: attributes.offsetRow} : attributes.offsetRow;
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
          size = cellSizeForArea(
            effecitveRowsWithOffsets, effecitveColumnsWithOffsets,
            area, cellGap, offsetColumn, offsetRow, rhomboid
          );

          // find all aspect ratios and sizes of child elements and choose best fit
          if (!aspectRatio) {
            let minRatio = Infinity;
            let maxRatio = 0;
            for (const c of children) {
              const r = c._ui.appearance.aspectRatio;
              if (r !== undefined) {
                if (r < minRatio) minRatio = r;
                if (r > maxRatio) maxRatio = r;
              }
              const largestDimension = c._size ? Math.max(c._size.width, c._size.height) : 1;
              sizes.push(largestDimension);
              if (largestDimension > maxSize) maxSize = largestDimension;
            }
            if (minRatio < Infinity || maxRatio > 0) {
              if (maxRatio > 1 && minRatio < 1) aspectRatio = 1;
              else if (minRatio > 1) aspectRatio = minRatio;
              else aspectRatio = maxRatio;
            }
          }

          if (aspectRatio) {
            aspectRatio *= absoluteTransform.height / absoluteTransform.width;
            if (aspectRatio > size.width / size.height) {
              size.height = size.width / aspectRatio;
            } else {
              size.width = aspectRatio * size.height;
            }
          }
        }

        if (!children.length) {
          this._ui.computedLayouts[l].grid = {
            anchor: { x: 0, y: 0 },
            origin,
            rows,
            columns,
            offsetColumn: offsetColumn ?? { x: size.width + cellGap!.x, y: 0 },
            offsetRow: offsetRow ?? { x: 0, y: size.height + cellGap!.y }
          }
          continue;
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

        const corners = '_cornerPositions' in this ? (this._cornerPositions as () => [number, number][])() : [
          [1, 1],
          [columns, 1],
          [1, rows],
          [columns, rows],
        ] as [number, number][];

        let totalAreaNeeded = getTotalArea(corners, area, size, columns, rows, startingOffset, cellGap, offsetColumn, offsetRow);

        let scale: Vector = {x: 1, y: 1};

        if (scaling) {
          if (scaling === 'fill') {
            // match the dimension furthest, spilling one dimesion out of bounds
            const s = Math.max(area.width / totalAreaNeeded.width, area.height / totalAreaNeeded.height);
            scale = {x: s, y: s};
          } else if (scaling === 'fit' && attributes.size) { // if size was not given, size was already calculated as 'fit'
            // match the closest dimension, pushing one dimesion inside
            const s = Math.min(area.width / totalAreaNeeded.width, area.height / totalAreaNeeded.height);
            scale = {x: s, y: s};
          }

          // reduce scale if necessary to keep size below amount needed for min rows/cols
          const largestCellSize = cellSizeForArea(
            Math.min(minRows, effecitveRowsWithOffsets), Math.min(minColumns, effecitveColumnsWithOffsets),
            area, cellGap, offsetColumn, offsetRow, rhomboid
          );
          if (maxOverlap !== undefined) {
            const largestCellSize2 = cellSizeForArea(rows, columns, area, undefined,
              { x: Math.min(100 - maxOverlap, offsetColumn?.x ?? 100), y: Math.min(100 - maxOverlap, offsetColumn?.y ?? 0) },
              { x: Math.min(100 - maxOverlap, offsetRow?.x ?? 0), y: Math.min(100 - maxOverlap, offsetRow?.y ?? 100) }
            );
            largestCellSize.width = Math.min(largestCellSize.width, largestCellSize2.width);
            largestCellSize.height = Math.min(largestCellSize.height, largestCellSize2.height);
          }

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

          //console.log('pre-scale', largestCellSize, area, size, totalAreaNeeded, alignOffset, scale);

          size.width *= scale.x;
          size.height *= scale.y;
        }

        if (!cellGap) { // non-othogonal grid
          if (scaling !== 'fit') {
            // reduce offset along dimension needed to squish
            if (area.width * scale.x / totalAreaNeeded.width > area.height * scale.y / totalAreaNeeded.height) {
              const offsetScale = (area.height - size.height) / (totalAreaNeeded.height * scale.y - size.height);
              if (offsetScale < 1) {
                scale.y = scale.x = area.height / totalAreaNeeded.height;
                offsetColumn!.y *= offsetScale;
                offsetRow!.y *= offsetScale;
              }
            } else {
              const offsetScale = (area.width - size.width) / (totalAreaNeeded.width * scale.x - size.width);
              if (offsetScale < 1) {
                scale.y = scale.x = area.width / totalAreaNeeded.width;
                offsetColumn!.x *= offsetScale;
                offsetRow!.x *= offsetScale;
              }
            }

            totalAreaNeeded = getTotalArea(corners, area, size, columns, rows, startingOffset, cellGap, offsetColumn, offsetRow);
          }
          // align in reduced area
          startingOffset.x += area.left - totalAreaNeeded.left * scale.x + alignOffset.left * (area.width - totalAreaNeeded.width * scale.x);
          startingOffset.y += area.top - totalAreaNeeded.top * scale.y + alignOffset.top * (area.height - totalAreaNeeded.height * scale.y);
          //console.log('align', area, size, totalAreaNeeded, alignOffset, startingOffset, scale);

        } else { // orthogonal

          if (scaling === 'fill') {
            // reduce gap to squish it to fit, creating overlap
            if (rows > 1) cellGap.y = Math.min(cellGap.y || 0, (area.height - rows * size.height) / (rows - 1));
            if (columns > 1) cellGap.x = Math.min(cellGap.x || 0, (area.width - columns * size.width) / (columns - 1));
          }

          // align in reduced area
          const newWidth = columns * (size.width + cellGap.x!) - cellGap.x!;
          startingOffset.x += alignOffset.left * (area.width - newWidth);
          const newHeight = rows * (size.height + cellGap.y!) - cellGap.y!;
          startingOffset.y += alignOffset.top * (area.height - newHeight);
        }

        //console.log('size, area after fit/fill adj', size, area, scale, cellGap)
        for (let c = 0; c < children.length && c < cells.length; c++) {
          let [column, row] = cells[c];
          if (column !== undefined && row !== undefined) {
            column -= origin.column - 1;
            row -= origin.row - 1;
            const box = cellBoxRC(column, row, area, size!, columns, rows, startingOffset, cellGap, offsetColumn, offsetRow);
            if (box) cellBoxes[c] = box;
          }
        }

        this._ui.computedLayouts[l].grid = {
          anchor: startingOffset,
          origin,
          rows,
          columns,
          offsetColumn: offsetColumn ?? { x: size.width + cellGap!.x, y: 0 },
          offsetRow: offsetRow ?? { x: 0, y: size.height + cellGap!.y }
        }
      }

      // apply the final box to each child
      const prandom = random.create('ge' + this.name).random;
      for (let i = 0; i !== children.length; i++) {
        const box = cellBoxes[i];
        if (!box) continue;
        const child = children[i];
        let { width, height, left, top } = box;
        let transformOrigin: string | undefined = undefined;
        const gridSize = this._sizeNeededFor(child);
        if (gridSize.width !== 1 || gridSize.height !== 1) {
          height *= (child._size!.height ?? 1);
          width *= (child._size!.width ?? 1);
          if (child.rotation === 90) {
            transformOrigin = `${50 * child._size!.height / child._size!.width}% 50%`;
          }
          if (child.rotation === 270) {
            transformOrigin = `50% ${50 * child._size!.width / child._size!.height}%`;
          }
        } else {
          if (child._ui.appearance.aspectRatio || child._size) {
            const aspectRatio = (child._ui.appearance.aspectRatio ?? 1) * (child._size?.width ?? 1) / (child._size?.height ?? 1) * absoluteTransform.height / absoluteTransform.width;

            if (aspectRatio && aspectRatio !== width / height) {
              if (aspectRatio > width / height) {
                height = width / aspectRatio;
              } else {
                width = aspectRatio * height;
              }
            }
            left = box.left + (box.width - width) / 2;
            top = box.top + (box.height - height) / 2;
          }
          if (maxSize && maxSize > 0 && sizes[i] && sizes[i] !== maxSize) {
            const scale = sizes[i]! / maxSize;
            left += width * 0.5 * (1 - scale);
            top += height * 0.5 * (1 - scale);
            height *= scale;
            width *= scale;
          }
        }

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
        if (transformOrigin) child._ui.computedStyle.transformOrigin = transformOrigin;

        child.applyLayouts();
      }
    }
  }

  getLayoutItems() {
    const layoutItems: (GameElement[] | undefined)[] = [];

    const layouts = [...this._ui.layouts].sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (a.applyTo instanceof GameElement) aVal = 3
      if (b.applyTo instanceof GameElement) bVal = 3
      if (typeof a.applyTo === 'string') aVal = 2
      if (typeof b.applyTo === 'string') bVal = 2
      if (a.applyTo instanceof Array) aVal = 1
      if (b.applyTo instanceof Array) bVal = 1
      if (aVal !== 0 || bVal !== 0) return aVal - bVal;
      const ac = a.applyTo as ElementClass;
      const bc = b.applyTo as ElementClass;
      return ac.prototype instanceof bc ? 1 : (bc.prototype instanceof ac ? -1 : 0);
    }).reverse();

    for (const child of this._t.children) {
      if (child._ui.appearance.render === false) continue;
      for (const layout of layouts) {
        const { applyTo, attributes } = layout;
        const l = this._ui.layouts.indexOf(layout);

        if ((typeof applyTo === 'function' && child instanceof applyTo) ||
          (typeof applyTo === 'string' && child.name === applyTo) ||
          child === applyTo ||
          (applyTo instanceof ElementCollection && applyTo.includes(child))
        ) {
          if (attributes.limit !== undefined && attributes.limit <= (layoutItems[l]?.length ?? 0)) break;
          layoutItems[l] ??= [];
          if (this._t.order === 'stacking') {
            layoutItems[l]!.unshift(child);
          } else {
            layoutItems[l]!.push(child);
          }
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
   * Define the appearance of this element. Any values provided override
   * previous ones. See also {@link ElementCollection#appearance}
   * @category UI
   *
   * @param appearance - Possible values are:
   * @param appearance.className - A class name to add to the dom element
   *
   * @param appearance.render - A function that takes this element as its only
   * argument and returns JSX for the element. See {@link ../ui/appearance} for
   * more on usage.
   *
   * @param appearance.aspectRatio - The aspect ratio for this element. This
   * value is a ratio of width over height. All layouts defined in {@link
   * layout} will respect this aspect ratio.
   *
   * @param appearance.info - Return JSX for more info on this element. If
   * returning true, an info modal will be available for this element but with
   * only the rendered element and no text
   *
   * @param appearance.connections - If the elements immediately within this
   * element are connected using {@link Space#connectTo}, this makes those
   * connections visible as connecting lines. Providing a `label` will place a
   * label over top of this line by calling the provided function with the
   * distance of the connection specified in {@link Space#connectTo} and using
   * the retured JSX. If `labelScale` is provided, the label is scaled by this
   * amount.
   *
   * @param appearance.effects - Provides a CSS class that will be applied to
   * this element if its attributes change to match the provided ones.
   */
  appearance(appearance: ElementUI<this>['appearance']) {
    Object.assign(this._ui.appearance, appearance);
  }

  resetMovementTracking() {
    this._t.was = this.branch();
    for (const child of this._t.children) child.resetMovementTracking();
  }

  hasChangedParent() {
    const branch = this.branch();
    if (!this._t.was || this._t.was === branch) return false;
    return this._t.was?.substring(0, this._t.was?.lastIndexOf('/')) !== branch.substring(0, branch.lastIndexOf('/'));
  }
}
