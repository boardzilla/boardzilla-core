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

import type { Argument } from './action/types';

// starter function

import { Player, Game, Board, Action, GameElement } from '.';
import type { SetupState, GameState, GameInterface } from './types';
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
}): GameInterface<P, B> => {
  const setup = (state: SetupState | GameState<P>, start: boolean): Game<P, B> => {
    console.time('setup');
    const game = new Game<P, B>();

    game.minPlayers = minPlayers;
    game.maxPlayers = maxPlayers;
    game.definePlayers(playerClass);
    console.timeLog('setup');
    game.defineBoard(boardClass, elementClasses);
    console.timeLog('setup');

    game.setSettings(state.settings);
    if (!('board' in state)) {
      game.players.fromJSON(state.players);
      if (start) setupBoard(game, game.board as B);
    } else {
      const { position, ...restOfState } = state;
      game.setState(restOfState);
    }

    game.defineFlow(setupFlow(game, game.board as B));
    console.timeLog('setup');

    game.defineActions(actions);
    console.timeLog('setup');

    if (!('board' in state)) {
      if (start) game.start();
    } else {
      game.setPosition(state.position);
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

  return {
    initialState: (state: SetupState, start: boolean = true) => setup(state, start),
    processMove: (
      previousState: GameState<P>,
      move: {
        position: number
        data: {
          action: string,
          args: Argument[]
        }
      }
    ) => {
      const game = setup(previousState, true);
      game.processMove({
        player: game.players.atPosition(move.position)!,
        action: move.data.action,
        args: move.data.args
      });
      return game;
    }
  };
}
