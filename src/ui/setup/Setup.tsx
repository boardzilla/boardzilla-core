import React, { useCallback, useMemo } from 'react';
import Seating from './components/Seating.js';
import { gameStore } from '../index.js';

import { SetupComponentProps } from '../index.js';
import type { User, UpdatePlayersMessage, GameSettings } from '../Main.js';

export default ({ users, players, minPlayers, maxPlayers, setupComponents, settings, seatCount, onUpdatePlayers, onUpdateSelfPlayer, onUpdateSettings }: {
  users: User[],
  players: User[],
  minPlayers: number,
  maxPlayers: number,
  setupComponents: Record<string, (p: SetupComponentProps) => JSX.Element>
  settings?: GameSettings,
  seatCount: number,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
  onUpdateSelfPlayer: ({ color, name, ready }: { color?: string, name?: string, ready?: boolean }) => void,
  onUpdateSettings: (update: {settings?: GameSettings, seatCount?: number}) => void,
}) => {
  const [userID, host] = gameStore(s => [s.userID, s.host]);

  const self = useMemo(() => players.find(p => p.id === userID), [players, userID]);
  console.log(self, userID, players);

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
          {host && (
            <>
              <p>Use the invite link above to get other players to join.</p>
              {players.length < seatCount && <p>The game will start once <b>{seatCount}</b> players are seated and ready.</p>}
              {players.length === seatCount && <p>Waiting for {players.filter(p => !p.playerDetails?.ready).map(p => p === self ? 'You' : p.name).reduce((s, p, i, t) => s + (s ? (i === t.length -1 ? ' and ' : ', ') : '') + p, '')}.</p>}
            </>
          )}
          {!host && <h3>Waiting for host to start game...</h3>}
        </div>
        <Seating
          users={users}
          players={players}
          minPlayers={minPlayers}
          maxPlayers={maxPlayers}
          seatCount={seatCount}
          onUpdatePlayers={onUpdatePlayers}
          onUpdateSelfPlayer={onUpdateSelfPlayer}
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
            onClick={() => onUpdateSelfPlayer({ready: !self.playerDetails?.ready})}
          >
            {self.playerDetails?.ready ? "Wait, I'm not ready" : "I'm ready" }
          </button>
        )}
      </div>
    </div>
  );
}
