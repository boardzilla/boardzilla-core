import React from 'react';
import type Flow from '../../../game/flow/flow';
import type { Player } from '../../../game/player';

export default ({flow}: { flow: Flow<Player> }) => {
  return (
    <div id="flow-debug">
      <div id="current">Currently on: "{flow.currentProcessor()?.toString()}"</div>
    </div>
  );
}
