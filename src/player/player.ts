import { GameElement } from '../board/index.js';

import type PlayerCollection from './collection.js';
import type { Board } from '../board/index.js';
import type { ElementClass } from '../board/element.js';
import type { ElementFinder, default as ElementCollection } from '../board/element-collection.js';
import type Game from '../game.js';

export default class Player<P extends Player<P, B> = any, B extends Board<P, B> = any> {
  name: string;
  color: string;
  avatar: string;
  host: boolean;
  position: number; // table position, as opposed to turn order
  settings?: any;
  board: B
  game: Game<P, B>
  _players: PlayerCollection<P>;

  isCurrent(this: P) {
    return this._players.currentPosition.includes(this.position);
  }

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

  allMy<F extends GameElement<P, B>>(this: P, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  allMy(this: P, className: ElementFinder<GameElement<P, B>>, ...finders: ElementFinder<GameElement<P, B>>[]): ElementCollection<GameElement<P, B>>;
  allMy<F extends GameElement<P, B>>(this: P, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement<P, B>> {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this.board.all({owner: this}, className, ...finders);
    }

    return this.board.all<GameElement<P, B>>(className, {owner: this}, ...finders);
  }

  my<F extends GameElement<P, B>>(this: P, className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  my(this: P, className: ElementFinder<GameElement<P, B>>, ...finders: ElementFinder<GameElement<P, B>>[]): GameElement<P, B> | undefined;
  my<F extends GameElement<P, B>>(this: P, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement<P, B> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this.board.first({owner: this}, className, ...finders);
    }

    return this.board.first<GameElement>(className, {owner: this}, ...finders);
  }

  has<F extends GameElement<P, B>>(this: P, className: ElementClass<F>, ...finders: ElementFinder<F>[]): boolean;
  has(this: P, className: ElementFinder<GameElement<P, B>>, ...finders: ElementFinder<GameElement<P, B>>[]): boolean;
  has<F extends GameElement<P, B>>(this: P, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | boolean {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return !!this.board.all({player: this}).first(className, ...finders);
    }

    return !!this.board.all(GameElement<P, B>, {player: this}).first(className, ...finders);
  }

  toJSON() {
    let {_players, board: _b, game: _g, ...attrs}: Record<any, any> = this;

    // remove methods
    attrs = Object.fromEntries(Object.entries(attrs).filter(
      ([, value]) => typeof value !== 'function'
    ));

    return attrs;
  }

  toString() {
    return this.name;
  }
}
