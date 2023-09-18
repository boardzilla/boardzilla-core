import React from 'react';
import type Flow from '../../../game/flow/flow';
import { gameStore } from '../../';

export default ({flow}: { flow: Flow }) => {
  const [updateBoard, autoplay, toggleAutoplay] = gameStore(s => [s.updateBoard, s.autoplay, s.toggleAutoplay, s.boardJSON]);

  return (
    <div id="flow-debug">
      <div id="current">Currently on: "{flow.currentStep().toString()}"</div>
      {autoplay || <>
        <button onClick={() => { flow.playOneStep(); updateBoard() }}>Step</button>
        <button onClick={() => { flow.play(); updateBoard() }}>Play</button>
      </>}
      <input type="checkbox" checked={autoplay} onChange={toggleAutoplay}/> Auto-play
    </div>
  );
}
