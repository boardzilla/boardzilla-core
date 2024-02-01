import React, { useMemo } from 'react';
import { gameStore } from '../../index.js';
import ActionForm from './ActionForm.js';

import type { Player } from '../../../player/index.js';
import type { UIMove } from '../../index.js';
import type { Argument } from '../../../action/action.js';

const PlayerControls = ({name, style, moves, onSubmit}: {
  name: string,
  style: React.CSSProperties,
  moves: UIMove[],
  onSubmit: (move?: UIMove, args?: Record<string, Argument<Player>>) => void,
}) => {
  const [position, prompt, actionDescription, step, selected, move] = gameStore(s => [s.position, s.prompt, s.actionDescription, s.step, s.selected, s.move]);

  const boardPrompt = useMemo(() => {
    // all prompts from all board moves, using the most specific selection that applies
    let hasNonBoardMoves = false;
    const prompts: string[] = [];
    for (const m of moves) {
      for (const s of m.selections) {
        if (s.type === 'board') {
          if (s.prompt ?? m.prompt) prompts.push(s.prompt ?? m.prompt!);
        } else {
          hasNonBoardMoves = true;
        }
      }
    }

    // if only one, use that, otherwise use the step prompt
    if (new Set(prompts).size > 1) {
      if (!prompt) console.error(`Multiple action prompts apply (${moves.map(m => m.name).join(', ')}). Add a step prompt ${step ? `on "${step}"` : 'here'} to clarify.`)
      return prompt;
    }
    if (prompts.length > 0) return prompts[0];
    if (prompt) return prompt;
    if (actionDescription && !hasNonBoardMoves) return actionDescription;
    if (moves.length && !hasNonBoardMoves) {
      console.error(`No prompts defined for board actions (${moves.map(m => m.name).join(', ')}). Add an action prompt or step prompt here.`);
      return '__missing__';
    }
  }, [moves, step, prompt, actionDescription]);

  //const boardID = useMemo(() => boardPrompt ? moves.find(m => m.selections.find(s => s.prompt === boardPrompt))?.action : '', [moves, boardPrompt]);

  if (!position) return null;
  if ((!boardPrompt && moves.length === 0 && !move && selected.length === 0 || boardPrompt === '__missing__') && name !== 'disambiguate-board-selection') return null;

  return (
    <div key={name} className={`player-controls ${name.replace(":", "-")}`} style={style}>

      {boardPrompt && <div className="prompt">{boardPrompt}</div>}

      {moves.map(pendingMove => (
        <ActionForm
          key={pendingMove.name + pendingMove.selections[0]?.prompt}
          move={pendingMove}
          stepName={name}
          onSubmit={onSubmit}>
          {!boardPrompt && pendingMove.prompt && pendingMove.prompt}
        </ActionForm>
      ))}

      {(move || selected.length > 0 || name === 'disambiguate-board-selection') && <button onClick={() => onSubmit()}>Cancel</button>}
    </div>
  )
};

export default PlayerControls;
