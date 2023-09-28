import { GameElement } from './';
import { deserializeArg } from './action/utils';

import type { Player, Board } from './';
import type { SerializedArg, SerializedMove } from './action/types';
import type { SetupFunction, GameInterface } from './types';
import type { SetupState, GameState, GameUpdate } from '../types';

export const createInteface = (setup: SetupFunction<Player, Board<Player>>): GameInterface<Player> => {
  return {
    initialState: (state: SetupState<Player> | GameState<Player>, rseed: string): GameUpdate<Player> => {
      const game = setup(state, rseed, true);
      return {
        game: game.getState(),
        players: game.getPlayerStates(),
        messages: game.messages
      }
    },
    processMove: (
      previousState: GameState<Player>,
      move: {
        position: number
        data: SerializedMove
      },
      rseed: string
    ): GameUpdate<Player> => {
      const game = setup(previousState, rseed, true);
      const result = game.processMove({
        player: game.players.atPosition(move.position)!,
        action: move.data.action,
        args: move.data.args.map(a => deserializeArg(a as SerializedArg, game))
      });
      if (result.selection) {
        throw Error(`Unable to process move: ${result.error}`);
      }
      game.play();
      return {
        game: game.getState(),
        players: game.getPlayerStates(),
        messages: game.messages
      }
    },
    getPlayerState: (state: GameState<Player>, position: number): GameState<Player> => {
      if (!position) throw Error('getPlayerState without position');
      const game = setup(state, '', false);
      return game.getState(position)
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
