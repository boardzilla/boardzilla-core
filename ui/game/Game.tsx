import React from 'react';
import { gameStore } from '../';

import Board from './components/Board';
import PlayerControls from './components/PlayerControls';
import '../styles/game.scss';
import { serializeArg } from '../../game/action/utils';

import type { GameElement } from '../../game/board'
import type { Move, SerializedMove } from '../../game/action/types';
import type { Player } from '../../game/player';

export default ({ onMove, onError }: {
  onMove: (m: SerializedMove) => void,
  onError: (e?: string) => void
}) => {
  const [game, updateBoard, position, move, setMove, selection, setSelection, selected, setSelected, hilites] = gameStore(s => [s.game, s.updateBoard, s.position, s.move, s.setMove, s.selection, s.setSelection, s.selected, s.setSelected, s.hilites]);

  if (!position) {
    console.log('no position to render');
    return null;
  }
  const player = game.players.atPosition(position);
  if (!player) {
    console.log('no player to render');
    return null;
  }

  let clickables: GameElement[] = [];

  console.log("RENDER GAME", move, selection);

  if (selection?.type === 'board') clickables = selection.boardChoices;

  const submitMove = (move?: Move<Player>) => {
    console.log("processAction", move);
    if (!move?.action) {
      setMove({ player, args: [] });
      onError();
      return updateBoard();
    }
    if (selection?.type === 'board' && (selection.min !== undefined || selection.max !== undefined)) move.args.push(selected);

    // serialize now before we alter our state to ensure proper references
    const serializedMove: SerializedMove = {
      action: move.action,
      args: move.args.map(a => serializeArg(a))
    }

    const {move: newMove, selection: newSelection, error} = game.processMove(move);
    console.log('response', newMove, newSelection, error);
    setSelected([]);

    if (newSelection) {
      onError(error);
      setSelection(newSelection);
      setMove(newMove);
    } else {
      console.log('success, submitting to server');
      setMove(undefined);
      onError();
      setSelection(undefined);
      updateBoard();
      onMove(serializedMove);
    }
  };

  const onSelectElement = (element: GameElement) => {
    const newSelected = selected.includes(element) ?
          selected.filter(s => s !== element) :
          selected.concat([element]);
    if (selection?.type === 'board' && move?.action) {
      setSelected(newSelected)
      if (selection?.min === undefined &&
          selection?.max === undefined &&
          newSelected.length === 1) {
        submitMove({
          action: move.action,
          args: [...move.args, newSelected[0]],
          player,
        })
      }
    }
  }

  return (
    <div>
      <Board
        clickables={clickables}
        hilites={hilites}
        selected={selected}
        onSelectElement={onSelectElement}
      />
      <PlayerControls
        move={move}
        selection={selection}
        onSubmit={submitMove}
      />
    </div>
  );
}
