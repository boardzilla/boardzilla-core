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
  union
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
import type { SetupState, GameState, SetupFunction } from './types';
import type { ElementClass } from './board/types';
import type { PlayerAttributes } from './player/types';
import type { Flow } from './flow';

export default <P extends Player, B extends Board>({ minPlayers, maxPlayers, playerClass, boardClass, elementClasses, setupBoard, setupFlow, actions }: {
  minPlayers: number,
  maxPlayers: number,
  playerClass: {new(a: PlayerAttributes<P>): P},
  boardClass: ElementClass<B>,
  elementClasses: ElementClass<GameElement>[],
  setupBoard: (game: Game<P, B>, board: B) => any,
  setupFlow: (game: Game<P, B>, board: B) => Flow,
  actions: (game: Game<P, B>, board: B) => Record<string, (player: P) => Action>
}): SetupFunction<P, B> => (state: SetupState | GameState<P>, start: boolean): Game<P, B> => {
  console.time('setup');
  const game = new Game<P, B>();

  game.minPlayers = minPlayers;
  game.maxPlayers = maxPlayers;
  game.definePlayers(playerClass);
  console.timeLog('setup');
  game.defineBoard(boardClass, elementClasses);
  console.timeLog('setup');
  game.defineFlow(setupFlow);
  console.timeLog('setup');
  game.defineActions(actions);
  console.timeLog('setup');

  game.setSettings(state.settings);
  if (!('board' in state)) {
    game.players.fromJSON(state.players);
    if (start) {
      setupBoard(game, game.board as B);
      game.start();
    }
  } else {
    game.setState(state);
  }
  console.timeLog('setup');

  if (start) {
    game.play();
  } else {
    game.phase = 'new';
  }
  console.timeEnd('setup');
  return game;
};
