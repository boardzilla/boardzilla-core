import Game from './game.js';
import { Player } from './player/index.js';
import { Board, Piece, Space, GameElement } from './board/index.js';

import {
  Action,
  action,
} from './action/index.js';

export {
  toggleSetting,
  numberSetting,
  textSetting,
  choiceSetting
} from '../ui/setup/components/settingComponents.js';

export { union } from './board/index.js';

export {
  playerActions,
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
export { times } from './utils.js';
export { Player, action };

// starter function to create a new game instance
// this is called from UI on first update and server on each call

import type { SetupState, GameState } from './interface.js';
import type { ElementClass } from './board/element.js';
import type { PlayerAttributes } from './game.js';
import type { Argument } from './action/action.js';
import type { FlowDefinition } from './flow/flow.js';

export const boardClasses = <P extends Player>(_: {new(...a: any[]): P}) => ({
  GameElement: GameElement<P>,
  Board: Board<P>,
  Space: Space<P>,
  Piece: Piece<P>,
});

export type SetupComponentProps = {
  name: string
  settings: Record<string, any>
  players: PlayerAttributes<Player>[]
  updateKey: (key: string, value: any) => void
}

export type SetupFunction<P extends Player, B extends Board<P>> = (
  state?: SetupState<P> | GameState<P>,
  options?: {
    currentPlayerPosition?: number[],
    start?: boolean,
    trackMovement?: boolean,
  }
) => Game<P, B>

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
export const createGame = <P extends Player, B extends Board<P>>({ playerClass, boardClass, elementClasses, settings, setup, flow, actions, breakpoints, layout }: {
  playerClass: {new(a: PlayerAttributes<P>): P},
  boardClass: ElementClass<P, B>,
  elementClasses?: ElementClass<P, GameElement<P>>[],
  settings?: Record<string, (p: SetupComponentProps) => JSX.Element>
  setup?: (board: B) => any,
  flow: (board: B) => FlowDefinition<P>,
  actions: (board: B, actionFunction: typeof action<P>, player: P) => Record<string, Action<P, Argument<P>[]>>,
  breakpoints?: (aspectRatio: number) => string,
  layout?: (board: B, breakpoint: string) => void
}): SetupFunction<P, B> => (
  state?: SetupState<P> | GameState<P>,
  options?: {
    currentPlayerPosition?: number[]
    start?: boolean,
    trackMovement?: boolean,
  }
): Game<P, B> => {
  console.time('setup');
  const game = new Game<P, B>();
  let rseed = '';
  if (state && 'rseed' in state) {
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
  game.setupComponents = settings;
  game.definePlayers(playerClass);
  //console.timeLog('setup', 'setup players');
  game.defineBoard(boardClass, elementClasses || []);
  //console.timeLog('setup', 'define board');
  game.defineFlow(flow);
  //console.timeLog('setup', 'setup flow');
  game.defineActions(actions);
  //console.timeLog('setup', 'define actions');
  if (state) game.setSettings(state.settings);

  if (state) {
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
      game.setState({...state, currentPlayerPosition: options?.currentPlayerPosition || [] });
    }
  } else {
    game.phase = 'new';
  }
  //console.timeLog('setup', 'setState');

  if (options?.start) {
    if (game.phase !== 'finished') game.play();
  }

  game.board._ui.breakpoints = breakpoints;
  game.board._ui.setupLayout = layout;
  console.timeEnd('setup');
  return game;
};
