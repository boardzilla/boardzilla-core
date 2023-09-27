export {default as Game} from './game';

export {
  Action,
  MoveAction,
} from './action/';

export {
  Board,
  Space,
  Piece,
  GameElement,
  union,
  boardClasses
} from './board/';

export {
  Player,
  PlayerCollection
} from './player/';

export {
  Sequence,
  PlayerAction,
  Step,
  Loop,
  ForEach,
  SwitchCase,
  IfElse,
  EachPlayer,
  repeat,
  skip
} from './flow/';

export {
  isA,
  times,
} from './utils';

// starter function

import { Player, Game, Board, Action, GameElement } from '.';
import type { SetupState, GameState } from '../types';
import type { SetupFunction } from './types';
import type { ElementClass } from './board/types';
import type { PlayerAttributes } from './player/types';
import type { Flow } from './flow';

export default <P extends Player, B extends Board<P>>({ minPlayers, maxPlayers, playerClass, boardClass, elementClasses, setupBoard, setupFlow, actions }: {
  minPlayers: number,
  maxPlayers: number,
  playerClass: {new(a: PlayerAttributes<P>): P},
  boardClass: ElementClass<P, B>,
  elementClasses: ElementClass<P, GameElement<P>>[],
  setupBoard: (game: Game<P, B>, board: B) => any,
  setupFlow: (game: Game<P, B>, board: B) => Flow<P>,
  actions: (game: Game<P, B>, board: B) => Record<string, (player: P) => Action<P>>
}): SetupFunction<P, B> => (state: SetupState<P> | GameState<P>, rseed: string, start: boolean): Game<P, B> => {
  console.time('setup');
  const game = new Game<P, B>();
  game.setRandomSeed(rseed);
  game.minPlayers = minPlayers;
  game.maxPlayers = maxPlayers;
  game.definePlayers(playerClass);
  //console.timeLog('setup', 'setup players');
  game.defineBoard(boardClass, elementClasses);
  //console.timeLog('setup', 'define board');
  game.defineFlow(setupFlow);
  //console.timeLog('setup', 'setup flow');
  game.defineActions(actions);
  //console.timeLog('setup', 'define actions');

  game.setSettings(state.settings);
  if (!('board' in state)) { // phase=new
    game.players.fromJSON(state.players);
    if (start) {
      setupBoard(game, game.board as B);
      game.start();
    }
  } else { // phase=started
    game.players.fromJSON(state.players);
    if (start) {
      // require setup to build spaces, graphs, event handlers
      setupBoard(game, game.board as B);
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
  return game;
};
