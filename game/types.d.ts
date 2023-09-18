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

type PlayerState<P extends Player> = {
  position: number
  players: (PlayerAttributes<P> & Record<string, any>)[] // Game-specific player object, scrubbed
  board: any // json tree, scrubbed
}

type Message = {
  position: number
  body: string
}

type GameUpdate<P extends Player> = {
  game: GameState<P>
  players: PlayerState<P>[]
  messages: Message[]
}

export type GameInterface<P extends Player, B extends Board> = {
  initialState: (state: SetupState, start?: boolean) => Game<P, B>,
  processMove: (
    previousState: GameState<P>,
    move: {
      position: number
      data: {
        action: string,
        args: Argument[]
      }
    }
  ) => Game<P, B>
}
