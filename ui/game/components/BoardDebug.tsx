import React, { useState } from 'react';
import { gameStore } from '../../';

import {
  GameElement,
  ElementCollection,
} from '../../../game/board/';
import type { Player } from '../../../game/player';

export default () => {
  const [game, updateBoard] = gameStore(s => [s.game, s.updateBoard, s.boardJSON]);
  if (!game) return null;

  const [error, setError] = useState('');

  // put element classes into scope
  game.board._ctx.classRegistry.forEach((c, i) => eval(`window.${c.name} = board._ctx.classRegistry[${i}];`));

  const query = (q: string) => {
    if (!q) return;
    let result;
    try {
      result = eval(`board.${q}`);
      setError("");
    } catch (e) {
      setError(e.message);
    }
    updateBoard();

    // if (result) {
    //   if (result.constructor.name === 'ElementCollection') {
    //     setHilites(Array.from(result as ElementCollection<Player, GameElement<Player>>));
    //   }
    //   if (result.branch) {
    //     setHilites([result.branch()]);
    //   }
    // }
  };

  return (
    <div id="board-debug">
      <code>board.</code>
      <input style={{width: "55vw", display: "inline"}} onChange={e => query(e.target.value)}/>
      <div style={{color: "red"}}>{error}</div>
      <textarea readOnly={true} value={JSON.stringify(game.board.allJSON(), undefined, 2)} />
<button onClick={() => navigator.clipboard.writeText(JSON.stringify(game.getState(), undefined, 2))}>Copy setState</button>
    </div>
  );
};
