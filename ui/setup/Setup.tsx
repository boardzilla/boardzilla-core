import React from 'react';
import Seating from './components/Seating';
import { gameStore } from '../';

import type { User, SetupPlayer, SetupState } from '../types';

export default ({ users, setupState, onUpdate }: {
  users: User[],
  setupState: SetupState,
  onUpdate: ({ players, settings }: SetupState) => void,
}) => {
  const [uiOptions] = gameStore(s => [s.uiOptions]);

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
    </>
  );
}
