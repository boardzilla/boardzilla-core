import React, { useCallback } from 'react';
import Seating from './components/Seating.js';
import { gameStore } from '../index.js';

import type { User, UserPlayer, UpdatePlayersMessage, GameSettings } from '../Main.js';

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

  const updateSettingsKey = useCallback((key: string, value: any) => {
    const newSettings = Object.assign(settings || {}, { [key]: value });
    onUpdateSettings(newSettings);
  }, [onUpdateSettings, settings])

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
      <div id="setup">
        <div id="seating">
          <Seating
            users={users}
            players={players}
            minPlayers={minPlayers}
            maxPlayers={maxPlayers}
            onUpdatePlayers={onUpdatePlayers}
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
