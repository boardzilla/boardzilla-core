import { GameElement } from '../board/index.js';
import { serializeObject } from '../action/utils.js';

import type PlayerCollection from './collection.js';
import type { Board } from '../board/index.js';
import type { ElementClass } from '../board/element.js';
import type { ElementFinder, default as ElementCollection } from '../board/element-collection.js';
import type Game from '../game.js';

/**
 * Base player class. Each game must declare a single player class that extends
 * this to be used for players joining the game. Additional properties and
 * methods on this class will be available in game, when e.g. a player argument
 * is passed to an action for the player taking that action.
 * @category Core
 */
export default class Player<P extends Player<P, B> = any, B extends Board<P, B> = any> {
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
  board: B
  game: Game<P, B>
  _players: PlayerCollection<P>;

  isCurrent(this: P) {
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
  others(this: P) {
    return Array.from(this._players).filter(p => p !== this) as P[];
  }

  /**
   * Returns the other player. Only allowed in 2 player games
   */
  other(this: P) {
    if (this._players.length !== 2) throw Error('Can only use `other` for 2 player games');
    return this._players.find(p => p !== this)!;
  }

  /**
   * Finds all elements of a given type that are owned by this player. This is
   * equivalent to calling `board.all(...)` with `{owner: this}` as one of the
   * search terms. Also see {@link GameElement#owner}.
   */
  allMy<F extends GameElement<P, B>>(this: P, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  allMy(this: P, className?: ElementFinder<GameElement<P, B>>, ...finders: ElementFinder<GameElement<P, B>>[]): ElementCollection<GameElement<P, B>>;
  allMy<F extends GameElement<P, B>>(this: P, className?: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement<P, B>> {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      if (className) finders = [className, ...finders];
      return this.board.all({owner: this}, ...finders);
    }

    return this.board.all<GameElement<P, B>>(className, {owner: this}, ...finders);
  }

  /**
   * Finds the first element of a given type that is owned by this player. This
   * is equivalent to calling `board.first(...)` with `{owner: this}` as one of
   * the search terms. Also see {@link GameElement#owner}.
   */
  my<F extends GameElement<P, B>>(this: P, className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  my(this: P, className?: ElementFinder<GameElement<P, B>>, ...finders: ElementFinder<GameElement<P, B>>[]): GameElement<P, B> | undefined;
  my<F extends GameElement<P, B>>(this: P, className?: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement<P, B> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      if (className) finders = [className, ...finders];
      return this.board.first({owner: this}, ...finders);
    }

    return this.board.first<GameElement>(className, {owner: this}, ...finders);
  }

  /**
   * Returns true if any element of a given type is owned by this player. This
   * is equivalent to calling `board.has(...)` with `{owner: this}` as one of
   * the search terms. Also see {@link GameElement#owner}.
   */
  has<F extends GameElement<P, B>>(this: P, className: ElementClass<F>, ...finders: ElementFinder<F>[]): boolean;
  has(this: P, className?: ElementFinder<GameElement<P, B>>, ...finders: ElementFinder<GameElement<P, B>>[]): boolean;
  has<F extends GameElement<P, B>>(this: P, className?: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): boolean {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      if (className) finders = [className, ...finders];
      return this.board.has<GameElement<P, B>>(GameElement, {owner: this}, ...finders);
    }

    return this.board.has<GameElement<P, B>>(className, {owner: this}, ...finders);
  }

  toJSON() {
    let {_players, board: _b, game: _g, ...attrs}: Record<any, any> = this;

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
