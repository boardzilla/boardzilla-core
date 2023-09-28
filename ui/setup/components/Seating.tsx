import React, { useState } from 'react';

import { times } from '../../../game';
import { GithubPicker } from 'react-color';

import type { User, UserPlayer, UnseatOperation, UpdateOperation, UpdatePlayersMessage } from '../../types';

const colors = ['#ff0000', '#ffa500', '#ffff00', '#008000', '#008b8b', '#0000ff', '#000080', '#4b0082', '#800080', '#cc82cc', '#800000'];

const Seating = ({ users, players, minPlayers, maxPlayers, onUpdatePlayers }: {
  users: User[],
  players: UserPlayer[],
  minPlayers: number,
  maxPlayers: number,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
}) => {
  const [pickingColor, setPickingColor] = useState<number>();

  const seatPlayer = (position: number, userID: string) => {
    const user = users.find(u => u.userID === userID);
    const unseats = players.filter(p => p.userID === userID && p.position !== position || p.userID !== userID && p.position === position);
    const usedColors = players.filter(p => p.userID !== userID && p.position !== position).map(p => p.color);
    const color = colors.find(c => !usedColors.includes(c))!;
    const operations: UpdatePlayersMessage['operations'] = unseats.map(u => (
      {type: 'unseat', position: u.position} as UnseatOperation
    ));
    if (user) operations.push({
      type: "seat",
      position,
      userID,
      color,
      name: user.userName,
      settings: {}
    });
    onUpdatePlayers(operations);
  }

  const updateColor = (position: number, color: string) => {
    setPickingColor(undefined);
    const operation: UpdateOperation = {
      type: "update",
      position,
      color,
    };
    onUpdatePlayers([operation]);
  }

  const playerAt = (position: number) => players.find(p => p.position === position);

  return (
    <div>
      {times(maxPlayers, p => {
        const player = playerAt(p);
        return (
          <div key={p}>
            Seat {p}:
            <select value={player?.userID || ""} onChange={e => seatPlayer(p, e.target.value)}>
              <option key="" value="">[empty]</option>
              {users.filter(u => (
                player?.userID === u.userID || !players.find(player => player.userID === u.userID)
              )).map(u => <option key={u.userID} value={u.userID}>{u.userName}</option>)}
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
