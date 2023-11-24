import React, { useState, useRef, useEffect, useCallback, useMemo, CSSProperties } from 'react';
import classNames from 'classnames';
import { gameStore } from '../index.js';

import Element from './components/Element.js';
import PlayerControls from './components/PlayerControls.js';
import { click } from '../assets/index.js';

import type { GameElement } from '../../board/index.js'
import type { PendingMove } from '../../game.js';
import type { Argument } from '../../action/action.js';
import type { Player } from '../../player/index.js';
import { humanizeArg } from '../../action/utils.js';

export default () => {
  const [game, position, pendingMoves, move, step, selectMove, selected, setSelected, setAspectRatio, dragElement, setZoom, boardJSON] =
    gameStore(s => [s.game, s.position, s.pendingMoves, s.move, s.step, s.selectMove, s.selected, s.setSelected, s.setAspectRatio, s.dragElement, s.setZoom, s.boardJSON]);
  const clickAudio = useRef<HTMLAudioElement>(null);
  const [dimensions, setDimensions] = useState<{width: number, height: number}>();
  const [disambiguateElement, setDisambiguateElement] = useState<{ element: GameElement<Player>, moves: PendingMove<Player>[] }>();
  const [victoryMessageDismissed, setVictoryMessageDismissed] = useState(false);

  if (!position) return null;
  const player = game.players.atPosition(position);
  if (!player) return null;

  const submitMove = useCallback((pendingMove?: PendingMove<Player>, args?: Record<string, Argument<Player>>) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);
    setSelected([]);
    selectMove(pendingMove, args);
  }, [selectMove, setSelected]);

  const onSelectElement = useCallback((moves: PendingMove<Player>[], element: GameElement<Player>) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);

    if (moves.length === 0) return;
    if (moves.length > 1) {
      setSelected([element]);
      return setDisambiguateElement({ element, moves });
    }
    const move = moves[0];
    const selection = move.selections.find(s => s.type === 'board');
    if (selection) {
      if (!selection.isMulti() && typeof selection.confirm !== 'function') {
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
    }
  }, [selected, setSelected, submitMove]);

  const controls = useMemo(() => {
    const layouts: Record<string, {moves: PendingMove<Player>[], style: CSSProperties}> = {};
    const messages: (PendingMove<Player> | string)[] = pendingMoves || [];

    if (game.players.currentPosition.length > 0 && !game.players.currentPosition.includes(position)) messages.push('out-of-turn');

    if (disambiguateElement) {
      const elementPosition = disambiguateElement.element.relativeTransformToBoard();
      const style: CSSProperties = {};
      if (elementPosition.left > 100 - elementPosition.left - elementPosition.width) {
        style.right = `calc(${100 - elementPosition.left}% + 1rem)`;
      } else {
        style.left = `calc(${elementPosition.left + elementPosition.width}% + 1rem)`;
      }
      style.top = `${elementPosition.top}%`;
      layouts['disambiguate-board-selection'] = { moves: disambiguateElement.moves, style };
    } else {
      for (const pendingMove of messages) {
        if (!move && typeof pendingMove === 'object' && pendingMove.action.slice(0, 4) === '_god') continue; // don't need to display these as top-level choices
        // skip non-board moves if board elements selected
        if (selected.length && typeof pendingMove === 'object' && pendingMove.selections.every(s => s.type !== 'board')) continue;
        let layoutName = "";
        const actionLayout = typeof pendingMove === 'object' ? "action:" + pendingMove.action : undefined;
        const stepLayout = 'step:' + (typeof pendingMove === 'string' ? pendingMove : step);
        if (actionLayout && game.board._ui.stepLayouts[actionLayout]) {
          layoutName = actionLayout;
        } else if (stepLayout && game.board._ui.stepLayouts[stepLayout]) {
          layoutName = stepLayout;
        }

        if (layoutName) {
          const existing = layouts[layoutName];
          if (existing) {
            if (typeof pendingMove === 'object') existing.moves.push(pendingMove);
          } else {
            let style: CSSProperties = { left: 0, top: 0 };
            const layout = game.board._ui.stepLayouts[layoutName];
            const position = (typeof layout.element === 'function' ? layout.element() : layout.element)._ui.computedStyle;
            if (position) style = {
              left: layout.left !== undefined ? (layout.left * position.width / 100) + position.left + '%' : undefined,
              top: layout.top !== undefined ? (layout.top * position.height / 100) + position.top + '%' : undefined,
              right: layout.right !== undefined ? 100 + ((layout.right * position.width / 100) - position.left - position.width) + '%' : undefined,
              bottom: layout.bottom !== undefined ? 100 + ((layout.bottom * position.height / 100) - position.top - position.height) + '%' : undefined,
              width: layout.width !== undefined ? (layout.width * position.width / 100) + '%' : undefined,
              height: layout.height !== undefined ? (layout.height * position.height / 100) + '%' : undefined,
            }
            layouts[layoutName] = {moves: typeof pendingMove === 'object' ? [pendingMove] : [], style};
          }
        } else {
          layouts._default = {
            moves: [...layouts._default?.moves || []].concat(
              typeof pendingMove === 'object' ? [pendingMove] : []
            ),
            style: {left: 0, top: 0}
          };
        }
      }
    }
    return layouts;
  }, [selected, pendingMoves, move, position, disambiguateElement, step, game.players.currentPosition, game.board._ui.stepLayouts]);

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
      (window.document.childNodes[0] as HTMLHtmlElement).style.fontSize = rem + 'px';
    }
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [game.board._ui.appearance.aspectRatio, setAspectRatio]);

  if (!dimensions) return;

  console.debug('Showing game with pending moves:' + (pendingMoves?.map(m => `\n⮕ ${m.action}({${Object.entries(m.args || {}).map(([k, v]) => k + ': ' + humanizeArg(v)).join(', ')}})`).join('') || ' none'));

  return (
    <div
      id="game"
      className={classNames(
        game.board._ui.appearance.className,
        game.board._ui.breakpoint,
        step
      )}
      style={{ position: 'relative', width: dimensions.width + '%', height: dimensions.height + '%' }}
      onClick={() => game.phase === 'finished' && setVictoryMessageDismissed(true)}
    >
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
      {Object.entries(controls).map(([layoutName, {moves, style}]) => (
        <PlayerControls
          key={layoutName}
          name={layoutName}
          style={style}
          moves={moves}
          onSubmit={submitMove}
        />
      ))}
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
