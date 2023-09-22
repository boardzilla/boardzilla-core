import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gameStore } from './';
import Game from './game/Game';
import Setup from './setup/Setup';

import type {
  User,
  UserPlayer,
  GameSettings,
  GameUpdateEvent,
  UserEvent,
  PlayersEvent,
  SettingsUpdateEvent,
  MessageProcessedEvent,
  ReadyMessage,
  StartMessage,
  MoveMessage,
  UpdateSettingsMessage,
  UpdatePlayersMessage,
} from './types';
import type { SerializedMove } from '../game/action/types';

export default () => {
  const [game, setPosition, updateBoard] = gameStore(s => [s.game, s.setPosition, s.updateBoard]);
  const [players, setPlayers] = useState<UserPlayer[]>([]);
  const [settings, setSettings] = useState<GameSettings>();
  const [phase, setPhase] = useState('new');
  const [users, setUsers] = useState<User[]>([]);
  const [readySent, setReadySent] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const moves = useMemo<((e: string) => void)[]>(() => [], []);

  const listener = useCallback((event: MessageEvent<
    UserEvent |
    PlayersEvent |
    SettingsUpdateEvent |
    GameUpdateEvent |
    MessageProcessedEvent
  >) => {
    const data = event.data;
    console.log('message', event, data);
    switch(data.type) {
    case 'settingsUpdate':
      console.log('setup-update');
      setSettings(data.settings);
      break;
    case 'players':
      console.log('players-update');
      setPlayers(data.players);
      break;
    case 'gameUpdate':
      console.log('game-update');
      setPosition(data.state.position);
      game.setState(data.state.state);
      console.log('game-updateBoard');
      updateBoard();
      setPhase('started');
      break;
    case 'user':
      const { userID, userName } = data;
      if (data.added) {
        setUsers(users => {
          if (users.find(p => p.userID === userID)) return users
          return [...users, { userID, userName }]
        });
      } else {
        setUsers((users) => users.filter(p => p.userID !== userID))
      }
      break;
    case 'messageProcessed':
      if (data.error) catchError(data.error);
      const move = moves[parseInt(data.id)];
      if (move && data.error) move(data.error);
      delete moves[parseInt(data.id)];
      break;
    }
  }, [game]);

  useEffect(() => {
    window.addEventListener('message', listener, false)
    console.log('ready', readySent);
    const message: ReadyMessage = {type: "ready"};
    if (!readySent) {
      window.top!.postMessage(message, "*");
      setReadySent(true);
    }
    return () => window.removeEventListener('message', listener)
  }, [listener])

  const move = (move: SerializedMove) => {
    moves.push((error: string) => console.error(`move ${move} failed: ${error}`));
    const message: MoveMessage = {
      type: "move",
      id: String(moves.length),
      data: move
    };
    window.top!.postMessage(message, "*");
  };

  const updateSettings = (settings: GameSettings) => {
    console.log('update settings', settings);
    setSettings(settings);
    const message: UpdateSettingsMessage = {type: "updateSettings", id: 'settings', settings};
    window.top!.postMessage(message, "*");
  }

  const updatePlayers = (operations: UpdatePlayersMessage['operations']) => {
    console.log('update player', operations);
    const message: UpdatePlayersMessage = {
      type: 'updatePlayers',
      id: 'updatePlayers',
      operations
    }
    window.top!.postMessage(message, "*");
  }

  const start = () => {
    console.log('start');
    const message: StartMessage = {type: "start", id: 'start'};
    window.top!.postMessage(message, "*");
  }

  const catchError = (error: string) => {
    if (!error) return
    alert(error);
    setError(error);
  }

  console.log('RENDER MAIN', phase);

  return <>
    {phase === 'new' ?
     <Setup
       users={users}
       players={players}
       settings={settings}
       onUpdatePlayers={updatePlayers}
       onUpdateSettings={updateSettings}
       onStart={start}
     /> :
     <Game onMove={move} onError={catchError}/>
    }
    {error && <div className="error">{error}</div>}
  </>
}
