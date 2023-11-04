import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gameStore } from './';
import Game from './game/Game';
import Setup from './setup/Setup';

import type {
  User,
  UserPlayer,
  GameSettings,
  GameUpdateEvent,
  GameFinishedEvent,
  PlayersEvent,
  SettingsUpdateEvent,
  MessageProcessedEvent,
  ReadyMessage,
  StartMessage,
  MoveMessage,
  UpdateSettingsMessage,
  UpdatePlayersMessage,
} from './types';

export default ({ userID, minPlayers, maxPlayers }: {
  userID: string,
  minPlayers: number,
  maxPlayers: number,
}) => {
  const [game, move, moves, clearMoves, error, setError, position, updateState] = gameStore(s => [s.game, s.move, s.moves, s.clearMoves, s.error, s.setError, s.position, s.updateState]);
  const [players, setPlayers] = useState<UserPlayer[]>([]);
  const [settings, setSettings] = useState<GameSettings>();
  const [users, setUsers] = useState<User[]>([]);
  const [readySent, setReadySent] = useState<boolean>(false);

  const moveCallbacks = useMemo<((e: string) => void)[]>(() => [], []);

  const listener = useCallback((event: MessageEvent<
    PlayersEvent |
    SettingsUpdateEvent |
    GameUpdateEvent |
    GameFinishedEvent |
    MessageProcessedEvent
  >) => {
    const data = event.data;
    console.log('message', data);
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
      if (data.error) catchError(data.error);
      const move = moveCallbacks[parseInt(data.id)];
      if (move && data.error) move(data.error);
      delete moveCallbacks[parseInt(data.id)];
      break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', listener, false)
    const message: ReadyMessage = {type: "ready"};
    if (!readySent) {
      window.top!.postMessage(message, "*");
      setReadySent(true);
    }
    return () => window.removeEventListener('message', listener)
  }, [listener]);

  useEffect(() => {
    // move is processable
    if (moves?.length) {
      console.log('success, submitting to server', moves);
      moveCallbacks.push((error: string) => console.error(`move ${move} failed: ${error}`));
      const message: MoveMessage = {
        type: "move",
        id: String(moveCallbacks.length),
        data: moves
      };
      window.top!.postMessage(message, "*");
      clearMoves();
    }
  }, [game, position, moves]);

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

  const catchError = useCallback((error: string) => {
    if (!error) return
    alert(error);
    setError(error);
  }, []);

  console.log('render MAIN', game.phase);

  return (
    <>
      {game.phase === 'new' && settings &&
        <Setup
          users={users}
          minPlayers={minPlayers}
          maxPlayers={maxPlayers}
          players={players}
          settings={settings}
          onUpdatePlayers={updatePlayers}
          onUpdateSettings={updateSettings}
          onStart={start}
        />
      }
      {game.phase !== 'new' && <Game/>}
      {error && <div className="error">{error}</div>}
    </>
  );
}
