import Piece from "./piece.js";

import type Game from './game.js'
import type Player from '../player/player.js';

/**
 * Specialized piece for represnting 6-sided dice
 * @category Board
 */
export default class Die<P extends Player<P, B> = any, B extends Game<P, B> = any> extends Piece<P, B> {
  sides: number = 6;

  /**
   * Currently shown face
   */
  current: number = 1;
  rollSequence: number;

  /**
   * Randomly choose a new face, causing the roll animation
   */
  roll() {
    this.current = Math.ceil((this._ctx.gameManager?.random || Math.random)() * this.sides);
    this.rollSequence = this.gameManager.sequence;
  }
}
