import React, { useCallback } from 'react';
import Seating from './components/Seating.js';
import { gameStore } from '../index.js';

import { SetupComponentProps } from '../index.js';
import type { User, UserPlayer, UpdatePlayersMessage, GameSettings } from '../Main.js';

export default ({ users, players, minPlayers, maxPlayers, setupComponents, settings, onUpdatePlayers, onUpdateSelfPlayer, onUpdateSettings, onStart }: {
  users: User[],
  players: UserPlayer[],
  minPlayers: number,
  maxPlayers: number,
  setupComponents: Record<string, (p: SetupComponentProps) => JSX.Element>
  settings?: GameSettings,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
  onUpdateSelfPlayer: ({ color, name }: { color: string, name: string }) => void,
  onUpdateSettings: (s: GameSettings) => void,
  onStart: () => void,
}) => {
  const [host] = gameStore(s => [s.host]);

  const updateSettingsKey = useCallback((key: string, value: any) => {
    const newSettings = Object.assign(settings || {}, { [key]: value });
    onUpdateSettings(newSettings);
  }, [onUpdateSettings, settings])

  const settingsComponents = setupComponents ?
    Object.entries(setupComponents).map(([name, component]) => React.createElement(
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
      <div id="setup" className={host ? '' : 'disabled'}>
        <div id="seating">
          <Seating
            users={users}
            players={players}
            minPlayers={minPlayers}
            maxPlayers={maxPlayers}
            onUpdatePlayers={onUpdatePlayers}
            onUpdateSelfPlayer={onUpdateSelfPlayer}
          />
          <input type="button" className="start" disabled={(players?.length || 0) < minPlayers} value="Start Game" onClick={onStart}/>
        </div>
        <div id="settings">
          {settingsComponents}
        </div>
      </div>
    </>
  );
}
