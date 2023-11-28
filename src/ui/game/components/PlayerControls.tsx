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
  const [game, position, prompt, selected, move] = gameStore(s => [s.game, s.position, s.prompt, s.selected, s.move]);

  // all prompts from all board moves, using the most specific selection that applies
  const boardPrompts = useMemo(() => {
    const prompts = [];
    for (const m of moves) {
      for (const s of m.selections) if (s.type === 'board' && (s.prompt ?? m.prompt)) prompts.push(s.prompt ?? m.prompt!);
    }
    return prompts;
  }, [moves]);

  // if only one, use that, otherwise use the step prompt
  const boardPrompt = useMemo(() => new Set(boardPrompts).size === 1 ? boardPrompts[0] : prompt, [prompt, boardPrompts]);
  //const boardID = useMemo(() => boardPrompt ? moves.find(m => m.selections.find(s => s.prompt === boardPrompt))?.action : '', [moves, boardPrompt]);

  if (!position) return null;

  return (
    <div key={name} className={`player-controls ${name.replace(":", "-")}`} style={style}>

      {name === 'step:out-of-turn' && (
        `${game.players.current().map(p => p.name).join(' ,')} is taking their turn`
      )}

      {boardPrompt && <div className="prompt">{boardPrompt}</div>}

      {moves.map(pendingMove => <ActionForm key={pendingMove.name + pendingMove.selections[0]?.prompt} move={pendingMove} stepName={name} onSubmit={onSubmit}/>)}

      {(move || selected.length > 0 || name === 'disambiguate-board-selection') && <button onClick={() => onSubmit()}>Cancel</button>}
    </div>
  )
};

export default PlayerControls;
