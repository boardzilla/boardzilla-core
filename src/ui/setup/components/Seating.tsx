import React, { useState } from 'react';
import { gameStore } from '../../index.js';

import { times } from '../../../index.js';
import * as ReactColor from 'react-color';
const { GithubPicker } = ReactColor;

import type { User, UnseatOperation, UpdateOperation, UpdatePlayersMessage } from '../../Main.js';

const colors = [
  '#d50000', '#00695c', '#304ffe', '#ff6f00', '#7c4dff',
  '#ffa825', '#f2d330', '#43a047', '#004d40', '#795a4f',
  '#00838f', '#408074', '#448aff', '#1a237e', '#ff4081',
  '#bf360c', '#4a148c', '#aa00ff', '#455a64', '#600020'];

const Seating = ({ users, players, maxPlayers, onUpdatePlayers, onUpdateSelfPlayer }: {
  users: User[],
  players: User[],
  minPlayers: number,
  maxPlayers: number,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
  onUpdateSelfPlayer: ({ color, name }: { color: string, name: string }) => void,
}) => {
  const [userID, host] = gameStore(s => [s.userID, s.host]);

  const [pickingColor, setPickingColor] = useState<string>();

  const seatPlayer = (position: number, userID: string) => {
    const user = users.find(u => u.id === userID);
    const unseats = players.filter(p => p.id === userID && p.playerDetails?.position !== position || p.id !== userID && p.playerDetails?.position === position);
    const usedColors = players.filter(p => p.id !== userID && p.playerDetails?.position !== position).map(p => p.playerDetails?.color);
    const color = colors.find(c => !usedColors.includes(c))!;
    const operations: UpdatePlayersMessage['operations'] = unseats.map(u => (
      {type: 'unseat', userID: u.id} as UnseatOperation
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

  const updateColor = (userID: string, color: string) => {
    setPickingColor(undefined);
    if (host) {
      const operation: UpdateOperation = {
        type: "update",
        userID,
        color,
      };
      onUpdatePlayers([operation]);
    } else {
      onUpdateSelfPlayer({ color, name: players.find(p => p.id === userID)!.name });
    }
  }

  return (
    <div id="seating">
      <div id="seats">
        {times(maxPlayers, position => {
          const player = players.find(p => p.playerDetails?.position === position);
          return (
            <div className="seat" key={position}>
              <select
                onDragOver={e => {e.preventDefault(); e.dataTransfer.dropEffect = "move";}}
                onDrop={e => seatPlayer(position, e.dataTransfer.getData('user'))}
                value={player?.id || ""}
                onChange={e => seatPlayer(position, e.target.value)}
                style={{backgroundColor: player?.playerDetails?.color }}
              >
                <option key="" value="">&lt; open seat &gt;</option>
                {users.filter(u => (
                  player?.id === u.id || !players.find(player => player.id === u.id)
                )).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <img className="avatar" draggable="false" src={player?.avatar}/>
              {player && (host || player.id === userID) && (
                <>
                  <div
                    className="pencil"
                    onClick={() => setPickingColor(picking => picking === player.id ? undefined : player.id)}
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
                  {pickingColor === player.id && (
                    <GithubPicker
                      color={player.playerDetails?.color}
                      colors={colors.filter(c => c === player.playerDetails?.color || !players.map(p => p.playerDetails?.color).includes(c))}
                      onChange={c => updateColor(player.id, c.hex)}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div id="lobby">
        <div>Waiting in lobby</div>
        <div id="users">
          {users.filter(u => !players.find(player => player.id === u.id)).map(
            u => (
              <div key={u.id} draggable="true" onDragStart={e => e.dataTransfer.setData('user', u.id)} className="user">
                <img draggable="false" src={u.avatar}/>{u.name}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Seating;
