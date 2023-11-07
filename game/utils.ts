import { deserializeArg } from './action/utils.js';

import type { Player } from './index.js';
import type Game from './game.js';
import type { Board } from './board/index.js';
import type { SerializedArg, SerializedMove } from './action/types.d.ts';
import type { SetupFunction, GameInterface } from './types.d.ts';
import type { SetupState, GameStartedState, GameFinishedState, GameUpdate } from '../types.d.ts';

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
      if (!(move.data instanceof Array)) move.data = [move.data];
      let error = undefined;
      for (let i = 0; i !== move.data.length; i++) {
	error ||= game.processMove({
          player: game.players.atPosition(move.position)!,
          action: move.data[i].action,
          args: move.data[i].args.map(a => deserializeArg(a as SerializedArg, game))
	});
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

export const shuffleArray = (array: any[], random: () => number) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// usage times(max, n => ...) from 1 to max
export const times = (n: number, fn: (n: number) => any) => Array.from(Array(n)).map((_, i) => fn(i + 1));
export const range = (min: number, max: number, step = 1) => times(Math.floor((max - min) / step) + 1, i => (i - 1) * step + min);
