import Player from './player';

import { shuffleArray } from '../utils';

import type { Game, Board } from '..';
import type {
  PlayerAttributes
} from './types';

export default class PlayerCollection<T extends Player> extends Array<T> {
  currentPosition?: number;
  className: {new(...a: any[]): T};
  game: Game<T, Board>

  addPlayer(attrs: PlayerAttributes<T> | PlayerAttributes<Player>) {
    const player = new this.className(attrs);
    Object.assign(player, attrs);
    this.push(player);
  }

  atPosition(position: number) {
    return this.find(p => p.position === position);
  }

  current(): T {
    if (this.currentPosition === undefined) throw Error("Calling players.current() when not taking turns");
    return this.atPosition(this.currentPosition)!;
  }

  notCurrent() {
    return this.filter(p => p.position !== this.currentPosition);
  }

  inPositionOrder() {
    return this.sort((p1, p2) => (p1.position > p2.position ? 1 : -1));
  }

  setCurrent(player: number | T) {
    if (typeof player !== 'number') player = player.position;
    if (player > this.length || player < 1) {
      throw Error(`No such player ${player}`);
    }
    this.currentPosition = player;
    return this.current();
  }

  next() {
    if (this.currentPosition === undefined) {
      this.currentPosition = this[0].position;
    } else {
      this.currentPosition = this.after(this.currentPosition).position;
    }
    return this.current()!
  }

  after(player: number | T) {
    return this[this.turnOrderOf(player) % this.length];
  }

  // Turn order of player, starting with 1. Note that this is not the same as player position and can change
  turnOrderOf(player: number | T) {
    if (typeof player !== 'number') player = player.position;
    const index = this.findIndex(p => p.position === player);
    if (index === -1) throw Error("No such player");
    return index + 1;
  }

  sortBy(key: keyof T, direction?: "asc" | "desc") {
    const [up, down] = direction === 'desc' ? [-1, 1] : [1, -1];
    return this.sort((a: any, b: any) => a[key] < b[key] ? down : (a[key] > b[key] ? up : 0));
  }

  sortedBy(key: keyof T, direction?: "asc" | "desc") {
    return (this.slice(0, this.length) as this).sortBy(key, direction);
  }

  shuffle() {
    shuffleArray(this, this.game?.random || Math.random);
  }

  withHighest(key: keyof T) {
    return this.sortedBy(key)[0]
  }

  withLowest(key: keyof T) {
    return this.sortedBy(key, 'desc')[0]
  }

  max<K extends keyof T>(key: K): T[K] {
    return this.sortedBy(key, 'desc')[0][key];
  }

  min<K extends keyof T>(key: K): T[K] {
    return this.sortedBy(key)[0][key];
  }

  sum(key: ((...a: any[]) => number) | (keyof {[K in keyof T]: T[K] extends number ? never: K})) {
    return this.reduce((sum, n) => sum + (typeof key === 'function' ? key(n) : n[key] as unknown as number), 0);
  }

  fromJSON(players: (PlayerAttributes<T> | PlayerAttributes<Player>)[]) {
    // reset all on self
    this.splice(0, this.length);
    this.currentPosition = undefined;

    for (const p of players) {
      this.addPlayer(p);
    }
  }
}
