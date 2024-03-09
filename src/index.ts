import GameManager from './game-manager.js';
import { Player } from './player/index.js';
import {
  Game,
  Piece,
  Space,
  Die,
  GameElement,
} from './board/index.js';

export { Game, union } from './board/index.js';
export { Space, Piece, Die, GameElement };

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
import type Action from './action/action.js';

export type { GameManager, Action, ElementClass };

/**
 * Returns game classes with the correct types for game and player.
 *
 * @example
 * const {Space, Piece, Die} = createGameClasses<MyGamePlayer, MyGame>();
 * @category Board
 */
// export const createGameClasses = <P extends Player<P, B>, B extends Game<P, B>>() => ({
//   GameElement: GameElement<P, B>,
//   Space: Space<P, B>,
//   Piece: Piece<P, B>,
//   Die: Die<P, B>
// });

export type SetupFunction<B extends Game = Game> = (
  state: SetupState | GameState,
  options?: {trackMovement?: boolean}
) => GameManager<B>

export const colors = [
  '#d50000', '#00695c', '#304ffe', '#ff6f00', '#7c4dff',
  '#ffa825', '#f2d330', '#43a047', '#004d40', '#795a4f',
  '#00838f', '#408074', '#448aff', '#1a237e', '#ff4081',
  '#bf360c', '#4a148c', '#aa00ff', '#455a64', '#600020'
];

declare global {
  /**
   * Global reference to all unique named spaces
   *
   * @example
   * game.create(Space, 'deck');
   * ...
   * $.deck // =>  equals the Space just created
   */
  var $: Record<string, Space<Game>>; // eslint-disable-line no-var
}

/**
 * Create your game
 * @param playerClass - Your player class. This must extend {@link Player}. If
 * you do not need any custom Player attributes or behaviour, simply put {@link
 * Player} here. This becomes the `P` type generic used throughout Boardzilla.

 * @param gameClass - Your game class. This must extend {@link Game}. If you
 * do not need any custom Game attributes or behaviour, simply put {@link
 * Game} here. This becomes the `B` type generic used throughout Boardzilla.

 * @param options.setup - A function that sets up the game. This function
 * accepts a single argument which is the instance of {@link Game} for this game. The
 * function should create all the spaces and pieces you need before your game can
 * start and will typically call:
 * - {@link game#registerClasses} to add custom classes for Spaces and Pieces
 * - {@link game#defineActions} to create the game actions
 * - {@link game#defineFlow} to define the game's flow
 * @category Core
 */
export const createGame = <G extends Game>(
  playerClass: {new(...a: any[]): Player},
  gameClass: ElementClass<G>,
  gameCreator: (game: G) => void
): SetupFunction<G> => (
  state: SetupState | GameState,
  options?: {trackMovement?: boolean}
): GameManager<G> => {
  //console.time('setup');
  const gameManager = new GameManager(playerClass, gameClass);
  const inSetup = !('board' in state);

  globalThis.$ = gameManager.game._ctx.namedSpaces;

  gameManager.setRandomSeed(state.rseed);
  gameManager.setSettings(state.settings);
  gameManager.players.fromJSON(state.players);

  // setup board to get all non-serialized setup (spaces, event handlers, graphs)
  gameCreator(gameManager.game);
  //console.timeLog('setup', 'game creator setup');

  // lock game from receiving any more setup
  gameManager.start();

  if (options?.trackMovement) gameManager.trackMovement();
  if (!inSetup) {
    gameManager.sequence = state.sequence;
    gameManager.messages = state.messages;
    gameManager.announcements = state.announcements;
    gameManager.game.fromJSON(state.board);
    gameManager.players.assignAttributesFromJSON(state.players);
    gameManager.flow.setBranchFromJSON(state.position);
  } else {
    gameManager.players.assignAttributesFromJSON(state.players);
  }
  //console.timeLog('setup', 'setState');

  //console.timeEnd('setup');
  return gameManager;
};
