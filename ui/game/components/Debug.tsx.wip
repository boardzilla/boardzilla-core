import React, { useState } from 'react';
import { gameStore } from '../../';

import FlowDebug from './FlowDebug';
import BoardDebug from './BoardDebug';

export default () => {
  const [game] = gameStore(s => [s.game, s.boardJSON]);
  if (!game) return null;

  return (
    <div id="debug-console">
      <div>
        Player turn: {game.players.currentPosition ? `#${game.players.currentPosition}: ${game.players.current()?.name}` : 'any'}
      </div>
      <FlowDebug flow={game.flow} />
      <BoardDebug />
    </div>
  );
}
