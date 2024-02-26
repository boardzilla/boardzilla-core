import React, { useCallback, useState } from 'react';
import { gameStore } from '../../index.js';

import { times } from '../../../index.js';
import * as ReactColor from 'react-color';
const { GithubPicker } = ReactColor;

import type { User, UpdateOperation, UpdatePlayersMessage, GameSettings } from '../../Main.js';

const colors = [
  '#d50000', '#00695c', '#304ffe', '#ff6f00', '#7c4dff',
  '#ffa825', '#f2d330', '#43a047', '#004d40', '#795a4f',
  '#00838f', '#408074', '#448aff', '#1a237e', '#ff4081',
  '#bf360c', '#4a148c', '#aa00ff', '#455a64', '#600020'];

const Seating = ({ users, players, minPlayers, maxPlayers, seatCount, onUpdatePlayers, onUpdateSettings }: {
  users: User[],
  players: User[],
  minPlayers: number,
  maxPlayers: number,
  seatCount: number,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
  onUpdateSettings: (update: {settings?: GameSettings, seatCount?: number}) => void,
}) => {
  const [userID, host] = gameStore(s => [s.userID, s.host]);

  const [pickingColor, setPickingColor] = useState<string>();

  const rename = (id: string) => {
    const user = users.find(u => u.id === id);
    updateName(id, prompt("Please enter a name", user?.name)!);
  }

  const seatPlayer = (position: number, id: string) => {
    const user = users.find(u => u.id === id);
    const unseats = players.filter(p => p.id === id && p.playerDetails?.position !== position || p.id !== id && p.playerDetails?.position === position);
    const usedColors = players.filter(p => p.id !== id && p.playerDetails?.position !== position).map(p => p.playerDetails?.color);
    const color = colors.find(c => !usedColors.includes(c))!;
    if (!host && unseats.some(u => u.id !== userID)) return;

    const operations: UpdatePlayersMessage['operations'] = unseats.map(u => (
      {type: 'unseat', userID: u.id}
    ));

    if (host || id === userID) {
      if (id === "__reserved__") {
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
          userID: id,
          color,
          name: user.name,
          settings: {}
        });
      }
    }

    onUpdatePlayers(operations);
  }

  const updateSeatCount = useCallback((count: number) => {
    if (count < seatCount) {
      // compress and unseat
      const openSeats = [];
      const operations: UpdatePlayersMessage['operations'] = [];
      for (let i = 1; i <= maxPlayers; i++) {
        const player = players.find(p => p.playerDetails?.position === i)
        if (!player) {
          openSeats.push(i)
          continue;
        }
        if (player.playerDetails!.position > count) {
          const openSeat = openSeats.shift();
          operations.push({
            type: "unseat",
            userID: player.id,
          });
          if (openSeat) {
            operations.push({
              type: "seat",
              position: openSeat,
              userID: player.id,
              color: player.playerDetails!.color,
              name: player.name,
              settings: player.playerDetails!.settings
            });
          }
        }
      }
      if (operations.length) onUpdatePlayers(operations);
    }
    onUpdateSettings({ seatCount: count });
  }, [players, seatCount, maxPlayers, onUpdatePlayers, onUpdateSettings]);

  const updateColor = (id: string, color: string) => {
    setPickingColor(undefined);
    if (host || userID === userID) {
      const operation: UpdateOperation = {
        type: "update",
        userID: id,
        color,
      };
      onUpdatePlayers([operation]);
    }
  }

  const updateName = (userID: string, name: string) => {
    setPickingColor(undefined);
    if (host || userID === userID) {
      const operation: UpdateOperation = {
        type: "update",
        userID,
        name,
      };
      onUpdatePlayers([operation]);
    }
  }

  return (
    <div id="seating">
      <div id="seats">
        {times(seatCount, position => {
          const player = players.find(p => p.playerDetails?.position === position);
          return (
            <div className="seat" key={position}>
              <select
                onDragOver={e => {e.preventDefault(); e.dataTransfer.dropEffect = "move";}}
                onDrop={e => seatPlayer(position, e.dataTransfer.getData('user'))}
                onMouseDown={e => {if (!host && !player) { seatPlayer(position, userID); e.preventDefault() }}}
                value={player?.id || ""}
                onChange={e => seatPlayer(position, e.target.value)}
                disabled={!host && !!player?.id && player.id !== userID}
                style={{backgroundColor: player?.playerDetails?.color ?? '#777' }}
              >
                {host ? (
                  <>
                    <option value="">&lt; open seat &gt;</option>
                    <option value="__reserved__">&lt; reserved seat &gt;</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </>
                ) : (
                  <>
                    {player && <option value={userID}>{player.name}</option>}
                    <option value={player ? "" : userID}>{player ? "Leave" : "Take"} seat</option>
                  </>
                )}
              </select>
              <img className="avatar" draggable="false" src={player?.avatar}/>
              {player?.playerDetails?.ready && (
                <div className="ready">
                  <svg
                    style={{ width: "1em", height: "1em", verticalAlign: "middle" }}
                    viewBox="6 67.9 186.4321 162.15454"
                    xmlns="http://www.w3.org/2000/svg">
                    <path
                      fill="white"
                      d="M 42.28231,151.11989 54.615405,137.92501 82.281381,165.23074 166.60288,80.72462 179.76669,93.460234 82.403825,191.2513 Z M 166.74023,67.9375 c -3.73465,0.213626 -6.80797,2.732338 -9.19962,5.406643 -25.1418,25.144854 -75.410864,75.447617 -75.410864,75.447617 0,0 -12.925652,-13.37758 -18.878454,-19.46105 -5.207137,-5.32143 -10.83206,-5.71583 -15.181836,-1.61638 -9.428935,8.8863 -12.799062,12.12205 -18.174773,17.52981 -3.357165,4.42946 -1.323396,11.19474 3.045917,14.50801 5.43149,5.25949 38.530367,38.10536 44.362134,42.93535 4.51311,2.40882 10.49591,0.77908 13.580078,-3.18164 33.285598,-33.30822 66.598618,-66.58763 99.808598,-99.970704 3.35229,-4.433164 2.15246,-11.363067 -2.22071,-14.675781 -5.48784,-5.292197 -10.5492,-11.056881 -16.51758,-15.828125 -1.61521,-0.783825 -3.41986,-1.153253 -5.21289,-1.09375 z"/>
                    <path
                      fill="white"
                      d="M 145.80384,159.26345 145.96457,217.8716 18.391257,218.17438 17.634302,94.790792 119.69127,94.656029 132.38874,83.012747 c -44.916615,-3.21e-4 -72.389143,-0.03695 -117.305271,0.09655 -5.5059748,0.758228 -9.5551878,6.511072 -8.8084528,11.943482 0.121623,7.559661 -0.285753,120.062201 0.42261,127.601201 1.487958,4.89455 6.8708358,7.97262 11.8523168,7.35281 47.088948,-0.016 83.755517,0.008 130.843917,-0.11463 5.50514,-0.76429 9.55692,-6.51288 8.80706,-11.94762 -0.0772,-4.25376 0.0436,-34.23704 0.0183,-71.67773"/>
                  </svg>
                </div>
              )}
              {player && !player.playerDetails?.ready && (host || player.id === userID) && (
                <>
                  <div
                    className="rename"
                    onClick={() => rename(player.id)}
                  >
                    <svg
                      style={{ width: "1em", height: "1em", verticalAlign: "middle" }}
                      viewBox="0 0 24 24">
                      <path d="M1 22C1 21.4477 1.44772 21 2 21H22C22.5523 21 23 21.4477 23 22C23 22.5523 22.5523 23 22 23H2C1.44772 23 1 22.5523 1 22Z" fill="white"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M18.3056 1.87868C17.1341 0.707107 15.2346 0.707107 14.063 1.87868L3.38904 12.5526C2.9856 12.9561 2.70557 13.4662 2.5818 14.0232L2.04903 16.4206C1.73147 17.8496 3.00627 19.1244 4.43526 18.8069L6.83272 18.2741C7.38969 18.1503 7.89981 17.8703 8.30325 17.4669L18.9772 6.79289C20.1488 5.62132 20.1488 3.72183 18.9772 2.55025L18.3056 1.87868ZM15.4772 3.29289C15.8677 2.90237 16.5009 2.90237 16.8914 3.29289L17.563 3.96447C17.9535 4.35499 17.9535 4.98816 17.563 5.37868L15.6414 7.30026L13.5556 5.21448L15.4772 3.29289ZM12.1414 6.62869L4.80325 13.9669C4.66877 14.1013 4.57543 14.2714 4.53417 14.457L4.0014 16.8545L6.39886 16.3217C6.58452 16.2805 6.75456 16.1871 6.88904 16.0526L14.2272 8.71448L12.1414 6.62869Z" fill="white"/>
                    </svg>
                  </div>
                  <div
                    className="palette"
                    onClick={() => setPickingColor(picking => picking === player.id ? undefined : player.id)}
                  >
                    <svg
                      style={{ width: "1em", height: "1em", verticalAlign: "middle" }}
                      viewBox="0 0 316.249 288.333"
                    >
                      <path
                        fill="none"
                        stroke="white"
                        strokeLinecap="butt"
                        strokeWidth="20.315"
                        d="M242.888 162.508c-.23 34.436-17.432 73.325-39.074 94.779-25.529 25.308-59.475 39.242-95.596 39.242h-.038c-38.707-.011-96.13-26.903-96.141-64.034-.006-19.707 10.354-27.388 21.323-35.52 10.253-7.602 21.874-16.218 21.87-34.474-.006-18.253-11.63-26.874-21.886-34.479-10.974-8.139-21.34-15.826-21.346-35.535-.005-22.801 16.674-35.674 33.463-45.882 19.175-13.376 43.273-18.094 62.615-18.094h.021c29.491.008 57.517 9.254 81.048 26.736 21.702 16.125 44.463 42.573 47.947 75.486m-51.614 94.679c-6.358 25.196-22.356 37.968-47.594 37.967h-.006c-6.655 0-13.028-.908-18.386-2.04 6.4-6.527 8.399-16.349 10.13-24.858 3.297-16.208 6.415-31.547 31.923-35.191zm61.496-99.637c2.998-2.602 5.977-5.171 8.913-7.675 29.847-25.455 45.489-36.533 53.468-41.354-4.765 8.027-15.741 23.788-41.021 53.906-23.785 28.337-58.77 69.69-82.47 93.885l-25.1-23.827c21.488-21.39 60.491-52.614 86.21-74.935v0"
                      ></path>
                      <circle
                        cx="78.341"
                        cy="95.328"
                        r="22.398"
                        fill="none"
                        stroke="white"
                        strokeWidth="20.315"
                      ></circle>
                      <circle
                        cx="128.659"
                        cy="132.169"
                        r="22.398"
                        fill="none"
                        stroke="white"
                        strokeWidth="20.315"
                        transform="translate(24.304 -35.741)"
                      ></circle>
                      <circle
                        cx="79.964"
                        cy="223.845"
                        r="22.398"
                        fill="none"
                        stroke="white"
                        strokeWidth="20.315"
                      ></circle>
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
        {host && seatCount < maxPlayers && (
          <svg
            className="addSeat"
            viewBox="-4.4276366 41.597518 239.72168 220.78024"
            xmlns="http://www.w3.org/2000/svg"
            onClick={() => updateSeatCount(seatCount + 1)}
          >
            <path
              style={{fill: 'white', stroke: 'black', strokeWidth: 26.4583, strokeLinecap: 'round', strokeLinejoin: 'round', paintOrder: 'stroke markers fill'}}
              d="m 105.68836,54.82669 20.19124,-5e-6 v 39.272268 l 39.32202,0.0606 -0.10104,20.077227 -39.22099,-0.0296 v 39.29772 l -20.19123,-1e-5 v -39.32986 l -39.17016,-0.0739 0.0094,-20.022317 39.16078,-0.1415 z" />
            <path
              style={{fill: 'white', stroke: 'black', strokeWidth: 26.4583, strokeLinecap: 'round', strokeLinejoin: 'round', paintOrder: 'stroke markers fill'}}
              d="M 115.43321,249.14914 8.8009906,142.51692 22.782624,128.29036 l 92.950586,91.87409 91.98988,-91.98987 14.34234,14.34234 z" />
          </svg>
        )}
        {host && seatCount > minPlayers && (
          <svg
            className="removeSeat"
            viewBox="-4.4276366 41.597518 239.72168 220.78024"
            xmlns="http://www.w3.org/2000/svg"
            onClick={() => updateSeatCount(seatCount - 1)}
          >
            <path
              style={{fill: 'white', stroke: 'black', strokeWidth: 26.4583, strokeLinecap: 'round', strokeLinejoin: 'round', paintOrder: 'stroke markers fill'}}
              d="m 65.664793,209.81572 0.10104,-20.07722 98.582377,0.13565 -0.009,20.02231 z" />
            <path
              style={{fill: 'white', stroke: 'black', strokeWidth: 26.4583, strokeLinecap: 'round', strokeLinejoin: 'round', paintOrder: 'stroke markers fill'}}
              d="M 115.4332,54.826137 222.06542,161.45836 208.08379,175.68492 115.1332,83.810827 23.143323,175.8007 8.8009825,161.45836 Z" />
          </svg>
        )}
      </div>
      <div id="lobby">
        <div>Waiting in lobby</div>
        <div id="users">
          {users.filter(u => !players.find(player => player.id === u.id)).map(
            u => (
              <div key={u.id} draggable={true} onDragStart={e => e.dataTransfer.setData('user', u.id)} className="user">
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
