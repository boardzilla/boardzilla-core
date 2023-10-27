import Game from './game';
import { Player } from './player';
import { Board, Piece, Space, GameElement } from './board';

import {
  Action,
  action,
} from './action/';

export {
  union,
} from './board/';

export {
  Flow,
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

export { Game, Player };

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

export default <P extends Player, B extends Board<P>>({ playerClass, boardClass, elementClasses, setup, flow, actions, breakpoints, layout }: {
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
