import Game from './game';
import { Player } from './player';
import { Board, Piece, Space, GameElement } from './board';

import {
  Action,
  action,
} from './action/';

export {
  Board, // remove - just for docs
  Space, // remove - just for docs
  Piece, // remove - just for docs
  GameElement,
  union,
} from './board/';

export {
  playerActions,
  whileLoop,
  forLoop,
  forEach,
  switchCase,
  ifElse,
  eachPlayer,
  repeat,
  skip
} from './flow/';

export {
  isA,
  times,
} from './utils';

export { Player };

export { Action, action }; // remove - just for docs

// starter function to create a new game instance
// this is called from UI on first update and server on each call

import type { SetupState, GameState } from '../types';
import type { SetupFunction } from './types';
import type { ElementClass } from './board/types';
import type { PlayerAttributes } from './player/types';
import type { Argument } from './action/types';
import type { Flow } from './flow';

export const boardClasses = <P extends Player>(_: {new(...a: any[]): P}) => ({
  Board: Board<P>,
  Space: Space<P>,
  Piece: Piece<P>,
});

/**
 * Create your game
 * @param {Object} options - These are all the game options
 * @param options.playerClass - Your player class. This must extend {@link Player}.
 * @param options.boardClass - Your board class. This must extend {@link Board}
 * @param options.elementClasses - All other classes you declare that will be used in your board. These will all ultimately extend {@link Space} or {@link Piece}
 * @param options.setup - This function provides your newly created board and allows you to fill it. Add all the spaces and pieces you need before your game can start.
 * @param options.flow - Define your game's flow. See {@link game/flow} for details.
 * @param options.actions - Define all the actions in your game. See {@link action} for details.
 * @param options.breakpoints - Define all the breakpoints in your game. Return an object with breakpoint names as keys and functions that accept an aspectratio and return true if the breakpoint should be used
 * @param options.layout - Define all the layout rules for your game. See {@link GameElement#layout}, {@link GameElement#appearance} and {@link Board#layoutStep}
 */
export const createGame = <P extends Player, B extends Board<P>>({ playerClass, boardClass, elementClasses, setup, flow, actions, breakpoints, layout }: {
  playerClass: {new(a: PlayerAttributes<P>): P},
  boardClass: ElementClass<P, B>,
  elementClasses?: ElementClass<P, GameElement<P>>[],
  setup?: (board: B) => any,
  flow: (board: B) => Flow<P>,
  actions: (board: B, a: typeof action<P>, player: P) => Record<string, Action<P, Argument<P>[]>>,
  breakpoints?: Record<string, (aspectRatio: number) => boolean>,
  layout?: (board: B, breakpoint: string) => void
}): SetupFunction<P, B> => (
  state: SetupState<P> | GameState<P>,
  options?: {
    currentPlayerPosition?: number
    start?: boolean,
    trackMovement?: boolean,
  }
): Game<P, B> => {
  console.time('setup');
  const game = new Game<P, B>();
  let rseed = '';
  if ('rseed' in state) {
    rseed = state.rseed;
  } else {
    if (globalThis.window?.sessionStorage) { // web context, use a fixed seed for dev
      rseed = sessionStorage.getItem('rseed') as string;
      if (!rseed) {
        rseed = String(Math.random()) as string;
        sessionStorage.setItem('rseed', rseed);
      }
    }
  }
  game.setRandomSeed(rseed);
  game.definePlayers(playerClass);
  //console.timeLog('setup', 'setup players');
  game.defineBoard(boardClass, elementClasses || []);
  //console.timeLog('setup', 'define board');
  game.defineFlow(flow);
  //console.timeLog('setup', 'setup flow');
  game.defineActions(actions);
  //console.timeLog('setup', 'define actions');

  game.setSettings(state.settings);
  if (!('board' in state)) { // phase=new
    game.players.fromJSON(state.players);
    if (options?.start) {
      if (setup) setup(game.board);
      game.start();
    }
  } else { // phase=started
    game.players.fromJSON(state.players);
    if (options?.start) {
      // require setup to build spaces, graphs, event handlers
      if (setup) setup(game.board);
      //console.timeLog('setup', 'setup');
    }
    if (options?.trackMovement) game.trackMovement(true);
    game.phase = 'started';
    game.setState(state);
  }
  //console.timeLog('setup', 'setState');

  if (options?.start) {
    if (game.phase !== 'finished') game.play();
    if (options?.currentPlayerPosition) game.players.setCurrent(options?.currentPlayerPosition);
  } else {
    game.phase ??= 'new';
  }

  game.board._ui.breakpoints = breakpoints;
  game.board._ui.setupLayout = layout;
  console.timeEnd('setup');
  return game;
};
