import type { Player } from '../game/player';
import type { SerializedArg } from '../game/action/types';
import type { PlayerState } from '../types';

export type SetupComponentProps = {
  name: string
  settings: Record<string, any>
  players: SetupPlayer[]
  updateKey: (key: string, value: any) => void
}

export type User = {
  userID: string
  userName: string
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

export type UserEvent = {
  type: "user"
  userID: string
  userName: string
  added: boolean
}

export type PlayersEvent = {
  type: "players"
  players: UserPlayer[]
}

// an update to the setup state
export type SettingsUpdateEvent = {
  type: "settingsUpdate"
  settings: GameSettings
}

export type GameUpdateEvent = {
  type: "gameUpdate"
  state: PlayerState<Player>
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
  }
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