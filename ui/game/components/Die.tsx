import React, {useState} from 'react';
import type {Argument} from '../../types.d';

export default function Die({number, rolls, faces, action}: {
  number: number,
  rolls: number,
  faces: number,
  action: (action: string, ...args: Argument[]) => void,
}) {
  const [override, setOverride] = useState<number>();
  const [rolls2, setRolls2] = useState(rolls);
  const [shake, setShake] = useState({x:0, y:0});

  const roll = () => {
    const rolling = setInterval(() => setOverride(Math.floor(Math.random() * faces + 1)), 100);
    setTimeout(() => {clearInterval(rolling); setOverride(undefined)}, 1000);
    action('roll');
  };

  const shakeIt = (f=100) => setShake({x: (Math.random() - .5) * f, y: (Math.random() - .5) * f})

  const shakeSequence = () => {
    shakeIt();
    setTimeout(shakeIt, 250);
    setTimeout(shakeIt, 500);
    setTimeout(shakeIt, 750);
    setTimeout(shakeIt.bind(this, 0), 1000);
  }

  const rollD6 = () => {
    action('roll');
    setRolls2(rolls2 + 1);
    shakeSequence()
  };

  if (rolls > rolls2) {
    setRolls2(rolls);
    shakeSequence();
  }

  const spin = rolls2 % 2 ? 'up' : 'down';

  if (faces == 6) {
    return (
      <div className="shake" style={{transform: `translate(${shake.x}px, ${shake.y}px)`}}>
        <ol className="d6" data-spin={spin} onClick={rollD6} onTouchEnd={rollD6}>
          {[1,2,3,4,5,6].map(n => (
            <li key={n} className="die-face" data-face={n}>
              {Array.from(Array(n)).map((_, f) => <span key={f} className="dot"/>)}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return <button onClick={roll} onTouchEnd={roll} style={override ? {transform: `rotate(${Math.random() * 360}deg)`} : {}} >{override || number}</button>
}
