import type Game from './game';
import type { Player } from './player/';
import type { Board } from './board/';
import type { Argument } from './action/types';
import type { ElementJSON } from './board/types';
import type { PlayerAttributes } from './player/types';
import type { FlowBranchNode } from './flow/types';

export type SetupState = {
  players: (PlayerAttributes<Player> & Record<string, any>)[],
  settings: Record<string, any>
}

export type GameState<P extends Player> = {
  players: PlayerAttributes<P>[],
  settings: Record<string, any>
  currentPlayerPosition?: number,
  position: FlowBranchNode[],
  board: ElementJSON[],
}

export type PlayerState<P extends Player> = {
  position: number
  state: GameState<P> // Game state, scrubbed
}

export type Message = {
  position: number
  body: string
}

export type GameUpdate<P extends Player> = {
  game: GameState<P>
  players: PlayerState<P>[]
  messages: Message[]
}

export type SetupFunction<P extends Player, B extends Board> = (state: SetupState | GameState<P>, start: boolean) => Game<P, B>

export type GameInterface<P extends Player> = {
  initialState: (state: SetupState, start?: boolean) => GameUpdate<P>,
  processMove: (
    previousState: GameState<P>,
    move: {
      position: number
      data: string[]
    }
  ) => GameUpdate<P>
}
