import React from 'react';
import { gameStore } from '../../index.js';
import ActionForm from './ActionForm.js';

import type { Player } from '../../../player/index.js';
import type { UIMove } from '../../lib.js';
import type { Argument } from '../../../action/action.js';

const PlayerControls = ({onSubmit}: {
  onSubmit: (move?: UIMove, args?: Record<string, Argument<Player>>) => void,
}) => {
  const [position, controls, boardPrompt, error, disambiguateElement, cancellable] = gameStore(s => [s.position, s.controls, s.boardPrompt, s.error, s.disambiguateElement, s.cancellable]);

  if (!position || !controls) return null;
  if (!boardPrompt && controls.moves.length === 0) return null;

  let visibleAction = !!boardPrompt;

  return (
    <div key={controls.name} className={`player-controls ${controls.name.replace(":", "-")}`} style={controls.style}>

      {boardPrompt && <div className="prompt">{boardPrompt === '__missing__' ? 'Your move' : boardPrompt}</div>}

      {controls.moves.map((pendingMove, i) => {
        let actionDivider = false;
        if (!disambiguateElement && (pendingMove.prompt || !pendingMove.selections[0]?.isBoardChoice())) {
          actionDivider = visibleAction;
          visibleAction = true;
        }
        return (
          <React.Fragment key={i}>
            {actionDivider && <div className="action-divider">or</div>}
            <ActionForm
              move={pendingMove}
              stepName={controls.name}
              onSubmit={onSubmit}
            />
          </React.Fragment>
        );
      })}

      {error && <div className="error">{error}</div>}

      {(cancellable || disambiguateElement) && (
        <>
          {visibleAction && <div className="action-divider">or</div>}
          <button className="cancel" onClick={() => onSubmit()}>Cancel</button>
        </>
      )}
    </div>
  )
};

export default PlayerControls;
