import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { gameStore } from './index.js';
import Game from './game/Game.js';
import Setup from './setup/Setup.js';
import Queue from './queue.js';

import type { GameState } from '../interface.js';
import type Player from '../player/player.js';
import type { SetupComponentProps } from './index.js';

export type User = {
  id: string;
  name: string;
  avatar: string;
  playerDetails?: {
    color: string;
    position: number;
    settings?: any;
  };
};

type UsersEvent = {
  type: "users";
  users: User[];
};

export type GameSettings = Record<string, any>

// an update to the setup state
export type SettingsUpdateEvent = {
  type: "settingsUpdate";
  settings: GameSettings;
}

export type GameUpdateEvent = {
  type: "gameUpdate";
  state: GameState<Player> | GameState<Player>[];
  position: number;
  currentPlayers: number[];
  readOnly?: boolean;
}

export type GameFinishedEvent = {
  type: "gameFinished";
  state: GameState<Player> | GameState<Player>[];
  position: number;
  winners: number[];
}

// indicates the disposition of a message that was processed
export type MessageProcessedEvent = {
  type: "messageProcessed";
  id: string;
  error?: string;
}

export type SeatOperation = {
  type: 'seat';
  position: number;
  userID: string;
  color: string;
  name: string;
  settings?: any;
}

export type UnseatOperation = {
  type: 'unseat';
  userID: string;
}

export type UpdateOperation = {
  type: 'update';
  userID: string;
  color?: string;
  name?: string;
  settings?: any;
}

export type ReserveOperation = {
  type: 'reserve';
  position: number;
  color: string;
  name: string;
  settings?: any;
}

type PlayerOperation = SeatOperation | UnseatOperation | UpdateOperation | ReserveOperation

export type UpdatePlayersMessage = {
  type: "updatePlayers";
  id: string;
  operations: PlayerOperation[];
}

export type UpdateSelfPlayerMessage = {
  type: "updateSelfPlayer";
  id: string;
  name: string;
  color: string;
}

export type UpdateSettingsMessage = {
  type: "updateSettings";
  id: string;
  settings: GameSettings;
}

// used to actually start the game
export type StartMessage = {
  id: string;
  type: 'start';
}

// used to tell the top that you're ready to recv events
export type ReadyMessage = {
  type: 'ready';
}

export type SwitchPlayerMessage = {
  type: "switchPlayer";
  index: number;
}

export default ({ minPlayers, maxPlayers, setupComponents }: {
  minPlayers: number,
  maxPlayers: number,
  setupComponents: Record<string, (p: SetupComponentProps) => JSX.Element>
}) => {
  const [game, setError, updateState] = gameStore(s => [s.game, s.setError, s.updateState]);
  const [settings, setSettings] = useState<GameSettings>();
  const [users, setUsers] = useState<User[]>([]);
  const [readySent, setReadySent] = useState<boolean>(false);
  const players = useMemo(() => users.filter(u => !!u.playerDetails), [users]);

  const moveCallbacks = useMemo<((e: string) => void)[]>(() => [], []);

  const catchError = useCallback((error: string) => {
    if (!error) return
    console.error(error);
    setError(error);
  }, [setError]);

  const queue = useMemo(() => new Queue(1) /* speed */, []);

  const listener = useCallback((event: MessageEvent<
    UsersEvent |
    SettingsUpdateEvent |
    GameUpdateEvent |
    GameFinishedEvent |
    MessageProcessedEvent
  >) => {
    const data = event.data;
    switch(data.type) {
    case 'settingsUpdate':
      setSettings(data.settings);
      break;
    case 'users':
      setUsers(data.users);
      break;
    case 'gameUpdate':
    case 'gameFinished':
      {
        if (data.state instanceof Array) {
          let delay = data.state[0].sequence === game.sequence + 1;
          for (const state of data.state) {
            queue.schedule(() => updateState({...data, state}), delay);
            delay = true;
          }
        } else {
          let delay = data.state.sequence === game.sequence + 1;
          queue.schedule(() => updateState(data as typeof data & {state: typeof data.state}), delay); // TS needs help here...
        }
      }
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
  }, [queue, game, catchError, moveCallbacks, updateState]);

  useEffect(() => {
    window.addEventListener('message', listener, false)
    const message: ReadyMessage = {type: "ready"};
    if (!readySent) {
      window.top!.postMessage(message, "*");
      setReadySent(true);
    }
    return () => window.removeEventListener('message', listener)
  }, [readySent, listener]);

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

  const updateSelfPlayer = useCallback(({ color, name }: { color: string, name: string }) => {
    const message: UpdateSelfPlayerMessage = {
      id: 'updateSelfPlayer',
      type: 'updateSelfPlayer',
      color,
      name
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
          onUpdateSelfPlayer={updateSelfPlayer}
          onUpdateSettings={updateSettings}
          onStart={start}
        />
      }
      {(game.phase === 'started' || game.phase === 'finished') && <Game/>}
    </>
  );
}
