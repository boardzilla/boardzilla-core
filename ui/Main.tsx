import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gameStore } from './';
import Game from './game/Game';
import Setup from './setup/Setup';

import type {
  User,
  SetupState,
  SetupUpdateEvent,
  GameUpdateEvent,
  UserEvent,
  MessageProcessed,
  SetupUpdated,
  ReadyMessage,
  StartMessage,
  MoveMessage,
} from './types';
import type { Player } from '../game/player';
import type { Move, SerializedMove } from '../game/action/types';

export default () => {
  const [game, updateBoard] = gameStore(s => [s.game, s.updateBoard]);
  const [setupState, setSetupState] = useState<SetupState>({players: [], settings: []});
  const [phase, setPhase] = useState('new');
  const [users, setUsers] = useState<User[]>([]);
  const [readySent, setReadySent] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const moves = useMemo<((e: string) => void)[]>(() => [], []);

  const listener = useCallback((event: MessageEvent<string>) => {
    const data: SetupUpdateEvent | GameUpdateEvent | UserEvent | MessageProcessed = JSON.parse(event.data);
    console.log('message', event, data);
    switch(data.type) {
    case 'setupUpdate':
      if (!data.state) break;
      console.log('setup-update');
      setSetupState(data.state);
      break;
    case 'gameUpdate':
      if (!data.state) break;
      console.log('game-update');
      game.setState(data.state);
      console.log('game-updateBoard');
      updateBoard();
      setPhase('started');
      break;
    case 'user':
      const { id, name } = data;
      if (data.added) {
        setUsers(users => {
          if (users.find(p => p.id === id)) return users
          return [...users, { id, name }]
        });
      } else {
        setUsers((users) => users.filter(p => p.id !== id))
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

  const update = (setupState: SetupState) => {
    console.log('update setupState', setupState);
    setSetupState(setupState);
    const message: SetupUpdated = {type: "setupUpdated", data: setupState};
    window.top!.postMessage(message, "*");
  }

  const start = () => {
    console.log('start');
    const message: StartMessage = {type: "start", id: 'start', setup: setupState};
    window.top!.postMessage(message, "*");
  }

  const catchError = (error: string) => {
    if (!error) return
    alert(error);
    console.error(error);
    setError(error);
  }

  console.log('RENDER MAIN', phase);

  return <>
    {phase === 'new' ?
      <Setup users={users} setupState={setupState} onUpdate={update} onStart={start}/> :
      <Game onMove={move} onError={catchError}/>
    }
    {error && <div className="error">{error}</div>}
  </>
}
