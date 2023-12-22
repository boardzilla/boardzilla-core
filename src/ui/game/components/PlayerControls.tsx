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

  const boardPrompt = useMemo(() => {
    if (name === 'step:out-of-turn') return `${game.players.current().map(p => p.name).join(' ,')} is taking their turn`;

    // all prompts from all board moves, using the most specific selection that applies
    const prompts: string[] = [];
    for (const m of moves) {
      for (const s of m.selections) if (s.type === 'board' && (s.prompt ?? m.prompt)) prompts.push(s.prompt ?? m.prompt!);
    }

    // if only one, use that, otherwise use the step prompt
    return new Set(prompts).size === 1 ? prompts[0] : prompt;
  }, [moves, game.players, name, prompt]);

  //const boardID = useMemo(() => boardPrompt ? moves.find(m => m.selections.find(s => s.prompt === boardPrompt))?.action : '', [moves, boardPrompt]);

  if (!position) return null;
  if (!boardPrompt && moves.length === 0 && !move && selected.length === 0 && name !== 'disambiguate-board-selection') return null;

  return (
    <div key={name} className={`player-controls ${name.replace(":", "-")}`} style={style}>

      {boardPrompt && <div className="prompt">{boardPrompt}</div>}

      {moves.map(pendingMove => <ActionForm key={pendingMove.name + pendingMove.selections[0]?.prompt} move={pendingMove} stepName={name} onSubmit={onSubmit}/>)}

      {(move || selected.length > 0 || name === 'disambiguate-board-selection') && <button onClick={() => onSubmit()}>Cancel</button>}
    </div>
  )
};

export default PlayerControls;
