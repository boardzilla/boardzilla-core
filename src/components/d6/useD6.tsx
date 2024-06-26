import React, { useEffect, useRef, useState } from 'react';

import dice from './assets/dice.ogg';
import { times } from '../../utils.js';
import D6 from './d6.js';
import './assets/index.scss';

import type { BaseGame } from '../../board/game.js';

/**
 * Adds an animated spinning appearance to the {@link D6} class
 *
 * @example
 * import { useD6 } from '@boardzilla/core/components';
 *
 * // then in the layout() method
 *     useD6(game);
 */
const D6Component = ({ die }: { die: D6 }) => {
  const diceAudio = useRef<HTMLAudioElement>(null);
  const lastRollSequence = useRef<number>();
  const [flip, setFlip] = useState<boolean>(false);

  useEffect(() => {
    if (die.rollSequence === Math.ceil(die._ctx.gameManager.sequence - 1) && lastRollSequence.current !== undefined && lastRollSequence.current !== die.rollSequence) {
      diceAudio.current?.play();
      setFlip(!flip);
    }
    lastRollSequence.current = die.rollSequence;
  }, [die, die.rollSequence, flip, setFlip]);

  return (
    <>
      <audio ref={diceAudio} src={dice} id="dice"/>
      <ol data-spin={flip ? 'up' : 'down'}>
        {[1,2,3,4,5,6].map(dots => (
          <li key={dots} className="die-face" data-face={dots}>
            {times(dots, d => <span key={d} className="dot"/>)}
          </li>
        ))}
      </ol>
    </>
  );
}

export default (game: BaseGame) => {
  game.all(D6).appearance({
    render: (die: D6) => <D6Component die={die}/>,
    aspectRatio: 1,
  });
}
