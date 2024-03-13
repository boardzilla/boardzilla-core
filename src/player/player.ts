import { serializeObject } from '../action/utils.js';

import type PlayerCollection from './collection.js';
import type GameElement from '../board/element.js';
import type { BaseGame } from '../board/game.js';
import type { ElementClass } from '../board/element.js';
import type { ElementFinder, default as ElementCollection } from '../board/element-collection.js';

export interface BasePlayer {
  id: string;
  name: string;
  color: string;
  avatar: string;
  host: boolean;
  position: number;
  settings?: any;
  game: BaseGame;
  _players: PlayerCollection<BasePlayer>;
  isCurrent(): boolean
  setCurrent(): void
  others(): BasePlayer[]
  other(): BasePlayer
  allMy(className?: any, ...finders: ElementFinder[]): ElementCollection
  my(className?: any, ...finders: ElementFinder[]): GameElement | undefined
  has(className?: any, ...finders: ElementFinder[]): boolean
  toJSON(): any
  toString(): string
}

/**
 * Base player class. Each game must declare a single player class that extends
 * this to be used for players joining the game. Additional properties and
 * methods on this class will be available in game, when e.g. a player argument
 * is passed to an action for the player taking that action.
 * @category Core
 */
export default class Player<B extends BaseGame = BaseGame, P extends BasePlayer = BasePlayer> implements BasePlayer {
  /**
   * A player's unique user id
   */
  id: string;

  /**
   * A player's chosen name
   */
  name: string;

  /**
   * String hex code of the player's chosen color
   */
  color: string;

  /**
   * String URL of the avatar image for this player
   */
  avatar: string;

  /**
   * Whether this player is the gane's host
   */
  host: boolean;

  /**
   * A player's seating position at the table. This is distinct from turn order,
   * which is the order of `game.players`. Turn order can be altered during a
   * game, whereas `position` cannot.
   */
  position: number;
  settings?: any;
  game: B;
  _players: PlayerCollection<P>;

  static isPlayer = true;

  isCurrent() {
    return this._players.currentPosition.includes(this.position);
  }

  /**
   * Set this player as the current player
   */
  setCurrent(this: P) {
    return this._players.setCurrent(this);
  }

  /**
   * Returns an array of all other players.
   */
  others(): P[] {
    return Array.from(this._players).filter(p => p as Player !== this);
  }

  /**
   * Returns the other player. Only allowed in 2 player games
   */
  other(): P {
    if (this._players.length !== 2) throw Error('Can only use `other` for 2 player games');
    return this._players.find(p => p as Player !== this)!;
  }

  /**
   * Finds all elements of a given type that are owned by this player. This is
   * equivalent to calling `game.all(...)` with `{owner: this}` as one of the
   * search terms. Also see {@link GameElement#owner}.
   */
  allMy<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  allMy(className?: ElementFinder, ...finders: ElementFinder[]): ElementCollection;
  allMy(className?: any, ...finders: ElementFinder[]) {
    return this.game.all(className, {owner: this}, ...finders);
  }

  /**
   * Finds the first element of a given type that is owned by this player. This
   * is equivalent to calling `game.first(...)` with `{owner: this}` as one of
   * the search terms. Also see {@link GameElement#owner}.
   */
  my<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  my(className?: ElementFinder, ...finders: ElementFinder[]): GameElement | undefined;
  my(className?: any, ...finders: ElementFinder[]) {
    return this.game.first(className, {owner: this}, ...finders);
  }

  /**
   * Returns true if any element of a given type is owned by this player. This
   * is equivalent to calling `game.has(...)` with `{owner: this}` as one of
   * the search terms. Also see {@link GameElement#owner}.
   */
  has<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): boolean;
  has(className?: ElementFinder, ...finders: ElementFinder[]): boolean;
  has(className?: any, ...finders: ElementFinder[]): boolean {
    return this.game.has(className, {owner: this}, ...finders);
  }

  toJSON() {
    let {_players, game: _b, ...attrs}: Record<any, any> = this;

    // remove methods
    attrs = serializeObject(
      Object.fromEntries(Object.entries(attrs).filter(
        ([, value]) => typeof value !== 'function'
      ))
    );

    if (globalThis.window) { // guard-rail in dev
      try {
        structuredClone(attrs);
      } catch (e) {
        console.error(`invalid properties on player ${this}:\n${JSON.stringify(attrs, undefined, 2)}`);
        throw(e);
      }
    }
    return attrs;
  }

  toString() {
    return this.name;
  }
}
