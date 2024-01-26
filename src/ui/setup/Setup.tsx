import React, { useCallback } from 'react';
import Seating from './components/Seating.js';
import { gameStore } from '../index.js';

import { SetupComponentProps } from '../index.js';
import type { User, UpdatePlayersMessage, GameSettings } from '../Main.js';

export default ({ users, players, minPlayers, maxPlayers, setupComponents, settings, onUpdatePlayers, onUpdateSelfPlayer, onUpdateSettings, onStart }: {
  users: User[],
  players: User[],
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
    )) : [];

  return (
    <div id="setup">
      <div id="background"/>
      <div className={host ? '' : 'disabled'}>
        <div className="heading">
          <h1>Game Setup</h1>
          {host && <p>Select the open seats to seat yourself and your players at the table. Use the invite link above to get other players to join. They will be in the lobby until seated.</p>}
          {!host && <h3>Waiting for host to start game...</h3>}
        </div>
        <Seating
          users={users}
          players={players}
          minPlayers={minPlayers}
          maxPlayers={maxPlayers}
          onUpdatePlayers={onUpdatePlayers}
          onUpdateSelfPlayer={onUpdateSelfPlayer}
        />
        {settingsComponents.length > 0 && (
          <div className="heading">
            <h2>Game Settings</h2>
            <div id="settings">
              {settingsComponents}
            </div>
          </div>
        )}
        {host && <input type="button" className="start" disabled={(players?.length || 0) < minPlayers} value={(players?.length || 0) < minPlayers ? "Waiting for enough players" : "Start Game"} onClick={onStart}/>}
      </div>
    </div>
  );
}
