import React from 'react';

import { Player } from '../../../index.js';
import { gameStore } from '../../index.js';

type PlayerInfoProps = {
  player: Player
}

export function PlayerInfo({player}: PlayerInfoProps) {
  const [userOnline] = gameStore(s => [s.userOnline]);
  const online = userOnline.has(player.id)
  return (
    <div className="player-info" style={{backgroundColor: player.color}}>
      <img className={online ? "online" : "offline"} src={player.avatar} /> <div className="player-name">{player.name}</div>
    </div>
  );
}

