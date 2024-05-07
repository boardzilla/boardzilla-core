import Piece from '../../board/piece.js';

import type Game from '../../board/game.js';

/**
 * Specialized piece for representing 6-sided dice
 *
 * @example
 * import { D6 } from '@boardzilla/core/components';
 * ...
 * game.create(D6, 'my-die');
 * @category Board
 */
export default class D6<G extends Game = Game> extends Piece<G> {
  sides: number = 6;

  /**
   * Currently shown face
   * @category D6
   */
  current: number = 1;
  rollSequence: number = 0;

  /**
   * Randomly choose a new face, causing the roll animation
   * @category D6
   */
  roll() {
    this.current = Math.ceil((this.game.random || Math.random)() * this.sides);
    this.rollSequence = this._ctx.gameManager.sequence;
  }
}
