import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gameStore } from './';
import Game from './game/Game';
import Setup from './setup/Setup';
import { serializeArg } from '../game/action/utils';

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
import type { SerializedMove } from '../game/action/types';

export default ({ userID, minPlayers, maxPlayers }: {
  userID: string,
  minPlayers: number,
  maxPlayers: number,
}) => {
  const [game, move, selectMove, pendingMoves, position, updateBoard, updateState] = gameStore(s => [s.game, s.move, s.selectMove, s.pendingMoves, s.position, s.updateBoard, s.updateState]);
  const [players, setPlayers] = useState<UserPlayer[]>([]);
  const [settings, setSettings] = useState<GameSettings>();
  const [users, setUsers] = useState<User[]>([]);
  const [readySent, setReadySent] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const moves = useMemo<((e: string) => void)[]>(() => [], []);

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
      const move = moves[parseInt(data.id)];
      if (move && data.error) move(data.error);
      delete moves[parseInt(data.id)];
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
  }, [listener])

  useEffect(() => {
    // move is processable
    if (game && position && (pendingMoves?.length === 0 || pendingMoves?.length === 1 && pendingMoves[0].selection.skipIfOnlyOne)) {
      // if last option is forced and skippable, automove
      if (pendingMoves.length === 1) {
        const arg = pendingMoves[0].selection.isForced();
        if (arg === undefined) return;
        if (move) {
          return selectMove(pendingMoves[0], arg)
        } else {
          return selectMove(pendingMoves[0])
        }
      }
      if (!move) return;

      const player = game.players.atPosition(position);
      if (!player) return;

      // serialize now before we alter our state to ensure proper references
      const serializedMove: SerializedMove = {
        action: move.action,
        args: move.args.map(a => serializeArg(a))
      }

      const error = game.processMove({ player, ...move });
      selectMove();

      if (error) {
        console.error(error);
        setError(error);
      } else {
        console.log('success, submitting to server', move);
        moves.push((error: string) => console.error(`move ${move} failed: ${error}`));
        const message: MoveMessage = {
          type: "move",
          id: String(moves.length),
          data: serializedMove
        };
        window.top!.postMessage(message, "*");
      };
      updateBoard();
    }
  }, [game, position, move, pendingMoves]);

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

  return (
    <>
      {!game &&
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
      {game && <Game/>}
      {error && <div className="error">{error}</div>}
    </>
  );
}
