import GameManager from './game-manager.js';
export { Game, union } from './board/index.js';
import { Player } from './player/index.js';

import {
  Game,
  Piece,
  Space,
  ConnectedSpaceMap,
  AdjacencySpace,
  FixedGrid,
  SquareGrid,
  HexGrid,
  PieceGrid,
  Die,
  GameElement,
} from './board/index.js';

export {
  Space,
  Piece,
  ConnectedSpaceMap,
  AdjacencySpace,
  FixedGrid,
  SquareGrid,
  HexGrid,
  PieceGrid,
  Die,
  GameElement
};

export { Do } from './flow/index.js';

export { createInterface, colors } from './interface.js';
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

export type SetupFunction<B extends Game = Game> = (
  state: SetupState | GameState,
  options?: {rseed?: string, trackMovement?: boolean}
) => GameManager<B>

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
  options?: {rseed?: string, trackMovement?: boolean}
): GameManager<G> => {
  //console.time('setup');
  const gameManager = new GameManager(playerClass, gameClass);
  const inSetup = !('board' in state);

  globalThis.$ = gameManager.game._ctx.namedSpaces;

  if (options?.rseed) gameManager.setRandomSeed(options.rseed);
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
