import React from 'react';
import Seating from './components/Seating';
import { gameStore } from '../';

import type { User, SetupPlayer, SetupState } from '../types';

export default ({ users, setupState, onUpdate, onStart }: {
  users: User[],
  setupState: SetupState,
  onUpdate: ({ players, settings }: SetupState) => void,
  onStart: () => void,
}) => {
  const [game, uiOptions] = gameStore(s => [s.game, s.uiOptions]);

  if (!game) return null;

  const updateSettingsKey = (key: string, value: any) => {
    const newSettings = Object.assign(setupState.settings || {}, { [key]: value });
    console.log('postMessage', newSettings);
    onUpdate({
      players: setupState.players,
      settings: newSettings
    });
  }

  const updatePlayers = (players: SetupPlayer[]) => {
    console.log('postMessage', players);
    onUpdate({
      players,
      settings: setupState.settings
    });
  }

  const settingsComponents = uiOptions.settings ?
    Object.entries(uiOptions.settings).map(([name, component]) => React.createElement(
      component,
      {
        name,
        key: name,
        settings: setupState.settings,
        updateKey: updateSettingsKey
      }
    )) : null;

  return (
    <>
      <Seating users={users} players={setupState.players || []} onUpdate={updatePlayers}/>
      {settingsComponents}
      <input type="button" disabled={(setupState.players?.length || 0) < game.minPlayers} value="Start" onClick={onStart}/>
    </>
  );
}
