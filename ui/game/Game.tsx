import React, { useState, useRef, useEffect } from 'react';
import { gameStore } from '../';

import Element from './components/Element';
import PlayerControls from './components/PlayerControls';
import '../styles/game.scss';
import click from '../assets/click_004.ogg';

import type { GameElement } from '../../game/board'
import type { PendingMove, Argument } from '../../game/action/types';
import type { Player } from '../../game/player';

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

  const submitMove = (pendingMove?: PendingMove<Player>, ...args: Argument<Player>[]) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);
    selectMove(pendingMove, ...args);
  };

  const onSelectElement = (moves: PendingMove<Player>[], ...elements: GameElement<Player>[]) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);

    if (moves.length === 0) return;
    if (moves.length > 1) {
      setSelected([elements[0]]);
      return setDisambiguateElement({ element: elements[0], moves });
    }
    const move = moves[0];
    if (move.selection?.type === 'board') {
      if (!move.selection.isMulti()) {
        return submitMove(move, ...elements);
      }

      const newSelected = selected.includes(elements[0]) ?
        selected.filter(s => s !== elements[0]) :
        selected.concat([elements[0]]);
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
  }, []);

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
