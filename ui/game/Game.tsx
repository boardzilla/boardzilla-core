import React, { useRef } from 'react';
import { gameStore } from '../';

import Element from './components/Element';
import PlayerControls from './components/PlayerControls';
import '../styles/game.scss';
import click from '../assets/click_004.ogg';

import type { GameElement } from '../../game/board'
import type { PendingMove, Argument } from '../../game/action/types';
import type { Player } from '../../game/player';

export default () => {
  const [game, position, move, selectMove, selected, setSelected, setDisambiguateElement, boardJSON] =
    gameStore(s => [s.game, s.position, s.move, s.selectMove, s.selected, s.setSelected, s.setDisambiguateElement, s.boardJSON]);

  console.log('GAME', position);

  const clickAudio = useRef<HTMLAudioElement>(null);

  if (!game || !position) return null;
  const player = game.players.atPosition(position);
  if (!player) {
    console.log('no player to render');
    return null;
  }

  console.log("RENDER GAME", move);

  const submitMove = (pendingMove?: PendingMove<Player>, value?: Argument<Player>) => {
    console.log("processAction", move);
    clickAudio.current?.play();
    selectMove(pendingMove, value);
  };

  const onSelectElement = (element: GameElement<Player>, moves: PendingMove<Player>[]) => {
    clickAudio.current?.play();

    if (moves.length === 0) return;
    if (moves.length > 1) return setDisambiguateElement({ element, moves });
    const move = moves[0];
    if (move.selection?.type === 'board') {
      if (move.selection.min === undefined && move.selection.max === undefined) {
        return submitMove(move, element);
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
        <PlayerControls onSubmit={submitMove} />
      </div>
    </div>
  );
}
