import React, { useState, useRef, useEffect, useCallback, useMemo, CSSProperties } from 'react';
import classNames from 'classnames';
import { gameStore } from '../index.js';

import Element from './components/Element.js';
import PlayerControls from './components/PlayerControls.js';
import { click } from '../assets/index.js';
import { GameElement } from '../../board/index.js'
import { humanizeArg } from '../../action/utils.js';

import type { ActionLayout } from '../../board/board.js'
import type { UIMove } from '../index.js';
import type { Argument } from '../../action/action.js';
import type { Player } from '../../player/index.js';
import type { Box } from '../../board/element.js';

export default () => {
  const [game, position, pendingMoves, move, step, selectMove, boardSelections, selected, setSelected, setAspectRatio, dragElement, setZoom, boardJSON] =
    gameStore(s => [s.game, s.position, s.pendingMoves, s.move, s.step, s.selectMove, s.boardSelections, s.selected, s.setSelected, s.setAspectRatio, s.dragElement, s.setZoom, s.boardJSON]);
  const clickAudio = useRef<HTMLAudioElement>(null);
  const [dimensions, setDimensions] = useState<{width: number, height: number}>();
  const [disambiguateElement, setDisambiguateElement] = useState<{ element: GameElement<Player>, moves: UIMove[] }>();
  const [victoryMessageDismissed, setVictoryMessageDismissed] = useState(false);

  if (!position) return null;
  const player = game.players.atPosition(position);
  if (!player) return null;

  const submitMove = useCallback((pendingMove?: UIMove, args?: Record<string, Argument<Player>>) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);
    setSelected([]);
    selectMove(pendingMove, args);
  }, [selectMove, setSelected]);

  const onSelectElement = useCallback((moves: UIMove[], element: GameElement<Player>) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);

    if (moves.length === 0) return;
    if (moves.length > 1) { // multiple moves are associated with this element (attached by getBoardSelections)
      setSelected([element]);
      return setDisambiguateElement({ element, moves });
    }

    const move = moves[0];
    const selection = move.selections[0]; // simple one-selection UIMove created by getBoardSelections
    if (!move.requireExplicitSubmit) {
      submitMove(move, {[selection.name]: element});
      return;
    }

    const newSelected = selection.isMulti() ? (
      selected.includes(element) ?
        selected.filter(s => s !== element) :
        selected.concat([element])
    ) : (
      selected[0] === element ? [] : [element]
    );
    setSelected(newSelected);
  }, [selected, setSelected, submitMove]);

  const {style, name, moves} = useMemo(() => {
    // find the best layout for the current moves, going in this order:
    // - the last selected, visible game element as part of the current move(s) that hasn't been disabled via layoutAction.noAnchor
    // - a supplied layoutAction for the only current move
    // - a supplied layoutStep belonging to the step to which the current move(s) belong
    // - if no moves available, but another player can move, out-of-turn
    let layout: ActionLayout | undefined = undefined;
    let name: string = '';
    let moves = pendingMoves || [];
    let style: CSSProperties = { };

    if (!layout && disambiguateElement?.element) {
      layout = { element: disambiguateElement.element, leftOrRight: 2 };
      moves = disambiguateElement.moves;
      name = 'disambiguate-board-selection';
    }

    if (!layout && selected.length === 1) {
      const clickMoves = boardSelections[selected[0].branch()]?.clickMoves;
      if (clickMoves.length === 1 && !clickMoves[0].selections[0].isMulti()) {
        layout = { element: selected[0], leftOrRight: 2 };
        name = 'action:' + moves[0].name;
        moves = clickMoves;
      }
    }

    if (!layout && move) {
      const element = Object.entries(move.args).reverse().find(([name, el]) => (
        game.board._ui.stepLayouts["action:" + name]?.noAnchor?.includes(name) && el instanceof GameElement
      ));
      if (element && (element[1] as GameElement)._ui?.computedStyle) {
        layout = { element: element[1] as GameElement, leftOrRight: 2 };
        name = 'action:' + element[0];
      }
    }

    if (!layout && pendingMoves?.length) {
      const moves = pendingMoves.filter(m => move || m.name.slice(0, 4) !== '_god'); // no display for these normally
      if (moves.length === 1) {
        // skip non-board moves if board elements already selected (cant this be more specific? just moves that could apply?)
        if (!selected.length || moves[0].selections.some(s => s.type !== 'board')) {
          const actionLayout = game.board._ui.stepLayouts["action:" + moves[0].name];
          if (actionLayout?.element?._ui?.computedStyle) {
            layout = actionLayout;
            name = 'action:' + moves[0].name;
          }
        }
      }
    }

    if (!layout && pendingMoves?.length && step) {
      name = 'step:' + step;
      layout = game.board._ui.stepLayouts[name];
    }

    if (!layout && game.players.currentPosition.length > 0 && !game.players.currentPosition.includes(position)) {
      name = 'step:out-of-turn';
      layout = game.board._ui.stepLayouts[name];
    }

    if (layout) {
      let box: Box | undefined = layout.element.relativeTransformToBoard();

      if (layout.leftOrRight !== undefined && box) {
        if (box.left > 100 - box.left - box.width) {
          style.right = `calc(${100 - box.left}% + ${layout.leftOrRight}vw)`;
          style.left = undefined;
        } else {
          style.left = `calc(${box.left + box.width}% + ${layout.leftOrRight}vw)`;
        }
      }

      if (layout.right !== undefined) {
        style.right = 100 + ((layout.right * box.width / 100) - box.left - box.width) + '%';
      } else if (layout.leftOrRight === undefined) {
        style.left ??= ((layout.left ?? 0) * box.width / 100) + box.left + '%';
      }
      if (layout.bottom !== undefined) {
        style.bottom = 100 + ((layout.bottom * box.height / 100) - box.top - box.height) + '%';
      } else {
        style.top = ((layout.top ?? 0) * box.height / 100) + box.top + '%';
      }
      if (layout.width !== undefined) style.width = (layout.width * box.width / 100) + '%';
      if (layout.height !== undefined) style.height = (layout.height * box.height / 100) + '%';
    } else {
      style = {left: 0, top: 0};
    }

    return {style, name, moves};
  }, [selected, pendingMoves, boardSelections, move, position, disambiguateElement, step, game.players.currentPosition, game.board._ui.stepLayouts]);

  const domRef = useCallback((node: HTMLDivElement) => {
    if (!node) return;
    const callback: MutationCallback = deletions => {
      deletions.forEach(m => m.removedNodes.forEach((d: HTMLElement) => {
        if (d.classList.contains('player-controls') && !d.classList.contains('fade-out')) {
          const fadeOut = d.cloneNode(true);
          (fadeOut as HTMLElement).classList.add('fade-out');
          node.appendChild(fadeOut);
          setTimeout(() => node.removeChild(fadeOut), 500);
        }
      }));
    };

    const observer = new MutationObserver(callback);
    observer.observe(node, { childList: true });
  }, []);

  useEffect(() => {
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'z') setZoom(true);
      if (e.code === 'Escape') submitMove();
    };
    const keyupHandler = (e: KeyboardEvent) => {
      if (e.key === 'z') setZoom(false);
    };
    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keyup', keyupHandler);
    return () => {
      window.removeEventListener('keyup', keyupHandler);
      window.removeEventListener('keyup', keydownHandler);
    }
  }, [setZoom, submitMove]);

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
      window.document.documentElement.style.fontSize = rem + 'px';
    }
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [game.board._ui.appearance.aspectRatio, setAspectRatio]);

  if (!dimensions) return;

  console.debug('Showing game with pending moves:' +
    (pendingMoves?.map(m => (
      `\n⮕ ${typeof m === 'string' ? m :
        `${m.name}({${
          Object.entries(m.args || {}).map(([k, v]) => k + ': ' + humanizeArg(v)).join(', ')
        }}) ? ${m.selections?.length ? m.selections[0].toString() : 'no choices'}`
      }`
    )).join('') || ' none')
  );

  return (
    <div
      id="game"
      ref={domRef}
      className={classNames(
        game.board._ui.appearance.className,
        game.board._ui.breakpoint,
        step
      )}
      style={{ position: 'relative', width: dimensions.width + '%', height: dimensions.height + '%', top: 50 - dimensions.height/2 + '%' }}
      onClick={() => game.phase === 'finished' && setVictoryMessageDismissed(true)}
    >
      <audio ref={clickAudio} src={click} id="click"/>
      <div id="background"/>
      <div id="play-area" style={{width: '100%', height: '100%'}} className={dragElement ? "in-drag-movement" : ""}>
        <Element
          element={game.board}
          json={boardJSON[0]}
          selected={selected}
          onSelectElement={onSelectElement}
        />
        <div style={{position: 'absolute', backgroundColor: 'red'}}/>
      </div>

      <PlayerControls
        name={name}
        style={style}
        moves={moves}
        onSubmit={submitMove}
      />

      {game.godMode && <div className="god-mode-enabled">God mode enabled</div>}
      {game.phase === 'finished' && !victoryMessageDismissed && (
        <div className="game-finished">
          Game finished
          {game.winner.length > 0 && (
            <div style={{color: game.winner.length === 1 ? game.winner[0].color : ''}}>
              {game.winner.map(p => p.name).join(', ')} win{game.winner.length === 1 && 's'}!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
