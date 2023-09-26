import React from 'react';
import Seating from './components/Seating';
import { gameStore } from '../';

import type { User, UserPlayer, UpdatePlayersMessage, GameSettings } from '../types';

export default ({ users, players, settings, onUpdatePlayers, onUpdateSettings, onStart }: {
  users: User[],
  players: UserPlayer[],
  settings?: GameSettings,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
  onUpdateSettings: (s: GameSettings) => void,
  onStart: () => void,
}) => {
  const [uiOptions] = gameStore(s => [s.uiOptions]);

  const updateSettingsKey = (key: string, value: any) => {
    const newSettings = Object.assign(settings || {}, { [key]: value });
    console.log('postMessage', newSettings);
    onUpdateSettings(newSettings);
  }

  const settingsComponents = uiOptions.settings ?
    Object.entries(uiOptions.settings).map(([name, component]) => React.createElement(
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
        onUpdatePlayers={onUpdatePlayers}
      />
      {settingsComponents}
      <input type="button" disabled={(players?.length || 0) < 1} value="Start" onClick={onStart}/>
    </>
  );
}
