import GameManager from './game-manager.js';

import type { Game } from './board/index.js';
import type { SetupState, GameState } from './interface.js';
import type { Player } from './player/index.js';
import type { ElementClass } from './board/element.js';

export type SetupFunction<G extends Game = Game> = (
  state: SetupState | GameState,
  options?: {rseed?: string, trackMovement?: boolean, mocks?: (game: G) => void}
) => GameManager<G>

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
  options?: {rseed?: string, trackMovement?: boolean, mocks?: (game: G) => void}
): GameManager<G> => {
  const gameManager = new GameManager(playerClass, gameClass);
  const inSetup = !('board' in state);

  globalThis.$ = gameManager.game._ctx.namedSpaces;

  if (options?.rseed) gameManager.setRandomSeed(options.rseed);
  gameManager.setSettings(state.settings);
  gameManager.players.fromJSON(state.players);

  // setup board to get all non-serialized setup (spaces, event handlers, graphs)
  gameCreator(gameManager.game);
  if (options?.mocks) options.mocks(gameManager.game);

  if (options?.trackMovement) gameManager.trackMovement();
  if (!inSetup) {
    gameManager.sequence = state.sequence;
    gameManager.messages = state.messages;
    gameManager.announcements = state.announcements;
    gameManager.game.fromJSON(state.board);
    gameManager.players.assignAttributesFromJSON(state.players);
    gameManager.setFlowFromJSON(state.position);
  } else {
    gameManager.start();
    gameManager.players.assignAttributesFromJSON(state.players);
  }

  return gameManager;
};
