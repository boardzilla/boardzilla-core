import React from 'react';
import Element from './Element';
import { gameStore } from '../../';

import type { GameElement } from '../../../game/board'

const Board = ({clickables, hilites, selected, onSelectElement}: {
  clickables: GameElement[];
  hilites: GameElement[];
  selected: GameElement[];
  onSelectElement: (e: GameElement) => void;
}) => {
  const [board, boardJSON] = gameStore(s => [s.board, s.boardJSON]);
  console.log('RENDER BOARD');

  return (
    <div id="play-area">
      { board && (
        <Element
          element={board}
          json={boardJSON[0]}
          clickables={clickables}
          hilites={hilites}
          selected={selected}
          onSelectElement={onSelectElement} />
      )}
    </div>
  );
};

export default Board;
