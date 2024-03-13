import React, { useEffect, useState } from 'react';
import { gameStore } from '../../store.js';

const AnnouncementOverlay = ({ announcement, onDismiss }: {
  announcement: string,
  onDismiss: () => void
}) => {
  const [gameManager] = gameStore(s => [s.gameManager]);
  const [delay, setDelay] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDelay(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!delay) return;

  return (
    <div id="announcement-overlay" className="full-page-cover" onClick={() => onDismiss()}>
      <div id="announcement" className="modal-popup" onClick={() => onDismiss()}>
        {announcement !== '__finish__' && gameManager.game._ui.announcements[announcement](gameManager.game)}
        {announcement === '__finish__' && (
          <>
            <h1>Game finished</h1>
            {gameManager.winner.length > 0 && (
              <h2 style={{color: gameManager.winner.length === 1 ? gameManager.winner[0].color : ''}}>
                {gameManager.players.length === 1 ? 'You' : gameManager.winner.map(p => p.name).join(', ')} win{gameManager.winner.length === 1 && gameManager.players.length !== 1 && 's'}!
              </h2>
            )}
            {gameManager.winner.length === 0 && gameManager.players.length > 1 && <h2>Tie game</h2>}
            {gameManager.winner.length === 0 && gameManager.players.length === 1 && <h2 style={{color: "#800"}}>You lose</h2>}
          </>
        )}
      </div>
    </div>
  );
}

export default AnnouncementOverlay;
