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

export {
  playerActions,
  loop,
  whileLoop,
  forLoop,
  forEach,
  switchCase,
  ifElse,
  eachPlayer,
  everyPlayer,
  Do
} from './flow/index.js';

export { createInteface } from './interface.js';
export { times, range, shuffleArray } from './utils.js';
export { Player };
export { render } from './ui/index.js';
export {
  toggleSetting,
  numberSetting,
  textSetting,
  choiceSetting
} from './ui/setup/components/settingComponents.js';
export {
  PlayerMat,
} from './ui/game/components/PlayerMat.js';

// starter function to create a new game instance
// this is called from UI on first update and server on each call

import type { SetupState, GameState } from './interface.js';
import type { ElementClass } from './board/element.js';

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
  var $: Record<string, Space>; // eslint-disable-line no-var
}

/**
 * Create your game
 * @param {Object} options - All the options needed to define your game are listed below.
 * @param options.playerClass - Your player class. This must extend {@link Player}. If you do not need any custom Player attributes or behaviour, simply put {@link Player} here. This becomes the `P` type generic used throughout boardzilla.
 * @param options.boardClass - Your board class. This must extend {@link Board}. If you do not need any custom Board attributes or behaviour, simply put {@link Board} here. This becomes the `B` type generic used here.
 * @param options.elementClasses - An array of all other board classes you declare that will be used in your board. These all must extend {@link Space} or {@link Piece}.
 * @param options.setup - A function that sets up the game. This function accepts a single argument which is an instance of the `boardClass` above. The function should add all the spaces and pieces you need before your game can start.
 * @param options.flow - A function that defines your game's flow. This function accepts a single argument which is an instance of the `boardClass` above. The function should return the result of one of the flow functions:
   - {@link whileLoop}
   - {@link forEach}
   - {@link forLoop}
   - {@link eachPlayer}
   - {@link ifElse}
   - {@link switchCase}
   - {@link playerActions}
   - or an array containing more than one of the above
 * @param options.actions - A function that provides an object defining all the actions in your game. The function accepts 3 arguments:
   - an instance of the `boardClass` above
   - the {@link action} function used to define each action.
   - the player taking the action, an instance of `playerClass` above
 Each key is a unique action name and the value is the result of calling {@link action}.
 * @param options.breakpoints - A function that determines which layout breakpoint to use. The function accepts the aspect ratio of the current player's viewable area and returns the name of the breakpoint.
 * @param options.layout - A function that defines all the layout rules for your game. See {@link GameElement#layout}, {@link GameElement#appearance} and {@link Board#layoutStep}. Function accepts two arguments:
    - an instance of the `boardClass` above
    - the breakpoint string from your `breakpoints` function, or '_default' if none specified.
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
  let rseed = '';
  if (state && 'rseed' in state) {
    rseed = state.rseed;
  } else {
    if (globalThis.window?.sessionStorage) { // web context, use a fixed seed for dev
      rseed = sessionStorage.getItem('rseed') as string;
      if (!rseed) {
        rseed = String(Math.random());
        sessionStorage.setItem('rseed', rseed);
      }
    } else {
      rseed = String(Math.random());
    }
  }
  globalThis.$ = game.board._ctx.namedSpaces;
  game.setRandomSeed('sequence' in state ? String(state.sequence) + '-' + rseed : rseed);
  game.setSettings(state.settings);
  game.players.fromJSON(state.players);

  // setup board to get all non-serialized setup (spaces, event handlers, graphs)
  gameCreator(game);
  //console.timeLog('setup', 'game creator setup');

  // lock game from receiving any more setup
  game.start();

  if ('board' in state) {
    if (options?.trackMovement) game.trackMovement();
    game.sequence = state.sequence;
    game.board.fromJSON(state.board);
    game.flow.setBranchFromJSON(state.position);
  }
  //console.timeLog('setup', 'setState');

  //console.timeEnd('setup');
  return game;
};
