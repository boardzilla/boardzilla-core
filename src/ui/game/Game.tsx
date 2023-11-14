import React, { useState, useRef, useEffect } from 'react';
import { gameStore } from '../index.js';

import Element from './components/Element.js';
import PlayerControls from './components/PlayerControls.js';
import { click } from '../assets/index.js';

import type { GameElement } from '../../board/index.js'
import type { PendingMove } from '../../game.js';
import type { Argument } from '../../action/action.js';
import type { Player } from '../../player/index.js';

export default () => {
  const [game, position, selectMove, selected, setSelected, setAspectRatio, dragElement, boardJSON] =
    gameStore(s => [s.game, s.position, s.selectMove, s.selected, s.setSelected, s.setAspectRatio, s.dragElement, s.boardJSON]);

  const clickAudio = useRef<HTMLAudioElement>(null);
  const [dimensions, setDimensions] = useState<{width: number, height: number}>();
  const [disambiguateElement, setDisambiguateElement] = useState<{ element: GameElement<Player>, moves: PendingMove<Player>[] }>();
  const [victoryMessageDismissed, setVictoryMessageDismissed] = useState(false);

  if (!position) return null;
  const player = game.players.atPosition(position);
  if (!player) {
    console.log('no player to render');
    return null;
  }

  const submitMove = (pendingMove?: PendingMove<Player>, arg?: Argument<Player>) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);
    selectMove(pendingMove, arg);
  };

  const onSelectElement = (moves: PendingMove<Player>[], element: GameElement<Player>) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);

    if (moves.length === 0) return;
    if (moves.length > 1) {
      setSelected([element]);
      return setDisambiguateElement({ element: element, moves });
    }
    const move = moves[0];
    if (move.selection?.type === 'board') {
      if (!move.selection.isMulti()) {
        return submitMove(move, element);
      }

      const newSelected = selected.includes(element) ?
        selected.filter(s => s !== element) :
        selected.concat([element]);
      setSelected(newSelected);
    }
  }

  useEffect(() => {
    const resize = () => {
      const aspectRatio = window.innerWidth / window.innerHeight;
      setAspectRatio(aspectRatio);

      const ratio = (game.board._ui.appearance.aspectRatio ?? 1) / aspectRatio;
      let rem = window.innerHeight / 25;
      if (ratio > 1) {
        setDimensions({
          width: 100,
          height: 100 / ratio
        });
        rem /= ratio;
      } else {
        setDimensions({
          width: 100 * ratio,
          height: 100
        })
      }
      (window.document.childNodes[0] as HTMLHtmlElement).style.fontSize = rem + 'px';
    }
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [game.board._ui.appearance.aspectRatio, setAspectRatio]);

  if (!dimensions) return;

  console.log('GAME render');

  return (
    <div id="game" className={game.board._ui.appearance.className} style={{ position: 'relative', width: dimensions.width + '%', height: dimensions.height + '%' }} onClick={() => game.phase === 'finished' && setVictoryMessageDismissed(true)}>
      <audio ref={clickAudio} src={click} id="click"/>
      <div id="play-area" style={{width: '100%', height: '100%'}} className={dragElement ? "in-drag-movement" : ""}>
        <Element
          element={game.board}
          json={boardJSON[0]}
          selected={selected}
          onSelectElement={onSelectElement}
        />
        <div style={{position: 'absolute', backgroundColor: 'red'}}/>
      </div>
      <PlayerControls onSubmit={submitMove} disambiguateElement={disambiguateElement} />
      {game.godMode && <div className="god-mode-enabled">God mode enabled</div>}
      {game.phase === 'finished' && !victoryMessageDismissed && <div className="game-finished">Game finished</div>}
    </div>
  );
}
