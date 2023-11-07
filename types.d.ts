import type { Player } from './game/player/index.ts';
import type { ElementJSON } from './game/board/types.d.ts';
import type { PlayerAttributes } from './game/player/types.d.ts';
import type { FlowBranchJSON } from './game/flow/types.d.ts';

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

export type PlayerPositionState<P extends Player> = {
  position: number
  state: GameState<P> // Game state, scrubbed
}

export type Message = {
  position?: number
  body: string
}

type GameStartedState<P extends Player> = Omit<GameState<P>, 'currentPlayerPosition'> & {
  phase: 'started',
  currentPlayers: number[]
}

type GameFinishedState<P extends Player> = Omit<GameState<P>, 'currentPlayerPosition'> & {
  phase: 'finished',
  winners: number[]
}

type GameUpdate<P extends Player> = {
  game: GameStartedState<P> | GameFinishedState<P>
  players: PlayerPositionState<P>[]
  messages: Message[]
}
