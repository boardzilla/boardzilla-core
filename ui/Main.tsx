import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gameStore } from './';
import Game from './game/Game';
import Setup from './setup/Setup';
import type { SetupFunction } from '../game/types'
import type { Player } from '../game'
import type { Board } from '../game/board'
import { serializeArg } from '../game/action/utils';

import type {
  User,
  UserPlayer,
  GameSettings,
  GameUpdateEvent,
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

export default ({ userID, minPlayers, maxPlayers, setup }: {
  userID: string,
  minPlayers: number,
  maxPlayers: number,
  setup: SetupFunction<Player, Board<Player>>
}) => {
  const [game, setGame, move, selectMove, pendingMoves, position, setPosition, updateBoard] = gameStore(s => [s.game, s.setGame, s.move, s.selectMove, s.pendingMoves, s.position, s.setPosition, s.updateBoard]);
  const [players, setPlayers] = useState<UserPlayer[]>([]);
  const [settings, setSettings] = useState<GameSettings>();
  const [phase, setPhase] = useState<string>();
  const [users, setUsers] = useState<User[]>([]);
  const [readySent, setReadySent] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const moves = useMemo<((e: string) => void)[]>(() => [], []);

  const listener = useCallback((event: MessageEvent<
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
      setUsers(data.users);
      break;
    case 'gameUpdate':
      //console.log('game-update', phase);
      let newGame;
      if (!game) {
        newGame = setup(data.state.state, true);
      } else {
        game.setState(data.state.state);
        newGame = game;
      }
      if (!position) setPosition(data.state.position)
      if (newGame !== game) setGame(newGame);
      updateBoard(data.state.state.board);

      setPhase('started'); // set phase last to render the game
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
      // TODO where does this go
      // if (selection?.type === 'board' && (selection.min !== undefined || selection.max !== undefined)) move.args.push(selected);

      const player = game.players.atPosition(position);
      if (!player) return;

      // serialize now before we alter our state to ensure proper references
      const serializedMove: SerializedMove = {
        action: move.action,
        args: move.args.map(a => serializeArg(a))
      }

      console.log('processable move attempt', move);
      const error = game.processMove({ player, ...move });
      selectMove();
      updateBoard();

      if (error) {
        console.error(error);
        setError(error);
      } else {
        console.log('success, submitting to server');
        moves.push((error: string) => console.error(`move ${move} failed: ${error}`));
        const message: MoveMessage = {
          type: "move",
          id: String(moves.length),
          data: serializedMove
        };
        window.top!.postMessage(message, "*");
      };
    }
  }, [game, position, move, pendingMoves]);

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

  return (
    <>
      {phase === 'new' &&
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
      {phase === 'started' && <Game/>}
      {error && <div className="error">{error}</div>}
    </>
  );
}
