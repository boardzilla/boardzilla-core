import React from 'react';
import Seating from './components/Seating.js';
import { gameStore } from '../index.js';

import type { User, UserPlayer, UpdatePlayersMessage, GameSettings } from '../types.d.ts';

export default ({ users, players, minPlayers, maxPlayers, settings, onUpdatePlayers, onUpdateSettings, onStart }: {
  users: User[],
  players: UserPlayer[],
  minPlayers: number,
  maxPlayers: number,
  settings?: GameSettings,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
  onUpdateSettings: (s: GameSettings) => void,
  onStart: () => void,
}) => {
  const [game] = gameStore(s => [s.game]);

  const updateSettingsKey = (key: string, value: any) => {
    const newSettings = Object.assign(settings || {}, { [key]: value });
    onUpdateSettings(newSettings);
  }

  const settingsComponents = game.setupComponents ?
    Object.entries(game.setupComponents).map(([name, component]) => React.createElement(
      component,
      {
        name,
        key: name,
        settings: settings || {},
        players,
        updateKey: updateSettingsKey
      }
    )) : null;

  return (
    <>
      <Seating
        users={users}
        players={players}
        minPlayers={minPlayers}
        maxPlayers={maxPlayers}
        onUpdatePlayers={onUpdatePlayers}
      />
      {settingsComponents}
      <input type="button" disabled={(players?.length || 0) < minPlayers} value="Start" onClick={onStart}/>
    </>
  );
}
