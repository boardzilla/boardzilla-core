import type PlayerCollection from './collection.js';
import { escapeArgument } from '../action/utils.js';

export default class Player {
  name: string;
  color: string;
  position: number; // table position, as opposed to turn order
  settings?: any
  _players: PlayerCollection<Player>;

  isCurrent() {
    return this._players.currentPosition.includes(this.position);
  }

  setCurrent() {
    return this._players.setCurrent(this);
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
    return escapeArgument(this);
  }
}
