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
  const [game, boardJSON] = gameStore(s => [s.game, s.boardJSON]);
  if (!game) return null;
  //console.log('RENDER BOARD');
  if (JSON.stringify(game.board.allJSON()) !== JSON.stringify(boardJSON)) console.error('-------------------------------------------------- json out of sync --------------------------------------------------');

  return (
    <div id="play-area">
      { game && (
        <Element
          element={game.board}
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
