import React, {useState} from 'react';
import type {Argument} from '../../types.d';

export default function Counter({value, min, max, moves, action, steps, display}: {
  value: number,
  min: number,
  max: number,
  moves: number,
  action: (action: string, ...args: Argument[]) => void,
  steps: number[],
  display: (n: number) => JSX.Element | JSX.Element[]
}) {
  const [override, setOverride] = useState<number>();
  const [moves2, setMoves2] = useState(moves);

  const set = (n: number) => {
    let newValue = Math.max(min, (moves2 > moves && override !== undefined ? override : value) + n);
    if (max > 0 && newValue > max) newValue = max;
    setOverride(newValue); // very optimistic update. can't detect if any error yet
    setMoves2(Math.max(moves, moves2) + 1);
    action('set', newValue);
  };

  display = display || (v => v);

  return (
    <div>
      {steps.filter(s => s < 0).map(step => (
        <button key={step} onClick={e => {set(step); e.stopPropagation()}}>-{step < -1 && ` ${-step}`}</button>
      ))}
      <span className="value">{display(moves2 > moves && override !== undefined ? override : value)}</span>
      {steps.filter(s => s > 0).map(step => (
        <button key={step} onClick={e => {set(step); e.stopPropagation()}}>+{step > 1 && ` ${step}`}</button>
      ))}
    </div>
  );
}
