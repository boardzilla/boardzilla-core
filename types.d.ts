import type { Player } from './game/player/';
import type { ElementJSON } from './game/board/types';
import type { PlayerAttributes } from './game/player/types';
import type { FlowBranchNode } from './game/flow/types';

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
