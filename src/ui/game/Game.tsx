import React, { useState, useRef, useEffect, useCallback, useMemo, CSSProperties } from 'react';
import { gameStore } from '../index.js';

import Element from './components/Element.js';
import PlayerControls from './components/PlayerControls.js';
import InfoOverlay from './components/InfoOverlay.js';
import Debug from './components/Debug.js';
import { click } from '../assets/index.js';
import { GameElement } from '../../board/index.js'
import classnames from 'classnames';

import type { UIMove } from '../lib.js';
import type { Argument } from '../../action/action.js';
import type { Player } from '../../player/index.js';
import AnnouncementOverlay from './components/AnnouncementOverlay.js';

export default () => {
  const [game, dev, position, pendingMoves, step, announcementIndex, dismissAnnouncement, selectMove, clearMove, selectElement, setBoardSize, dragElement, boardJSON] = gameStore(s => [s.game, s.dev, s.position, s.pendingMoves, s.step, s.announcementIndex, s.dismissAnnouncement, s.selectMove, s.clearMove, s.selectElement, s.setBoardSize, s.dragElement, s.boardJSON]);
  const clickAudio = useRef<HTMLAudioElement>(null);
  const [mode, setMode] = useState<'game' | 'info' | 'debug'>('game');
  const announcement = useMemo(() => game.announcements[announcementIndex], [game.announcements, announcementIndex]);

  if (!position) return null;
  const player = game.players.atPosition(position);
  if (!player) return null;

  const handleSubmitMove = useCallback((pendingMove?: UIMove, args?: Record<string, Argument<Player>>) => {
    clickAudio.current?.play();
    clearMove();
    selectMove(pendingMove, args);
  }, [clearMove, selectMove]);

  const handleSelectElement = useCallback((moves: UIMove[], element: GameElement) => {
    clickAudio.current?.play();
    selectElement(moves, element);
  }, [selectElement]);

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
      if (e.code === 'Escape') {
        if (mode === 'game') handleSubmitMove();
      }
    };
    window.addEventListener('keydown', keydownHandler);
    return () => window.removeEventListener('keydown', keydownHandler);
  }, [handleSubmitMove, mode]);

  useEffect(() => {
    window.addEventListener('resize', setBoardSize);
    return () => window.removeEventListener('resize', setBoardSize);
  }, [setBoardSize]);

  useEffect(() => {
    window.document.documentElement.style.setProperty('font-size', 'min(4vw / var(--aspect-ratio), 4vh)');
    window.document.documentElement.style.setProperty('--aspect-ratio', String(game.board._ui.boardSize.aspectRatio))
    return () => {
      window.document.documentElement.style.removeProperty('font-size');
      window.document.documentElement.style.removeProperty('--aspect-ratio');
    }
  }, [game.board._ui.boardSize]);

  if (!boardJSON.length) return null;

  console.debug('Showing game with pending moves:' +
    (pendingMoves?.map(m => (
      `\n⮕ ${typeof m === 'string' ? m :
        `${m.name}({${
          Object.entries(m.args || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
        }}) ? ${m.selections?.length ? m.selections[0].toString() : 'no choices'}`
      }`
    )).join('') || ' none')
  );

  return (
    <div
      id="game"
      ref={domRef}
      data-board-size={game.board._ui.boardSize?.name}
      data-step={step}
      className={classnames(
        globalThis.navigator?.userAgent.match(/Mobi/) ? 'mobile' : 'desktop', {
          'browser-chrome': globalThis.navigator?.userAgent.indexOf('Chrome') > -1,
          'browser-safari': globalThis.navigator?.userAgent.indexOf('Safari') > -1,
          'browser-edge': globalThis.navigator?.userAgent.indexOf('Edge') > -1,
          'browser-firefox': globalThis.navigator?.userAgent.indexOf('Firefox') > -1,
        }
      )}
      style={{
        ['--aspect-ratio' as string]: game.board._ui.boardSize.aspectRatio,
        ['--current-player-color' as string]: game.players.currentPosition.length === 1 ? game.players.current()?.color : '',
        ['--my-player-color' as string]: game.players.atPosition(position)?.color
      }}
    >
      <audio ref={clickAudio} src={click} id="click"/>
      {mode !== 'debug' && <div id="background" className="full-page-cover" />}
      <div id="play-area" style={{width: '100%', height: '100%'}} className={dragElement ? "in-drag-movement" : ""}>
        {mode !== 'debug' && (
          <Element
            element={game.board}
            json={boardJSON[0]}
            mode={announcement ? 'info' : mode}
            onSelectElement={handleSelectElement}
          />
        )}
      </div>

      {mode === 'game' && !announcement && (
        <PlayerControls
          onSubmit={handleSubmitMove}
        />
      )}

      {game.godMode && mode === 'game' && !announcement && <div className="god-mode-enabled">God mode enabled</div>}

      {mode !== 'info' && (
        <div id="corner-controls">
          <div id="info-toggle">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 112 112" onClick={() => setMode('info')}>
              <path
                style={{stroke:'black', fill: 'white', strokeWidth: 8}}
                d="M 53.102,4 C 25.983,4 4,25.983 4,53.102 c 0,27.119 21.983,49.103 49.102,49.103 27.119,0 49.101,-21.984 49.101,-49.103 C 102.203,25.983 80.221,4 53.102,4 Z"
              />
              <path
                fill="black"
                d="m 53.102,34.322 c -5.048,0 -9.141,-4.092 -9.141,-9.142 0,-5.049 4.092,-9.141 9.141,-9.141 5.05,0 9.142,4.092 9.142,9.141 -10e-4,5.05 -4.093,9.142 -9.142,9.142 z"
              />
              <path
                fill="black"
                d="m 61.669,82.139 c 0,4.402 -3.806,7.969 -8.5,7.969 -4.694,0 -8.5,-3.567 -8.5,-7.969 V 45.577 c 0,-4.401 3.806,-7.969 8.5,-7.969 4.694,0 8.5,3.568 8.5,7.969 z"
              />
            </svg>
          </div>
          {dev && (
            <div id="debug-toggle">
              <svg
                viewBox="-40 -40 574.04362 578.11265"
                xmlns="http://www.w3.org/2000/svg"
                onClick={() => setMode(mode === 'debug' ? 'game' : 'debug')}
              >
                <path
                  style={{fill: 'white', stroke: 'black', strokeWidth:80, paintOrder:'stroke markers fill'}}
                  d="m 352.48196,213.31221 c 0,78.32378 -63.49396,141.81774 -141.81774,141.81775 -78.32378,0 -141.817754,-63.49397 -141.817754,-141.81775 10e-7,-78.32378 63.493974,-141.817751 141.817754,-141.817749 78.32378,6e-6 141.81774,63.493969 141.81774,141.817749 z M 490.31895,451.24231 378.93053,344.196 c 29.8,-36.3 42.26947,-82.8 42.26947,-133.4 0,-116.3 -94.3,-210.6 -210.6,-210.6 -116.3,0 -210.6,94.3 -210.6,210.6 0,116.3 94.3,210.6 210.6,210.6 50.8,0 88.51578,-8.22736 124.91578,-38.22736 l 112.27685,111.38842 c 12.9,11.8 32.10737,-6.46106 36.30737,-10.66106 8.4,-8.3 14.61895,-24.35369 6.21895,-32.65369 z"/>
              </svg>
            </div>
          )}
        </div>
      )}

      {mode === 'game' && announcement && (
        <AnnouncementOverlay
          announcement={announcement}
          onDismiss={dismissAnnouncement}
        />
      )}
      {mode === 'info' && <InfoOverlay setMode={setMode}/>}
      {mode === 'debug' && dev && <Debug/>}
    </div>
  );
}
