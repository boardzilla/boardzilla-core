import Piece from "./piece.js";

import type Board from './board.js'
import type Player from '../player/player.js';

export default class Die<P extends Player<P, B> = any, B extends Board<P, B> = any> extends Piece<P, B> {
  sides: number = 6;
  current: number = 1;
  flip = false;

  roll() {
    this.current = Math.ceil((this._ctx.game?.random || Math.random)() * this.sides);
    this.flip = !this.flip;
  }
}
