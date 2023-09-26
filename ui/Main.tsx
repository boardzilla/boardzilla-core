import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gameStore } from './';
import Game from './game/Game';
import Setup from './setup/Setup';
import type { SetupFunction } from '../game/types'
import type { Board, Player } from '../game'

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

export default ({ userID, setup }: { userID: string, setup: SetupFunction<Player, Board> }) => {
  const [game, setGame, setPosition, updateBoard] = gameStore(s => [s.game, s.setGame, s.setPosition, s.updateBoard]);
  const [players, setPlayers] = useState<UserPlayer[]>([]);
  const [settings, setSettings] = useState<GameSettings>();
  const [phase, setPhase] = useState<string>();
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
    console.log('message', data);
    switch(data.type) {
    case 'settingsUpdate':
      //console.log('setup-update');
      setSettings(data.settings);
      setPhase('new');
      break;
    case 'players':
      //console.log('players-update');
      setPlayers(data.players);
      const position = data.players.find(p => p.userID === userID)?.position;
      if (position) setPosition(position)
      break;
    case 'gameUpdate':
      //console.log('game-update', phase);
      let newGame = game || setup({ players: data.state.players, settings: data.state.settings }, 'ui', true);
      newGame.setState(data.state);
      if (newGame !== game) setGame(newGame);
      updateBoard();

      setPhase('started'); // set phase last to render the game
      break;
    case 'user':
      if (data.added) {
        setUsers(users => {
          if (users.find(p => p.userID === data.userID)) return users
          return [...users, { userID: data.userID, userName: data.userName }]
        });
      } else {
        setUsers((users) => users.filter(p => p.userID !== data.userID))
      }
      break;
    case 'messageProcessed':
      if (data.error) catchError(data.error);
      const move = moves[parseInt(data.id)];
      if (move && data.error) move(data.error);
      delete moves[parseInt(data.id)];
      break;
    }
  }, [game, setGame]);

  useEffect(() => {
    window.addEventListener('message', listener, false)
    //console.log('ready', readySent);
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

  const updateSettings = useCallback((settings: GameSettings) => {
    //console.log('update settings', settings);
    setSettings(settings);
    const message: UpdateSettingsMessage = {type: "updateSettings", id: 'settings', settings};
    window.top!.postMessage(message, "*");
  }, []);

  const updatePlayers = useCallback((operations: UpdatePlayersMessage['operations']) => {
    //console.log('update player', operations);
    const message: UpdatePlayersMessage = {
      type: 'updatePlayers',
      id: 'updatePlayers',
      operations
    }
    window.top!.postMessage(message, "*");
  }, [])

  const start = useCallback(() => {
    //console.log('start');
    const message: StartMessage = {type: "start", id: 'start'};
    window.top!.postMessage(message, "*");
  }, []);

  const catchError = useCallback((error: string) => {
    if (!error) return
    alert(error);
    setError(error);
  }, []);

  console.log('RENDER MAIN', phase);

  return <>
    {phase === 'new' &&
     <Setup
       users={users}
       players={players}
       settings={settings}
       onUpdatePlayers={updatePlayers}
       onUpdateSettings={updateSettings}
       onStart={start}
     />
    }
    {phase === 'started' &&
     <Game onMove={move} onError={catchError}/>
    }
    {error && <div className="error">{error}</div>}
  </>
}
