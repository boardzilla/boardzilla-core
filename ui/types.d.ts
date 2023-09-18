import type { PlayerAttributes } from '../game/player/types';
import type { Player } from '../game/player';

export type Argument = string | number | boolean;

export type User = {
  id: string
  name: string
}

export type SetupPlayer = (PlayerAttributes<Player> & { settings: Record<string, any> })

export type SetupState = {
  players: SetupPlayer[] // permit add'l per-player settings
  settings: Record<string, any>
}

export type SetupComponentProps = {
  name: string
  settings: Record<string, any>
  updateKey: (key: string, value: any) => void
}

// used to update the current setup json state
export type SetupUpdated = {
  type: "setupUpdated"
  data: SetupState
}

// used to send a move
export type MoveMessage = {
  id: string
  type: 'move'
  data: string[]
}

// used to actually start the game
export type StartMessage = {
  id: string
  type: 'start'
  setup: SetupState
}

// used to tell the top that you're ready to recv events
export type ReadyMessage = {
  type: 'ready'
}

// indicates a user was added
type UserEvent = {
  type: "user"
  id: string
  name: string
  added: boolean
}

// an update to the current game state
export type UpdateEvent = {
  type: "update"
  phase: "new" | "started"
  state: any
}

// // an update to the setup state
// type SetupUpdateEvent = {
//   type: "update"
//   phase: "new"
//   state: SetupState
// }

// // an update to the current game state
// type GameUpdateEvent = {
//   type: "update"
//   phase: "started"
//   state: GameState
// }

// indicates the disposition of a message that was processed
type MessageProcessed = {
  type: "messageProcessed"
  id: string
  error: string | undefined
}
