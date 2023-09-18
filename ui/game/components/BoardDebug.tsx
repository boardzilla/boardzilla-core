import React, { useState } from 'react';
import { gameStore } from '../../';

import {
  Board,
  Space,
  GameElement,
  ElementCollection,
} from '../../../game/board/';

export default () => {
  const [game, updateBoard, board, setHilites] = gameStore(s => [s.game, s.updateBoard, s.board, s.setHilites, s.boardJSON]);
  if (!game || !board) return null;

  const [error, setError] = useState('');

  // put element classes into scope
  board._ctx.classRegistry.forEach((c, i) => eval(`window.${c.name} = board._ctx.classRegistry[${i}];`));

  const query = (q: string) => {
    if (!q) return;
    let result;
    try {
      result = eval(`board.${q}`);
      setError("");
    } catch (e) {
      setError(e.message);
    }
    setHilites([]);
    updateBoard();

    if (result) {
      if (result.constructor.name === 'ElementCollection') {
        setHilites(Array.from(result as ElementCollection<GameElement>));
      }
      if (result.branch) {
        setHilites([result.branch()]);
      }
    }
  };

  return (
    <div id="board-debug">
      <code>board.</code>
      <input style={{width: "55vw", display: "inline"}} onChange={e => query(e.target.value)}/>
      <div style={{color: "red"}}>{error}</div>
      <textarea readOnly={true} value={JSON.stringify(board.allJSON(), undefined, 2)} />
<button onClick={() => navigator.clipboard.writeText(JSON.stringify(game.getState(), undefined, 2))}>Copy setState</button>
    </div>
  );
};
