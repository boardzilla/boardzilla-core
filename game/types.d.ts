import type Game from './game';
import type { Player } from './player/';
import type { Board } from './board/';
import type { SerializedMove } from './action/types';
import type {
  SetupState,
  GameState,
  GameUpdate,
} from '../types';

export type SetupFunction<P extends Player, B extends Board<P>> = (state: SetupState<P> | GameState<P>, rseed: string, start: boolean) => Game<P, B>

export type GameInterface<P extends Player> = {
  initialState: (state: SetupState<P>, rseed: string) => GameUpdate<P>
  processMove: (
    previousState: GameState<P>,
    move: {
      position: number
      data: SerializedMove
    },
    rseed: string
  ) => GameUpdate<P>
  getPlayerState: (
    state: GameState<P>,
    position: number
  ) => GameState<P>
}
