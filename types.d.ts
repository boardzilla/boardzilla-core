import type { Player } from './game/player/';
import type { ElementJSON } from './game/board/types';
import type { PlayerAttributes } from './game/player/types';
import type { FlowBranchJSON } from './game/flow/types';

export type SetupState<P extends Player> = {
  players: (PlayerAttributes<P> & Record<string, any>)[],
  settings: Record<string, any>
}

export type GameState<P extends Player> = {
  players: PlayerAttributes<P>[],
  settings: Record<string, any>
  currentPlayerPosition?: number,
  position: FlowBranchJSON[],
  board: ElementJSON[],
  moves?: Record<string, string>,
  phase?: 'define' | 'new' | 'started' | 'finished',
  rseed: string,
}

export type PlayerPositionState<P extends Player> = {
  position: number
  state: GameState<P> // Game state, scrubbed
}

export type Message = {
  position?: number
  body: string
}

export type GameUpdate<P extends Player> = {
  game: GameState<P>
  players: PlayerPositionState<P>[]
  currentPlayer: number[]
  winner: number[]
  phase: 'define' | 'new' | 'started' | 'finished'
  messages: Message[]
}
