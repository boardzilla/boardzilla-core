import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gameStore } from './index.js';
import Game from './game/Game.js';
import Setup from './setup/Setup.js';
import { humanizeArg } from '../action/utils.js';

import type { GameState } from '../interface.js';
import type { SerializedArg } from '../action/utils.js';
import type Player from '../player/player.js';
import { PlayerAttributes } from '../game.js';
import { SetupComponentProps } from './index.js';

export type User = {
  id: string
  name: string
}

export type SetupPlayer = PlayerAttributes<Player>;

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

export type GameFinishedEvent = {
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
    args: Record<string, SerializedArg>
  } | {
    action: string,
    args: Record<string, SerializedArg>
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

export default ({ minPlayers, maxPlayers, setupComponents }: {
  minPlayers: number,
  maxPlayers: number,
  setupComponents: Record<string, (p: SetupComponentProps) => JSX.Element>
}) => {
  const [game, moves, clearMoves, setSelected, error, setError, position, updateState] = gameStore(s => [s.game, s.moves, s.clearMoves, s.setSelected, s.error, s.setError, s.position, s.updateState]);
  const [players, setPlayers] = useState<UserPlayer[]>([]);
  const [settings, setSettings] = useState<GameSettings>();
  const [users, setUsers] = useState<User[]>([]);
  const [readySent, setReadySent] = useState<boolean>(false);

  const moveCallbacks = useMemo<((e: string) => void)[]>(() => [], []);

  const catchError = useCallback((error: string) => {
    if (!error) return
    alert(error);
    setError(error);
  }, [setError]);

  const listener = useCallback((event: MessageEvent<
    PlayersEvent |
    SettingsUpdateEvent |
    GameUpdateEvent |
    GameFinishedEvent |
    MessageProcessedEvent
  >) => {
    const data = event.data;
    //console.log('message', data);
    switch(data.type) {
    case 'settingsUpdate':
      setSettings(data.settings);
      break;
    case 'players':
      setPlayers(data.players);
      setUsers(data.users);
      break;
    case 'gameUpdate':
    case 'gameFinished':
      updateState(data);
      break;
    case 'messageProcessed':
      if (data.error) {
        catchError(data.error);
        const move = moveCallbacks[parseInt(data.id)];
        if (move) move(data.error);
      }
      delete moveCallbacks[parseInt(data.id)];
      break;
    }
  }, [catchError, moveCallbacks, updateState]);

  useEffect(() => {
    window.addEventListener('message', listener, false)
    const message: ReadyMessage = {type: "ready"};
    if (!readySent) {
      window.top!.postMessage(message, "*");
      setReadySent(true);
    }
    return () => window.removeEventListener('message', listener)
  }, [readySent, listener]);

  useEffect(() => {
    // move is processable
    if (moves?.length) {
      console.debug(`Submitting valid moves from player #${position}:\n${moves.map(m => `⮕ ${m.action}({${Object.entries(m.args).map(([k, v]) => k + ': ' + humanizeArg(v)).join(', ')}})\n`)}`);
      moveCallbacks.push((error: string) => console.error(`move ${moves} failed: ${error}`));
      const message: MoveMessage = {
        type: "move",
        id: String(moveCallbacks.length),
        data: moves
      };
      window.top!.postMessage(message, "*");
      setSelected([]);
      clearMoves();
    }
  }, [game, position, moves, clearMoves, moveCallbacks, setSelected]);

  const updateSettings = useCallback((settings: GameSettings) => {
    setSettings(settings);
    const message: UpdateSettingsMessage = {type: "updateSettings", id: 'settings', settings};
    window.top!.postMessage(message, "*");
  }, []);

  const updatePlayers = useCallback((operations: UpdatePlayersMessage['operations']) => {
    const message: UpdatePlayersMessage = {
      type: 'updatePlayers',
      id: 'updatePlayers',
      operations
    }
    window.top!.postMessage(message, "*");
  }, [])

  const start = useCallback(() => {
    const message: StartMessage = {type: "start", id: 'start'};
    window.top!.postMessage(message, "*");
  }, []);

  return (
    <>
      {game.phase === 'new' && settings &&
        <Setup
          users={users}
          minPlayers={minPlayers}
          maxPlayers={maxPlayers}
          setupComponents={setupComponents}
          players={players}
          settings={settings}
          onUpdatePlayers={updatePlayers}
          onUpdateSettings={updateSettings}
          onStart={start}
        />
      }
      {(game.phase === 'started' || game.phase === 'finished') && <Game/>}
      {error && <div className="error">{error}</div>}
    </>
  );
}
