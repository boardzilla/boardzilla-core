import React from 'react';
import { gameStore } from '../../store.js';

import FlowDebug from './FlowDebug.js';
//import BoardDebug from './BoardDebug';

const Debug = () => {
  const [gameManager] = gameStore(s => [s.gameManager]);
  if (!gameManager) return null;

  return (
    <div id="debug-overlay" className="full-page-cover">
      <div id="flow-debug">
        <FlowDebug flow={gameManager.flow.visualize()} nest={0} current={true} />
      </div>
    </div>
  );
}

export default Debug;
