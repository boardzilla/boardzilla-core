import React from 'react';
import { gameStore } from '../';

import Element from './components/Element';
import PlayerControls from './components/PlayerControls';
import '../styles/game.scss';
import { serializeArg } from '../../game/action/utils';
import { Board } from '../../game/board'

import type { GameElement } from '../../game/board'
import type { Move, SerializedMove } from '../../game/action/types';
import type { Player } from '../../game/player';

export default ({ onMove, onError }: {
  onMove: (m: SerializedMove) => void,
  onError: (e?: string) => void
}) => {
  const [game, updateBoard, position, move, setMove, selected, setSelected, boardJSON] =
        gameStore(s => [s.game, s.updateBoard, s.position, s.move, s.setMove, s.selected, s.setSelected, s.boardJSON]);

  console.log('GAME', position);
  if (!game || !position) return null;
  const player = game.players.atPosition(position);
  if (!player) {
    console.log('no player to render');
    return null;
  }

  console.log("RENDER GAME", move);

  const submitMove = (move?: Move<Player>) => {
    console.log("processAction", move);
    if (!move?.action) {
      setMove({ player, args: [] });
      onError();
      return updateBoard();
    }
    // TODO where does this go
    // if (selection?.type === 'board' && (selection.min !== undefined || selection.max !== undefined)) move.args.push(selected);

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
      setMove(newMove);
    } else {
      console.log('success, submitting to server');
      setMove(undefined);
      onError();
      updateBoard();
      onMove(serializedMove);
    }
  };

  const onSelectElement = (element: GameElement<Player>) => {
    const newSelected = selected.includes(element) ?
          selected.filter(s => s !== element) :
          selected.concat([element]);
    // TODO and this
    // if (move?.action) {
    //   setSelected(newSelected)
    //   if (selection?.min === undefined &&
    //       selection?.max === undefined &&
    //       newSelected.length === 1) {
    //     submitMove({
    //       action: move.action,
    //       args: [...move.args, newSelected[0]],
    //       player,
    //     })
    //   }
    // }
  }

  let width = 100;
  let height = 100;
  if (Board.aspectRatio) {
    if (Board.aspectRatio > 0) {
      width *= Board.aspectRatio;
    } else {
      height /= Board.aspectRatio;
    }
  }

  return (
    <div id="game" style={{ position: 'relative', width: width + 'vmin', height: height + 'vmin' }}>
      <div id="play-area" className={true ? 'fixed' : 'fluid'} style={{width: '100%', height: '100%'}}>
        <Element
          element={game.board}
          json={boardJSON[0]}
          selected={selected}
          onSelectElement={onSelectElement}
        />
      </div>
      <div id="player-controls">
        <PlayerControls
          move={move}
          onSubmit={submitMove}
        />
      </div>
    </div>
  );
}
