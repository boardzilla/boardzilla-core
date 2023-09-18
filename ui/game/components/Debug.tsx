import React, { useState } from 'react';
import { gameStore } from '../../';

import FlowDebug from './FlowDebug';
import BoardDebug from './BoardDebug';

export default () => {
  const [game, player, setPlayer] = gameStore(s => [s.game, s.player, s.setPlayer, s.boardJSON]);
  if (!game) return null;

  return (
    <div id="debug-console">
      <div>
        Player UI: #{player?.position}: {player?.name}
        <select value={player?.position} onChange={e => setPlayer(parseInt(e.target.value))}>
          { game.players.map(p => (
            <option
              key={p.position}
              value={p.position}
            >{p.name}</option>
          ))}
          <option key="0" value={0}>God mode</option>
        </select>
      </div>
      <div>
        Player turn: {game.players.currentPosition ? `#${game.players.currentPosition}: ${game.players.current()?.name}` : 'any'}
      </div>
      <FlowDebug flow={game.flow} />
      <BoardDebug />
    </div>
  );
}
