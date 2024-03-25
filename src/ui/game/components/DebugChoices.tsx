import React from 'react';
import DebugArgument from './DebugArgument.js';

import type { Argument, SingleArgument } from '../../../action/action.js';

const DebugChoices = ({ choices, heading }: {
  choices?: (SingleArgument | { label: string; choice: SingleArgument; } | {option: Argument, error: string})[] ,
  heading: string
}) => {
  if (!choices?.length) return null;

  return (
    <li>{heading}:&nbsp;
      {
        choices.map((c, i) => (
          <span key={i}>
            {i ? ', ' : ''}<DebugArgument argument={(typeof c === 'object' ? ('choice' in c ? c.choice : ('option' in c ? c.option : undefined)) : undefined) ?? c as SingleArgument}/>
            {typeof c === 'object' && 'error' in c && ` (${c.error})`}
          </span>
        ))
      }
    </li>
  );
}

export default DebugChoices;
