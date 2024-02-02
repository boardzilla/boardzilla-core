import React, { useState } from 'react';
import { gameStore } from '../../index.js';

import FlowDebug from './FlowDebug.js';
//import BoardDebug from './BoardDebug';

const Debug = () => {
  const [game] = gameStore(s => [s.game]);
  if (!game) return null;

  return (
    <div id="debug-overlay">
      <div id="flow-debug">
        <FlowDebug flow={game.flow.visualize()} nest={0} current={true} />
      </div>
    </div>
  );
}

export default Debug;
