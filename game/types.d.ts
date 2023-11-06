import type Game from './game';
import type { Player } from './player/';
import type { Board } from './board/';
import type { SerializedMove } from './action/types';
import type {
  SetupState,
  GameState,
  GameUpdate,
} from '../types';
import type React from 'react';
import { SetupComponentProps } from '../ui/types';

export type SetupFunction<P extends Player, B extends Board<P>> = (
  state?: SetupState<P> | GameState<P>,
  options?: {
    currentPlayerPosition?: number[],
    start?: boolean,
    trackMovement?: boolean,
  }
) => Game<P, B>

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

export type UIOptions<P extends Player> = {
  settings?: Record<string, (p: SetupComponentProps) => React.JSX.Element>
};

export type Sorter<T> = keyof {[K in keyof T]: T[K] extends number | string ? never: K} | ((e: T) => number | string)
