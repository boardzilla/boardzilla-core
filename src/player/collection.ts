import Player from './player.js';

import { shuffleArray } from '../utils.js';

import type { default as Game, PlayerAttributes } from '../game.js';
import type { Board } from '../board/index.js';

type Sorter<T> = keyof {[K in keyof T]: T[K] extends number | string ? never: K} | ((e: T) => number | string)

/**
 * An Array-like collection of the game's players, mainly used in {@link
 * board#players}. The array is automatically created when the game begins and
 * can be used to determine or alter play order. The order of the array is the
 * order of play, i.e. board.players[1] takes their turn right after
 * board.players[0].
 */
export default class PlayerCollection<P extends Player> extends Array<P> {
  /**
   * An array of table positions that may currently act.
   */
  currentPosition: number[];
  className: {new(...a: any[]): P};
  game: Game<P, Board<P>>

  addPlayer(attrs: PlayerAttributes<P>) {
    const player = new this.className(attrs);
    Object.assign(player, attrs, {_players: this});
    this.push(player);
    if (this.game) {
      player.game = this.game;
      player.board = this.game.board;
    }
  }

  /**
   * Returns the player at a given table position.
   */
  atPosition(position: number) {
    return this.find(p => p.position === position);
  }

  /**
   * Returns the player that may currently act. It is an error to call current
   * when multiple players can act
   */
  current(): P | undefined {
    if (this.currentPosition.length > 1) throw Error(`Using players.current when ${this.currentPosition.length} players may act`);
    return this.atPosition(this.currentPosition[0] ?? -1);
  }

  /**
   * Returns the array of all players that may currently act.
   */
  allCurrent(): P[] {
    return this.currentPosition.map(p => this.atPosition(p)!);
  }

  /**
   * Returns the host player
   */
  host(): P {
    return this.find(p => p.host)!;
  }

  /**
   * Returns the array of players that may not currently act.
   */
  notCurrent() {
    return this.filter(p => !this.currentPosition.includes(p.position));
  }

  /**
   * Returns the array of players in the order of table positions. Does not
   * alter the actual player order.
   */
  inPositionOrder() {
    return this.sort((p1, p2) => (p1.position > p2.position ? 1 : -1));
  }

  /**
   * Set the current player(s).
   *
   * @param players - The {@link Player} or table position of the player to act,
   * or an array of either.
   */
  setCurrent(players: number | P | number[] | P[]) {
    if (!(players instanceof Array)) players = [players] as number[] | P[];
    players = players.map(p => typeof p === 'number' ? p : p.position) as number[];
    this.currentPosition = players;
  }

  /**
   * Advance the current player to act to the next player based on player order.
   */
  next() {
    if (this.currentPosition.length === 0) {
      this.currentPosition = [this[0].position];
    } else if (this.currentPosition.length === 1) {
      this.currentPosition = [this.after(this.currentPosition[0]).position];
    }
    return this.current()!
  }

  /**
   * Return the next player to act based on player order.
   */
  after(player: number | P) {
    return this[(this.turnOrderOf(player) + 1) % this.length];
  }

  /**
   * Return the player next to this player at the table.
   * @param step - 1 = one step to the left, -1 = one step to the right, etc
   */
  seatedNext(player: P, steps = 1) {
    return this.atPosition((player.position + steps) % this.length + 1)!;
  }

  /**
   * Returns the turn order of the given player, starting with 0. This is
   * distinct from {@link Player#position}. Turn order can be altered during a
   * game, whereas table position cannot.
   */
  turnOrderOf(player: number | P) {
    if (typeof player !== 'number') player = player.position;
    const index = this.findIndex(p => p.position === player);
    if (index === -1) throw Error("No such player");
    return index;
  }

  sortBy(key: Sorter<P> | (Sorter<P>)[], direction?: "asc" | "desc") {
    const rank = (p: P, k: Sorter<P>) => typeof k === 'function' ? k(p) : p[k]
    const [up, down] = direction === 'desc' ? [-1, 1] : [1, -1];
    return this.sort((a, b) => {
      const keys = key instanceof Array ? key : [key];
      for (const k of keys) {
        const r1 = rank(a, k);
        const r2 = rank(b, k);
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
  sortedBy(key: Sorter<P> | (Sorter<P>)[], direction: "asc" | "desc" = "asc") {
    return (this.slice(0, this.length) as this).sortBy(key, direction);
  }

  sum(key: ((e: P) => number) | (keyof {[K in keyof P]: P[K] extends number ? never: K})) {
    return this.reduce((sum, n) => sum + (typeof key === 'function' ? key(n) : n[key] as unknown as number), 0);
  }

  withHighest(...attributes: Sorter<P>[]) {
    return this.sortedBy(attributes, 'desc')[0];
  }

  withLowest(...attributes: Sorter<P>[]) {
    return this.sortedBy(attributes, 'asc')[0];
  }

  shuffle() {
    shuffleArray(this, this.game?.random || Math.random);
  }

  max<K extends keyof P>(key: K): P[K] {
    return this.sortedBy(key, 'desc')[0][key];
  }

  min<K extends keyof P>(key: K): P[K] {
    return this.sortedBy(key, 'asc')[0][key];
  }

  fromJSON(players: (PlayerAttributes<P>)[]) {
    // reset all on self
    this.splice(0, this.length);

    for (const p of players) {
      this.addPlayer(p);
    }
  }
}
