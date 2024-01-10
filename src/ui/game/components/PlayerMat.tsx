import React from 'react';

import { Player } from '../../../index.js';
// import { gameStore } from '../../index.js';

type PlayerMatProps = {
  player: Player
}

export function PlayerMat({player}: PlayerMatProps) {
  // const [userOnline] = gameStore(s => [s.userOnline]);
  const online = true; //userOnline.has(player.id)
  return (
    <div className="player-mat" style={{backgroundColor: player.color}}>
      <div className={`avatar ${online ? "online" : "offline"}`}><img src={player.avatar} /></div>
      <div className="player-name">{player.name}</div>
    </div>
  );
}

