import React, { useRef, useEffect, useCallback } from 'react';
import { gameStore } from '../';

import Element from './components/Element';
import PlayerControls from './components/PlayerControls';
import '../styles/game.scss';
import { serializeArg } from '../../game/action/utils';
import click from '../assets/click_004.ogg';

import type { GameElement } from '../../game/board'
import type { PendingMove, Move, SerializedMove } from '../../game/action/types';
import type { Player } from '../../game/player';

export default ({ onMove, onError }: {
  onMove: (m: SerializedMove) => void,
  onError: (e?: string) => void
}) => {
  const [game, updateBoard, position, move, setMove, selected, setSelected, setDisambiguateElement, boardJSON] =
    gameStore(s => [s.game, s.updateBoard, s.position, s.move, s.setMove, s.selected, s.setSelected, s.setDisambiguateElement, s.boardJSON]);

  console.log('GAME', position);

  const clickAudio = useRef<HTMLAudioElement>(null);

  if (!game || !position) return null;
  const player = game.players.atPosition(position);
  if (!player) {
    console.log('no player to render');
    return null;
  }

  console.log("RENDER GAME", move);

  const submitMove = (move?: Move<Player>) => {
    console.log("processAction", move);
    clickAudio.current?.play();

    if (!move?.action) { // cancel
      setMove(undefined);
      onError();
      return updateBoard(); // optimally don't need to call
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
      setMove({ action: move.action, args: newMove.args, selection: newSelection });
    } else {
      console.log('success, submitting to server');
      setMove(undefined);
      onError();
      updateBoard(); // optimally don't need to call
      onMove(serializedMove);
    }
  };

  const onSelectElement = (element: GameElement<Player>, moves: PendingMove<Player>[]) => {
    clickAudio.current?.play();

    if (moves.length === 0) return;
    if (moves.length > 1) return setDisambiguateElement({ element, moves });
    const move = moves[0];
    if (move.selection?.type === 'board') {
      if (move.selection.min === undefined && move.selection.max === undefined) {
        return submitMove({
          action: move.action,
          args: [...move.args, element],
          player,
        });
      }

      const newSelected = selected.includes(element) ?
        selected.filter(s => s !== element) :
        selected.concat([element]);
      setSelected(newSelected);
    }
  }

  let width = 100;
  let height = 100;
  if (game.board._ui.appearance.aspectRatio) {
    if (game.board._ui.appearance.aspectRatio > 0) {
      width *= game.board._ui.appearance.aspectRatio;
    } else {
      height /= game.board._ui.appearance.aspectRatio;
    }
  }

  return (
    <div id="game" style={{ position: 'relative', width: width + 'vmin', height: height + 'vmin' }}>
      <audio ref={clickAudio} src={click} id="click"/>
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
          onSubmit={submitMove}
        />
      </div>
    </div>
  );
}
