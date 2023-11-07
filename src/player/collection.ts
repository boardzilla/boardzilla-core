import Player from './player.js';

import { shuffleArray } from '../utils.js';

import type { default as Game, PlayerAttributes } from '../game.js';
import type { Board } from '../board/index.js';

type Sorter<T> = keyof {[K in keyof T]: T[K] extends number | string ? never: K} | ((e: T) => number | string)

export default class PlayerCollection<P extends Player> extends Array<P> {
  currentPosition: number[];
  className: {new(...a: any[]): P};
  game: Game<P, Board<P>>

  addPlayer(attrs: PlayerAttributes<P>) {
    const player = new this.className(attrs);
    Object.assign(player, attrs, {_players: this});
    this.push(player);
  }

  atPosition(position: number) {
    return this.find(p => p.position === position);
  }

  current(): P[] {
    return this.currentPosition.map(p => this.atPosition(p)!);
  }

  notCurrent() {
    return this.filter(p => !this.currentPosition.includes(p.position));
  }

  inPositionOrder() {
    return this.sort((p1, p2) => (p1.position > p2.position ? 1 : -1));
  }

  setCurrent(players: number | P | number[] | P[]) {
    if (!(players instanceof Array)) players = [players] as number[] | P[];
    players = players.map(p => typeof p === 'number' ? p : p.position) as number[];
    this.currentPosition = players;
    return this.current();
  }

  next() {
    if (this.currentPosition.length === 0) {
      this.currentPosition = [this[0].position];
    } else if (this.currentPosition.length === 1) {
      this.currentPosition = [this.after(this.currentPosition[0]).position];
    }
    return this.current()!
  }

  after(player: number | P) {
    return this[this.turnOrderOf(player) % this.length];
  }

  // Turn order of player, starting with 1. Note that this is not the same as player position and can change
  turnOrderOf(player: number | P) {
    if (typeof player !== 'number') player = player.position;
    const index = this.findIndex(p => p.position === player);
    if (index === -1) throw Error("No such player");
    return index + 1;
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