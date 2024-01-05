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

  const rename = (id: string) => {
    const user = users.find(u => u.id === id);
    updateName(id, prompt("Please enter a name", user?.name)!);
  }

  const seatPlayer = (position: number, userID: string) => {
    const user = users.find(u => u.id === userID);
    const unseats = players.filter(p => p.playerDetails?.position === position);
    const operations: UpdatePlayersMessage['operations'] = unseats.map(u => (
      {type: 'unseat', userID: u.id} as UnseatOperation
    ));
    const usedColors = players.filter(p => p.playerDetails?.position).map(p => p.playerDetails?.color);
    const color = colors.find(c => !usedColors.includes(c))!;

    if (userID === "reserve") {
      operations.push({
        type: "reserve",
        position,
        color,
        name: "Reserved",
        settings: {}
      });
    } else if (user) {
      operations.push({
        type: "seat",
        position,
        userID,
        color,
        name: user.name,
        settings: {}
      });
    }
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

  const updateName = (userID: string, name: string) => {
    setPickingColor(undefined);
    if (host) {
      const operation: UpdateOperation = {
        type: "update",
        userID,
        name,
      };
      onUpdatePlayers([operation]);
    } else {
      if (!players.find(p => p.id === userID)!.playerDetails) return
      onUpdateSelfPlayer({ name, color: players.find(p => p.id === userID)!.playerDetails!.color });
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
                <option key="reserve" value="reserve">&lt; reserve seat &gt;</option>
                {users.filter(u => (
                  player?.id === u.id || !players.find(player => player.id === u.id)
                )).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <img className="avatar" draggable="false" src={player?.avatar}/>
              {player && (host || player.id === userID) && (
                <>
                  <div
                    className="rename"
                    onClick={() => rename(player.id)}
                  >
                                        <svg
                      className="svg-icon"
                      style={{ width: "1em", height: "1em", verticalAlign: "middle" }}
                      viewBox="0 0 24 24">
                        <path d="M1 22C1 21.4477 1.44772 21 2 21H22C22.5523 21 23 21.4477 23 22C23 22.5523 22.5523 23 22 23H2C1.44772 23 1 22.5523 1 22Z" fill="#0F0F0F"/>
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M18.3056 1.87868C17.1341 0.707107 15.2346 0.707107 14.063 1.87868L3.38904 12.5526C2.9856 12.9561 2.70557 13.4662 2.5818 14.0232L2.04903 16.4206C1.73147 17.8496 3.00627 19.1244 4.43526 18.8069L6.83272 18.2741C7.38969 18.1503 7.89981 17.8703 8.30325 17.4669L18.9772 6.79289C20.1488 5.62132 20.1488 3.72183 18.9772 2.55025L18.3056 1.87868ZM15.4772 3.29289C15.8677 2.90237 16.5009 2.90237 16.8914 3.29289L17.563 3.96447C17.9535 4.35499 17.9535 4.98816 17.563 5.37868L15.6414 7.30026L13.5556 5.21448L15.4772 3.29289ZM12.1414 6.62869L4.80325 13.9669C4.66877 14.1013 4.57543 14.2714 4.53417 14.457L4.0014 16.8545L6.39886 16.3217C6.58452 16.2805 6.75456 16.1871 6.88904 16.0526L14.2272 8.71448L12.1414 6.62869Z" fill="#0F0F0F"/>
                    </svg>
                  </div>
                  <div
                    className="palette"
                    onClick={() => setPickingColor(picking => picking === player.id ? undefined : player.id)}
                  >
                    <svg
                      className="svg-icon"
                      style={{ width: "1em", height: "1em", verticalAlign: "middle" }}
                      viewBox="0 0 24 24">
                      <path d="M15.5 8.5H15.51M10.5 7.5H10.51M7.5 11.5H7.51M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 13.6569 19.6569 15 18 15H17.4C17.0284 15 16.8426 15 16.6871 15.0246C15.8313 15.1602 15.1602 15.8313 15.0246 16.6871C15 16.8426 15 17.0284 15 17.4V18C15 19.6569 13.6569 21 12 21ZM16 8.5C16 8.77614 15.7761 9 15.5 9C15.2239 9 15 8.77614 15 8.5C15 8.22386 15.2239 8 15.5 8C15.7761 8 16 8.22386 16 8.5ZM11 7.5C11 7.77614 10.7761 8 10.5 8C10.2239 8 10 7.77614 10 7.5C10 7.22386 10.2239 7 10.5 7C10.7761 7 11 7.22386 11 7.5ZM8 11.5C8 11.7761 7.77614 12 7.5 12C7.22386 12 7 11.7761 7 11.5C7 11.2239 7.22386 11 7.5 11C7.77614 11 8 11.2239 8 11.5Z" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
