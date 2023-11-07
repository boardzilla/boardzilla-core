import type { Player } from '../game/player/index.js';
import type { PlayerAttributes } from '../game/player/types.d.ts';
import type { SerializedArg } from '../game/action/types.d.ts';
import type { GameState } from '../types.d.ts';

export type User = {
  id: string
  name: string
}

export type SetupPlayer = {
  color: string
  name: string
  position: number
  settings?: any
}

export type UserPlayer = SetupPlayer & {
  userID?: string
}

export type GameSettings = Record<string, any>

export type PlayersEvent = {
  type: "players"
  players: UserPlayer[]
  users: User[]
}

// an update to the setup state
export type SettingsUpdateEvent = {
  type: "settingsUpdate"
  settings: GameSettings
}

export type GameUpdateEvent = {
  type: "gameUpdate"
  state: {
    position: number,
    state: GameState<Player>
  }
  currentPlayers: number[]
}

type GameFinishedEvent = {
  type: "gameFinished"
  state: {
    position: number,
    state: GameState<Player>
  }
  winners: number[]
}

// indicates the disposition of a message that was processed
export type MessageProcessedEvent = {
  type: "messageProcessed"
  id: string
  error?: string
}

export type SeatOperation = {
  type: 'seat'
  position: number,
  userID: string
  color: string
  name: string
  settings?: any
}

export type UnseatOperation = {
  type: 'unseat'
  position: number,
}

export type UpdateOperation = {
  type: 'update'
  position: number,
  color?: string
  name?: string
  settings?: any
}

export type ReserveOperation = {
  type: 'reserve'
  position: number,
  color: string
  name: string
  settings?: any
}

type PlayerOperation = SeatOperation | UnseatOperation | UpdateOperation | ReserveOperation

export type UpdatePlayersMessage = {
  type: "updatePlayers"
  id: string
  operations: PlayerOperation[]
}

export type UpdateSettingsMessage = {
  type: "updateSettings"
  id: string
  settings: GameSettings
}

// used to send a move
export type MoveMessage = {
  id: string
  type: 'move'
  data: {
    action: string,
    args: SerializedArg[]
  } | {
    action: string,
    args: SerializedArg[]
  }[]
}

// used to actually start the game
export type StartMessage = {
  id: string
  type: 'start'
}

// used to tell the top that you're ready to recv events
export type ReadyMessage = {
  type: 'ready'
}

export type SwitchPlayerMessage = {
  type: "switchPlayer"
  index: number
}

export type SetupComponentProps = {
  name: string
  settings: Record<string, any>
  players: PlayerAttributes<Player>[]
  updateKey: (key: string, value: any) => void
}
