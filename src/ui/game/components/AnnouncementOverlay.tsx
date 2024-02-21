import React, { useEffect, useState } from 'react';
import { gameStore } from '../../index.js';

const AnnouncementOverlay = ({ announcement, onDismiss }: {
  announcement: string,
  onDismiss: () => void
}) => {
  const [game] = gameStore(s => [s.game]);
  const [delay, setDelay] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDelay(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!delay) return;

  return (
    <div id="announcement-overlay" className="full-page-cover" onClick={() => onDismiss()}>
      <div id="announcement" className="modal-popup" onClick={() => onDismiss()}>
        {announcement !== '__finish__' && game.board._ui.announcements[announcement](game.board)}
        {announcement === '__finish__' && (
          <>
            <h1>Game finished</h1>
            {game.winner.length > 0 && (
              <h2 style={{color: game.winner.length === 1 ? game.winner[0].color : ''}}>
                {game.players.length === 1 ? 'You' : game.winner.map(p => p.name).join(', ')} win{game.winner.length === 1 && game.players.length !== 1 && 's'}!
              </h2>
            )}
            {game.winner.length === 0 && game.players.length > 1 && <h2>Tie game</h2>}
            {game.winner.length === 0 && game.players.length === 1 && <h2 style={{color: "#800"}}>You lose</h2>}
          </>
        )}
      </div>
    </div>
  );
}

export default AnnouncementOverlay;
