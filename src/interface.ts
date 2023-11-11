import { deserializeArg } from './action/utils.js';

import type { ElementJSON } from './board/element.js';
import type Board from './board/board.js';
import type { default as Game, PlayerAttributes, Message, SerializedMove } from './game.js';
import type Player from './player/player.js';
import type { FlowBranchJSON } from './flow/flow.js';
import type { SetupFunction } from './index.js';
import type { SerializedArg } from './action/utils.js';

export type SetupState<P extends Player> = {
  players: (PlayerAttributes<P> & Record<string, any>)[],
  settings: Record<string, any>
}

export type GameState<P extends Player> = {
  players: PlayerAttributes<P>[],
  settings: Record<string, any>
  position: FlowBranchJSON[],
  board: ElementJSON[],
  rseed: string,
}

type GameStartedState<P extends Player> = Omit<GameState<P>, 'currentPlayerPosition'> & {
  phase: 'started',
  currentPlayers: number[]
}

type GameFinishedState<P extends Player> = Omit<GameState<P>, 'currentPlayerPosition'> & {
  phase: 'finished',
  winners: number[]
}

export type PlayerPositionState<P extends Player> = {
  position: number
  state: GameState<P> // Game state, scrubbed
}

export type GameUpdate<P extends Player> = {
  game: GameStartedState<P> | GameFinishedState<P>
  players: PlayerPositionState<P>[]
  messages: Message[]
}

export type GameInterface<P extends Player> = {
  initialState: (state: SetupState<P>, rseed: string) => GameUpdate<P>
  processMove: (
    previousState: GameState<P>,
    move: {
      position: number
      data: SerializedMove
    },
    trackMovement?: boolean
  ) => GameUpdate<P>
  getPlayerState: (
    state: GameState<P>,
    position: number
  ) => GameState<P>
}

export const createInteface = (setup: SetupFunction<Player, Board<Player>>): GameInterface<Player> => {
  return {
    initialState: (state: SetupState<Player>): GameUpdate<Player> => setup(state, {start: true}).getUpdate(),
    processMove: (
      previousState: GameStartedState<Player>,
      move: {
        position: number,
        data: SerializedMove | SerializedMove[]
      },
      trackMovement=true
    ): GameUpdate<Player> => {
      console.time('processMove');
      let cachedGame: Game<Player, Board<Player>> | undefined = undefined;
      // @ts-ignore
      if (globalThis.window && window.board && window.lastGame > new Date() - 10 && window.json === JSON.stringify(previousState)) cachedGame = window.board.game;
      const game = cachedGame || setup(previousState, {
        currentPlayerPosition: previousState.currentPlayers,
        start: true,
        trackMovement
      });
      console.timeLog('processMove', cachedGame ? 'restore cached game' : 'setup');
      game.messages = [];
      if (!(move.data instanceof Array)) move.data = [move.data];
      let error = undefined;
      for (let i = 0; i !== move.data.length; i++) {
        error ||= game.processMove({
          player: game.players.atPosition(move.position)!,
          action: move.data[i].action,
          args: move.data[i].args.map(a => deserializeArg(a as SerializedArg, game))
        });
        game.play();
      }
      console.timeLog('processMove', 'process');
      if (error) {
        throw Error(`Unable to process move: ${error}`);
      }
      game.play();
      // @ts-ignore
      if (globalThis.window) window.board = game.board;
      const update = game.getUpdate();
      console.timeLog('processMove', 'update');
      // @ts-ignore
      if (globalThis.window) { window.json = JSON.stringify(update.game); window.lastGame = new Date() }
      console.timeEnd('processMove');
      return update;
    },
    getPlayerState: (state: GameStartedState<Player> | GameFinishedState<Player>, position: number): GameStartedState<Player> | GameFinishedState<Player> => {
      if (!position) throw Error('getPlayerState without position');
      console.log('getPlayerState', position);
      const game = setup(state);
      if (state.phase === 'started') {
        return {
          ...game.getState(position),
          phase: state.phase,
          currentPlayers: state.currentPlayers
        }
      }
      return {
        ...game.getState(position),
        phase: 'finished',
        winners: game.winner.map(p => p.position)
      }
    }
  };
}
