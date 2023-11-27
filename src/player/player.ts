import type PlayerCollection from './collection.js';
import { humanizeArg } from '../action/utils.js';

export default class Player {
  name: string;
  color: string;
  avatar: string;
  host: boolean;
  position: number; // table position, as opposed to turn order
  settings?: any
  _players: PlayerCollection<Player>;

  isCurrent() {
    return this._players.currentPosition.includes(this.position);
  }

  setCurrent() {
    return this._players.setCurrent(this);
  }

  /**
   * Returns an array of all other players.
   */
  others<P extends Player>(this: P) {
    return Array.from(this._players).filter(p => p !== this) as P[];
  }

  toJSON() {
    let {_players, ...attrs}: Record<any, any> = this;

    // remove methods
    attrs = Object.fromEntries(Object.entries(attrs).filter(
      ([, value]) => typeof value !== 'function'
    ));

    return attrs;
  }

  toString() {
    return humanizeArg(this);
  }
}
