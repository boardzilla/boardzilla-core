import React, { useState } from 'react';
import { gameStore } from '../../index.js';

import { times } from '../../../index.js';
import * as ReactColor from 'react-color';
const { GithubPicker } = ReactColor;

import type { User, UserPlayer, UnseatOperation, UpdateOperation, UpdatePlayersMessage } from '../../Main.js';

const colors = [
  '#d50000', '#00695c', '#304ffe', '#ff6f00', '#7c4dff',
  '#ffa825', '#f2d330', '#43a047', '#004d40', '#795a4f',
  '#00838f', '#408074', '#448aff', '#1a237e', '#ff4081',
  '#bf360c', '#4a148c', '#aa00ff', '#455a64', '#600020'];

const Seating = ({ users, players, maxPlayers, onUpdatePlayers, onUpdateSelfPlayer }: {
  users: User[],
  players: UserPlayer[],
  minPlayers: number,
  maxPlayers: number,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
  onUpdateSelfPlayer: ({ color, name }: { color: string, name: string }) => void,
}) => {
  const [userID, host] = gameStore(s => [s.userID, s.host]);

  const [pickingColor, setPickingColor] = useState<number>();

  const seatPlayer = (position: number, userID: string) => {
    const user = users.find(u => u.id === userID);
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
      name: user.name,
      settings: {}
    });
    onUpdatePlayers(operations);
  }

  const updateColor = (position: number, color: string) => {
    setPickingColor(undefined);
    if (host) {
      const operation: UpdateOperation = {
        type: "update",
        position,
        color,
      };
      onUpdatePlayers([operation]);
    } else {
      onUpdateSelfPlayer({ color, name: playerAt(position)!.name });
    }
  }

  const playerAt = (position: number) => players.find(p => p.position === position);

  return (
    <>
      {times(maxPlayers, p => {
        const player = playerAt(p);
        return (
          <div className="seat" key={p}>
            <select value={player?.userID || ""} onChange={e => seatPlayer(p, e.target.value)} style={{backgroundColor: player?.color || '#888' }}>
              <option key="" value="">&lt; open seat &gt;</option>
              {users.filter(u => (
                player?.userID === u.id || !players.find(player => player.userID === u.id)
              )).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {player && (host || player.userID === userID) && (
              <>
                <div
                  className="pencil"
                  onClick={() => setPickingColor(picking => picking === p ? undefined : p)}
                >
                  <svg
                    className="svg-icon"
                    style={{ width: "1em", height: "1em", verticalAlign: "middle" }}
                    viewBox="0 0 1024 1024"
                  >
                    <path
                      fill="#fff"
                      fillOpacity="1"
                      d="M922.857 0q40 0 70 26.571t30 66.572q0 36-25.714 86.286-189.714 359.428-265.714 429.714-55.429 52-124.572 52-72 0-123.714-52.857t-51.714-125.429q0-73.143 52.571-121.143L848.571 30.857Q882.286 0 922.857 0zM403.43 590.857q22.285 43.429 60.857 74.286t86 43.428l.571 40.572q2.286 121.714-74 198.286T277.714 1024q-70.285 0-124.571-26.571T66 924.57 16.571 820 0 694.286q4 2.857 23.429 17.143t35.428 25.428 33.714 20.857 26.286 9.715q23.429 0 31.429-21.143Q164.57 708.57 183.143 682t39.714-43.429 50.286-27.142T332 596.857t71.429-6z"
                    ></path>
                  </svg>
                </div>
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
    </>
  );
};

export default Seating;
