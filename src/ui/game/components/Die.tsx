import React, { useEffect, useRef, useState } from 'react';

import { dice } from '../../assets/index.js';
import { times } from '../../../utils.js';

import type Die from '../../../board/die.js';

const DieComponent = ({ die }: { die: Die }) => {
  const diceAudio = useRef<HTMLAudioElement>(null);
  const lastRollSequence = useRef<number>();
  const [flip, setFlip] = useState<boolean>(false);

  useEffect(() => {
    if (die.rollSequence === die._ctx.gameManager.sequence - 1 && lastRollSequence.current !== die.rollSequence) {
      diceAudio.current?.play();
      lastRollSequence.current = die.rollSequence;
      setFlip(!flip);
    }
  }, [die, flip, setFlip]);

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

export default DieComponent;
