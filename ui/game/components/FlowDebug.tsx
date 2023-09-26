import React from 'react';
import type Flow from '../../../game/flow/flow';

export default ({flow}: { flow: Flow }) => {
  return (
    <div id="flow-debug">
      <div id="current">Currently on: "{flow.currentStep().toString()}"</div>
    </div>
  );
}
