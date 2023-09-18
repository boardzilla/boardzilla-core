import type { PlayerAttributes } from 'boardzilla-game/player/types';
import type { Player } from 'boardzilla-game/player';

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
  data: any
}

// used to send a move
export type MoveMessage = {
  id: string
  type: 'move'
  data: any
}

// used to actually start the game
export type StartMessage = {
  id: string
  type: 'start'
  setup: any
  players: Player[]
}

// used to tell the top that you're ready to recv events
export type ReadyMessage = {
  type: 'ready'
}

// indicates a player was added
export type PlayerEvent = {
  type: "player"
  player: PlayerAttributes<Player>
  added: boolean
}

// an update to the current game state
export type UpdateEvent = {
  type: "update"
  phase: "new" | "started"
  state: any
}

// indicates the disposition of a message that was processed
type MessageProcessed = {
  type: "messageProcessed"
  id: string
  error: string | undefined
}
