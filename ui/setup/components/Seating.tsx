import React, { useState } from 'react';

import { gameStore } from '../../';
import { times } from '../../../game';
import { GithubPicker } from 'react-color';

import type { User, SetupPlayer } from '../../types';

const colors = ['#ff0000', '#ffa500', '#ffff00', '#008000', '#008b8b', '#0000ff', '#000080', '#4b0082', '#800080', '#cc82cc', '#800000'];

const Seating = ({ users, players, onUpdate }: {
  users: User[],
  players: SetupPlayer[],
  onUpdate: (p: SetupPlayer[]) => void,
}) => {
  const [game] = gameStore(s => [s.game]);
  const [pickingColor, setPickingColor] = useState<number>();

  if (!game) return null;

  const updateSeat = (position: number, id: string) => {
    console.log('updateSeat', position, id);
    const user = users.find(u => u.id === id);
    const rest = players.filter(p => p.id !== id && p.position !== position);
    const usedColors = players.map(p => p.color);
    const color = colors.find(c => !usedColors.includes(c));
    if (user) rest.push({
      id,
      position,
      name: user.name,
      color,
      settings: {}
    });
    onUpdate(rest);
  }

  const updateColor = (position: number, color: string) => {
    setPickingColor(undefined);
    const player = playerAt(position);
    player.color = color;
    onUpdate([...players.filter(p => p !== player), player]);
  }

  const playerAt = (position: number) => players.find(p => p.position === position);

  return (
    <div>
      {times(game.maxPlayers, p => {
        const player = playerAt(p);
        return (
          <div key={p}>
            Seat {p}:
            <select value={player?.id || ""} onChange={e => updateSeat(p, e.target.value)}>
              <option key="" value="">[empty]</option>
              {users.filter(u => (
                player?.id === u.id || !players.find(player => player.id === u.id)
              )).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {player && (
              <>
                <div
                  style={{ display: 'inline-block', width: '12px', height: '12px', border: '1px solid #666', backgroundColor: player.color}}
                  onClick={() => setPickingColor(picking => picking === p ? undefined : p)}
                />
                {pickingColor === p && (
                  <GithubPicker
                    color={player.color}
                    colors={colors.filter(c => c === player.color || !players.map(p => p.color).includes(c))}
                    onChange={c => updateColor(p, c.hex)}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Seating;
