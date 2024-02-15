import React from 'react';
import { gameStore } from '../../index.js';
import ActionForm from './ActionForm.js';

import type { Player } from '../../../player/index.js';
import type { UIMove } from '../../lib.js';
import type { Argument } from '../../../action/action.js';

const PlayerControls = ({onSubmit}: {
  onSubmit: (move?: UIMove, args?: Record<string, Argument<Player>>) => void,
}) => {
  const [position, controls, boardPrompt, selected, move] = gameStore(s => [s.position, s.controls, s.boardPrompt, s.selected, s.move]);

  if (!position || !controls) return null;
  if ((!boardPrompt && controls.moves.length === 0 && !move && selected.length === 0 || boardPrompt === '__missing__') && controls.name !== 'disambiguate-board-selection') return null;

  return (
    <div key={controls.name} className={`player-controls ${controls.name.replace(":", "-")}`} style={controls.style}>

      {boardPrompt && <div className="prompt">{boardPrompt}</div>}

      {controls.moves.map(pendingMove => (
        <ActionForm
          key={pendingMove.name + pendingMove.selections[0]?.prompt}
          move={pendingMove}
          stepName={controls.name}
          onSubmit={onSubmit}>
          {!boardPrompt && pendingMove.prompt && pendingMove.prompt}
        </ActionForm>
      ))}

      {(move || selected.length > 0 || controls.name === 'disambiguate-board-selection') && (
        <button onClick={() => onSubmit()}>Cancel</button>
      )}
    </div>
  )
};

export default PlayerControls;
