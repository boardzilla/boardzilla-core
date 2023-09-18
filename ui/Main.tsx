import React, { useState, useEffect, useCallback } from 'react';
import { gameStore } from './';
import Game from './game/Game';
import Setup from './setup/Setup';

import type { User, SetupState, UpdateEvent, PlayerEvent, MessageProcessed } from './types';
import type { GameInterface } from 'boardzilla-game/types'
import type { Board } from 'boardzilla-game/board'
import type { Player } from 'boardzilla-game/player';

export default ({ gameInterface }: { gameInterface: GameInterface<Player, Board> }) => {
  const [game, setGame, updateBoard] = gameStore(s => [s.game, s.setGame, s.updateBoard]);
  const [setupState, setSetupState] = useState<SetupState>({players: [], settings: []});
  const [phase, setPhase] = useState('new');
  const [users, setUsers] = useState<User[]>([]);
  const [readySent, setReadySent] = useState<boolean>(false);

  const listener = (event: MessageEvent<UpdateEvent | PlayerEvent | MessageProcessed>) => {
    console.log('message', event);
    switch(event.data.type) {
    case 'update':
      console.log('update', !!game);
      const gameInstance = game || gameInterface.initialState({players: [], settings: {}}, false);
      if (event.data.phase === 'new') {
        setSetupState(event.data.state);
      } else {
        gameInstance.setState(event.data.state);
        setPhase('started');
        updateBoard();
      }
      if (!game) setGame(gameInstance);
      break;
    case 'player':
      const user = event.data.player;
      if (event.data.added) {
        setUsers(users => {
          if (users.find(p => p.id === user.id)) return users
          return [...users, user]
        });
      } else {
        setUsers((users) => users.filter(p => p.id === user.id))
      }
      break;
    }
  };

  useEffect(() => {
    window.addEventListener('message', listener, false)
    console.log('ready', readySent);
    if (!readySent) {
      window.top!.postMessage({type: "ready"}, "*");
      setReadySent(true);
    }
    return () => window.removeEventListener('message', listener)
  }, [])

  const update = (setupState: SetupState) => {
    console.log('update setupState', setupState);
    setSetupState(setupState);
    window.top!.postMessage({type: "setupUpdated", data: setupState}, "*");
  }

  return phase === 'new' ?
    <Setup users={users} setupState={setupState} onUpdate={update}/> :
    <Game/>
}
