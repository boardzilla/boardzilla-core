import type Game from './game.js';
import type { Player } from './player/index.js';
import type { Board } from './board/index.js';
import type { SerializedMove } from './action/types.d.ts';
import type {
  SetupState,
  GameState,
  GameUpdate,
} from '../types.d.ts';
import type React from 'react';
import type { SetupComponentProps } from '../ui/types.d.ts';

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
