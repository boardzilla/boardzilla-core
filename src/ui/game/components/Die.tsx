import React, { useEffect, useRef } from 'react';

import { dice } from '../../assets/index.js';
import { times } from '../../../utils.js';

import type Die from '../../../board/die.js';

const DieComponent = ({ die }: { die: Die }) => {
  const diceAudio = useRef<HTMLAudioElement>(null);
  const lastFlip = useRef<boolean>();

  useEffect(() => {
    if (lastFlip.current !== undefined) diceAudio.current?.play();
    lastFlip.current = die.flip;
  }, [die.flip]);

  return (
    <>
      <audio ref={diceAudio} src={dice} id="dice"/>
      <ol data-spin={die.flip ? 'up' : 'down'}>
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
