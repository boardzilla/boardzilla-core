import React, { useCallback, useMemo } from 'react';
import Seating from './components/Seating.js';
import { gameStore } from '../store.js';

import { SetupComponentProps } from '../index.js';
import type { User, UpdatePlayersMessage, GameSettings } from '../Main.js';

export default ({ users, players, minPlayers, maxPlayers, setupComponents, settings, seatCount, onUpdatePlayers, onUpdateSettings }: {
  users: User[],
  players: User[],
  minPlayers: number,
  maxPlayers: number,
  setupComponents: Record<string, (p: SetupComponentProps) => JSX.Element>
  settings?: GameSettings,
  seatCount: number,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
  onUpdateSettings: (update: {settings?: GameSettings, seatCount?: number}) => void,
}) => {
  const [userID, host] = gameStore(s => [s.userID, s.host]);

  const self = useMemo(() => players.find(p => p.id === userID), [players, userID]);

  const updateSettingsKey = useCallback((key: string, value: any) => {
    onUpdateSettings({settings: { ...settings, [key]: value }});
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
      <div id="background" className="full-page-cover"/>
      <div className={host ? '' : 'disabled'}>
        <div className="heading">
          <h1>Game Setup</h1>
          {host && <p>Use the invite link above to get other players to join.</p>}
          {players.length < seatCount && <p>The game will start once <b>{seatCount}</b> players are seated and ready.</p>}
          {players.length === seatCount && players.some(p => !p.playerDetails?.ready) && <p>Waiting for {players.filter(p => !p.playerDetails?.ready).map(p => p === self ? 'you' : p.name).reduce((s, p, i, t) => s + (s ? (i === t.length -1 ? ' and ' : ', ') : '') + p, '')} to start.</p>}
        </div>
        <Seating
          users={users}
          players={players}
          minPlayers={minPlayers}
          maxPlayers={maxPlayers}
          seatCount={seatCount}
          onUpdatePlayers={onUpdatePlayers}
          onUpdateSettings={onUpdateSettings}
        />
        {settingsComponents.length > 0 && (
          <div className="heading">
            <h2>Game Settings</h2>
            <div id="settings">
              {settingsComponents}
            </div>
          </div>
        )}
        {self && (
          <button
            type="button"
            className="ready"
            onClick={() => onUpdatePlayers([{type: 'update', userID, ready: !self.playerDetails?.ready}])}
          >
            {self.playerDetails?.ready ? "Wait, I'm not ready" : (players.length === seatCount && players.filter(p => !p.playerDetails?.ready).length === 1 ? "Start game" : "I'm ready") }
          </button>
        )}
      </div>
    </div>
  );
}
