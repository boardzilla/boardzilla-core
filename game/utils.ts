import { GameElement } from './board';
import { deserializeArg } from './action/utils';

import type { Player } from './';
import type { Board } from './board';
import type { SerializedArg, SerializedMove } from './action/types';
import type { SetupFunction, GameInterface } from './types';
import type { SetupState, GameStartedState, GameFinishedState, GameUpdate } from '../types';

export const createInteface = (setup: SetupFunction<Player, Board<Player>>): GameInterface<Player> => {
  return {
    initialState: (state: SetupState<Player>): GameUpdate<Player> => setup(state, {start: true}).getUpdate(),
    processMove: (
      previousState: GameStartedState<Player>,
      move: {
        position: number,
        data: SerializedMove
      }
    ): GameUpdate<Player> => {
      const game = setup(previousState, {
        currentPlayerPosition: previousState.currentPlayers.length === 1 ? previousState.currentPlayers[0] : undefined,
        start: true,
        trackMovement: true
      });
      const error = game.processMove({
        player: game.players.atPosition(move.position)!,
        action: move.data.action,
        args: move.data.args.map(a => deserializeArg(a as SerializedArg, game))
      });
      if (error) {
        throw Error(`Unable to process move: ${error}`);
      }
      game.play();
      // @ts-ignore
      if (globalThis.window) window.board = game.board; // debugging - may remove
      return game.getUpdate();
    },
    getPlayerState: (state: GameStartedState<Player> | GameFinishedState<Player>, position: number): GameStartedState<Player> | GameFinishedState<Player> => {
      if (!position) throw Error('getPlayerState without position');
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

const chain = (o: any, c?: string[]): string[] => {
  c = (c || []).concat(o.constructor.name);
  o = Object.getPrototypeOf(o);
  if (o) return chain(o,c);
  return c;
}

// loose instanceof check that uses class names. required to deal with lack of class equality in webpack?
// export const isA = (el: GameElement, el2: {new(...a: any[]): any, name: string}) => chain(el).includes(el2.name);
export const isA = <P extends Player>(el: GameElement<P>, el2: {new(...a: any[]): any, name: string}) => el instanceof el2

export const shuffleArray = (array: any[], random: () => number) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// usage times(max, n => ...) from 1 to max
export const times = (n: number, fn: (n: number) => any) => Array.from(Array(n)).map((_, i) => fn(i + 1));
export const range = (min: number, max: number, step = 1) => times(Math.floor((max - min) / step) + 1, i => (i - 1) * step + min);
