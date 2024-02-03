import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { gameStore } from '../../index.js';
import Element from './Element.js';

const InfoOverlay = ({ setMode }: {
  setMode: (mode: 'info' | 'game' | 'debug') => void;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [infoModal, setInfoModal] = useState<number | undefined>(undefined);

  const [game, infoElement, setInfoElement, actionDescription] = gameStore(s => [s.game, s.infoElement, s.setInfoElement, s.actionDescription]);

  let elementStyle: React.CSSProperties | undefined = useMemo(() => {
    if (!infoElement?.element) return {};
    const scale = {...infoElement.element.absoluteTransform()};
    let fontSize = 32 * 0.04;
    const aspectRatio = scale.width / scale.height;

    if (aspectRatio > 1) {
      scale.width = 100;
      fontSize /= aspectRatio;
    } else {
      scale.width *= 100 / scale.height;
    }
    return {
      width: scale.width + '%',
      aspectRatio,
      fontSize: fontSize + 'rem',
    };
  }, [infoElement?.element]);

  const close = useCallback(() => {
    if (infoElement || infoModal !== undefined) {
      setInfoElement();
      setInfoModal(undefined);
    } else {
      setMode('game');
    }
  }, [infoElement, infoModal, setInfoElement, setInfoModal, setMode]);

  useEffect(() => {
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') close();
    };
    window.addEventListener('keydown', keydownHandler);
    return () => window.removeEventListener('keydown', keydownHandler);
  }, [close]);

  return (
    <>
      <div id="info-overlay" className="full-page-cover" onClick={close}/>
      <div id="info-container" className="full-page-cover">
        <div id="info-drawer" className={collapsed ? 'collapsed' : ''}>
          <div className="header">
            <div className="title">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onClick={() => { setMode('game'); setInfoElement(); setInfoModal(undefined) }}>
                <path fill="black" d="M50.433,0.892c-27.119,0-49.102,21.983-49.102,49.102s21.983,49.103,49.102,49.103s49.101-21.984,49.101-49.103S77.552,0.892,50.433,0.892z M59,79.031C59,83.433,55.194,87,50.5,87S42,83.433,42,79.031V42.469c0-4.401,3.806-7.969,8.5-7.969s8.5,3.568,8.5,7.969V79.031z M50.433,31.214c-5.048,0-9.141-4.092-9.141-9.142c0-5.049,4.092-9.141,9.141-9.141c5.05,0,9.142,4.092,9.142,9.141C59.574,27.122,55.482,31.214,50.433,31.214z"/>
              </svg>
            </div>
            <div className="controls">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" onClick={() => setCollapsed(!collapsed)}>
                <g data-name="Layer 2">
                  <g data-name="collapse">
                    <path fill="black" d="M19 9h-2.58l3.29-3.29a1 1 0 1 0-1.42-1.42L15 7.57V5a1 1 0 0 0-1-1 1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h5a1 1 0 0 0 0-2z"/>
                    <path fill="black" d="M10 13H5a1 1 0 0 0 0 2h2.57l-3.28 3.29a1 1 0 0 0 0 1.42 1 1 0 0 0 1.42 0L9 16.42V19a1 1 0 0 0 1 1 1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1z"/>
                  </g>
                </g>
              </svg>
            </div>
          </div>
          {!collapsed && (
            <>
              <div className="contents">
                <h1>Currently</h1>
                <ul>
                  {game.messages.map((m, i) => {
                    console.log(m.body)
                    const player = m.body.match(/\[\[\$p\[(\d+)/);
                    let color: string | undefined = undefined;
                    if (player) {
                      color = game.players.atPosition(parseInt(player[1]))?.color;
                    }
                    return (
                      <li style={{color}} key={i}>
                        <span dangerouslySetInnerHTML={{ __html: m.body.replace(/\[\[[^|]*\|(.*?)\]\]/g, '$1')}}/>
                      </li>
                    );
                  })}
                  <li style={{color: game.players.allCurrent()[0]?.color}}>
                    <span>{actionDescription}</span>
                  </li>
                </ul>
              </div>
              <div className="contents">
                <h1>More game info</h1>
                {game.board._ui.infoModals?.
                  filter(({ condition }) => !condition || condition(game.board)).
                  map(({ title }, key) => (
                    <button key={key} className="info-modal-title" onClick={() => { setInfoElement(); setInfoModal(key) }}>
                      {title}
                    </button>
                ))}
                <div className="more-info">See more detail by clicking on highlighted items.</div>
              </div>
            </>
          )}
        </div>

        {(!!infoElement || infoModal !== undefined) && (
          <div id="info-modal" className={`modal-popup ${infoElement ? 'info-element' : ''}`}>
            {infoElement && (
              <>
                {infoElement.element && (
                  <div className="element-zoom">
                    <div style={elementStyle}>
                      <Element
                        element={infoElement.element}
                        json={infoElement.element.toJSON()}
                        mode='zoom'
                        onSelectElement={() => {}}
                        onSelectPlacement={() => {}}
                      />
                    </div>
                  </div>
                )}
                <span className="info-text">
                  {infoElement.element && <h1>{`${infoElement.element}`}</h1>}
                  {typeof infoElement.info !== 'boolean' && infoElement.info}
                </span>
              </>
            )}
            {!infoElement && (
              game.board._ui.infoModals[infoModal!].modal(game.board)
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default InfoOverlay;
