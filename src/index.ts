import Game from './game.js';
import { Player } from './player/index.js';
import {
  Board,
  Piece,
  Space,
  Die,
  GameElement,
} from './board/index.js';

export { Board, union } from './board/index.js';

export { Do } from './flow/index.js';

export { createInterface } from './interface.js';
export { times, range, shuffleArray } from './utils.js';
export { Player };
export {
  render,
  ProfileBadge,
  toggleSetting,
  numberSetting,
  textSetting,
  choiceSetting
} from './ui/index.js';

export { TestRunner } from './test-runner.js';

import type { SetupState, GameState } from './interface.js';
import type { ElementClass } from './board/element.js';

/**
 * Returns board classes for game with the correct types for board and player.
 *
 * @example
 * const {Space, Piece, Die} = createBoardClasses<MyGamePlayer, MyGameBoard>();
 * @category Board
 */
export const createBoardClasses = <P extends Player<P, B>, B extends Board<P, B>>() => ({
  GameElement: GameElement<P, B>,
  Space: Space<P, B>,
  Piece: Piece<P, B>,
  Die: Die<P, B>
});

export type SetupFunction<P extends Player<P, B> = any, B extends Board<P, B> = any> = (
  state: SetupState<P> | GameState<P>,
  options?: {trackMovement?: boolean}
) => Game<P, B>

declare global {
  /**
   * Global reference to all unique named spaces
   *
   * @example
   * board.create(Space, 'deck');
   * ...
   * $.deck // =>  equals the Space just created
   */
  var $: Record<string, Space>; // eslint-disable-line no-var
}

/**
 * Create your game
 * @param playerClass - Your player class. This must extend {@link Player}. If
 * you do not need any custom Player attributes or behaviour, simply put {@link
 * Player} here. This becomes the `P` type generic used throughout Boardzilla.

 * @param boardClass - Your board class. This must extend {@link Board}. If you
 * do not need any custom Board attributes or behaviour, simply put {@link
 * Board} here. This becomes the `B` type generic used throughout Boardzilla.

 * @param options.setup - A function that sets up the game. This function
 * accepts a single argument which is the instance of {@link Game} for this game. The
 * function should create all the spaces and pieces you need before your game can
 * start and will typically call:
 * - {@link board#registerClasses} to add custom classes for Spaces and Pieces
 * - {@link board#defineActions} to create the game actions
 * - {@link board#defineFlow} to define the game's flow
 * @category Core
 */
export const createGame = <P extends Player<P, B>, B extends Board<P, B>>(
  playerClass: {new(...a: any[]): P},
  boardClass: ElementClass<B>,
  gameCreator: (game: Game<P, B>) => void
): SetupFunction<P, B> => (
  state: SetupState<P> | GameState<P>,
  options?: {trackMovement?: boolean}
): Game<P, B> => {
  //console.time('setup');
  const game = new Game<P, B>(playerClass, boardClass);
  const inSetup = !('board' in state);

  globalThis.$ = game.board._ctx.namedSpaces;

  game.setRandomSeed(state.rseed);
  game.setSettings(state.settings);
  game.players.fromJSON(state.players);

  // setup board to get all non-serialized setup (spaces, event handlers, graphs)
  gameCreator(game);
  //console.timeLog('setup', 'game creator setup');

  // lock game from receiving any more setup
  game.start();

  if (!inSetup) {
    if (options?.trackMovement) game.trackMovement();
    game.sequence = state.sequence;
    game.messages = state.messages;
    game.announcements = state.announcements;
    game.board.fromJSON(state.board);
    game.flow.setBranchFromJSON(state.position);
  }
  //console.timeLog('setup', 'setState');

  //console.timeEnd('setup');
  return game;
};
