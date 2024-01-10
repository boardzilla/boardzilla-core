import React from 'react';

import { Player } from '../../../index.js';
import { gameStore } from '../../index.js';
import classNames from 'classnames';

type ProfileBadgeProps = {
  player: Player
}

export function ProfileBadge({player}: ProfileBadgeProps) {
  const [userOnline] = gameStore(s => [s.userOnline, s.boardJSON]);
  const online = true ; // userOnline.has(player.id)
  return (
    <div className={classNames("profile-badge", {online, current: player.isCurrent()})} style={{backgroundColor: player.color}}>
      <div className="avatar"><img src={player.avatar} /></div>
      <div className="player-name">
        <div className="player-name-container">
          <div>{player.name}</div>
        </div>
      </div>
    </div>
  );
}
