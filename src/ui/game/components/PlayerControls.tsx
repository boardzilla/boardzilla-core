import React, { useMemo } from 'react';
import { gameStore } from '../../index.js';
import ActionForm from './ActionForm.js';

import type { Player } from '../../../player/index.js';
import type { PendingMove } from '../../../game.js';
import type { Argument } from '../../../action/action.js';

const PlayerControls = ({name, style, moves, onSubmit}: {
  name: string,
  style: React.CSSProperties,
  moves: PendingMove<Player>[],
  onSubmit: (move?: PendingMove<Player>, args?: Record<string, Argument<Player>>) => void,
}) => {
  const [game, position, prompt] = gameStore(s => [s.game, s.position, s.prompt]);

  const boardPrompts = useMemo(() => {
    const prompts = prompt ? [prompt] : [];
    for (const m of moves) {
      for (const s of m.selections) if (s.type === 'board' && (s.prompt ?? m.prompt)) prompts.push(s.prompt ?? m.prompt!);
    }
    return prompts;
  }, [prompt, moves]);

  const boardPrompt = useMemo(() => new Set(boardPrompts).size === 1 ? boardPrompts[0] : prompt, [prompt, boardPrompts]);
  //const boardID = useMemo(() => boardPrompt ? moves.find(m => m.selections.find(s => s.prompt === boardPrompt))?.action : '', [moves, boardPrompt]);

  if (!position) return null;

  return (
    <div key={name} className={`player-controls ${name.replace(":", "-")}`} style={style}>

      {name === 'step:out-of-turn' && (
        `${game.players.current().map(p => p.name).join(' ,')} is taking their turn`
      )}

      {boardPrompt && <div className="prompt">{boardPrompt}</div>}

      {moves.map(pendingMove => <ActionForm key={pendingMove.action + pendingMove.selections[0].prompt} move={pendingMove} stepName={name} onSubmit={onSubmit}/>)}

      {/** weird at this level but disambiguate can be cancelled even though it spans multiple moves */}
      {name === 'disambiguate-board-selection' && <button onClick={() => onSubmit()}>Cancel</button>}
    </div>
  )
};

export default PlayerControls;
