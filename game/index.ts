export {default as Game} from './game';

export {
  Action, // remove
  action,
} from './action/';

export {
  Board, // remove
  Space, // remove
  Piece, // remove
  GameElement, // remove
  union,
} from './board/';

export {
  Player,
  PlayerCollection // remove
} from './player/';

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

// starter function

import { Player, Game, Board, Piece, Space, action, Action, GameElement } from '.';
import type { SetupState, GameState } from '../types';
import type { SetupFunction } from './types';
import type { ElementClass } from './board/types';
import type { PlayerAttributes } from './player/types';
import type { Argument } from './action/types';
import type { Flow } from './flow';

export const imports = <P extends Player>() => ({
  Board: Board<P>,
  Space: Space<P>,
  Piece: Piece<P>,
  action: action<P>
});

export default <P extends Player, B extends Board<P>>({ playerClass, boardClass, elementClasses, setupBoard, setupFlow, actions, setupLayout }: {
  playerClass: {new(a: PlayerAttributes<P>): P},
  boardClass: ElementClass<P, B>,
  elementClasses?: ElementClass<P, GameElement<P>>[],
  setupBoard?: (game: Game<P, B>, board: B) => any,
  setupFlow: (game: Game<P, B>, board: B) => Flow<P>,
  actions: (game: Game<P, B>, board: B) => Record<string, (player: P) => Action<P, Argument<P>[]>>,
  setupLayout?: (board: B) => void
}): SetupFunction<P, B> => (state: SetupState<P> | GameState<P>, rseed: string, start: boolean): Game<P, B> => {
  console.time('setup');
  const game = new Game<P, B>();
  game.setRandomSeed(rseed);
  game.definePlayers(playerClass);
  //console.timeLog('setup', 'setup players');
  game.defineBoard(boardClass, elementClasses || []);
  //console.timeLog('setup', 'define board');
  game.defineFlow(setupFlow);
  //console.timeLog('setup', 'setup flow');
  game.defineActions(actions);
  //console.timeLog('setup', 'define actions');

  game.setSettings(state.settings);
  if (!('board' in state)) { // phase=new
    game.players.fromJSON(state.players);
    if (start) {
      if (setupBoard) setupBoard(game, game.board as B);
      game.start();
    }
  } else { // phase=started
    game.players.fromJSON(state.players);
    if (start) {
      // require setup to build spaces, graphs, event handlers
      if (setupBoard) setupBoard(game, game.board as B);
      //console.timeLog('setup', 'setupBoard');
    }
    game.setState(state);
  }
  //console.timeLog('setup', 'setState');

  if (start) {
    game.play();
  } else {
    game.phase = 'new';
  }
  console.timeEnd('setup');
  game.setupLayout = setupLayout;
  return game;
};
