import Piece from '../../board/piece.js';

import type Game from '../../board/game.js';

/**
 * Specialized piece for represnting 6-sided dice
 * @category Board
 */
export default class D6<G extends Game = Game> extends Piece<G> {
  sides: number = 6;

  /**
   * Currently shown face
   */
  current: number = 1;
  rollSequence: number = 0;

  /**
   * Randomly choose a new face, causing the roll animation
   */
  roll() {
    this.current = Math.ceil((this.game.random || Math.random)() * this.sides);
    this.rollSequence = this._ctx.gameManager.sequence;
  }
}
