import React from 'react';
import DebugArgument from './DebugArgument.js';

import type { Argument } from '../../../action/action.js';

const DebugChoices = ({ choices }: {
  choices?: { label?: string; choice: Argument, error?: string}[] ,
}) => {
  if (!choices?.length) return null;

  return (
    <span>
      {choices.map((c, i) => (
        <span key={i} style={{ textDecoration: c.error ? 'line-through' : 'none' }}>
          {i ? ', ' : ''}<DebugArgument argument={c.choice}/>
          {c.error && ` (${c.error})`}
        </span>
      ))}
    </span>
  );
}

export default DebugChoices;
