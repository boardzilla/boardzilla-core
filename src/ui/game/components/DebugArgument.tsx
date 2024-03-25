import React from 'react';
import { gameStore } from '../../store.js';

import type { Argument } from '../../../action/action.js';
import type { GameElement } from '../../../index.js';

const DebugArgument = ({ argument }: {
  argument?: Argument
}) => {
  const [setInfoElement] = gameStore(s => [s.setInfoElement]);
  if (argument) return (
    typeof argument === 'object' && 'isGameElement' in argument.constructor ? (
      <a onClick={e => {e.stopPropagation(); setInfoElement({ info: true, element: argument as GameElement })}}>{String(argument)}</a>
    ) : String(argument)
  );
}

export default DebugArgument;
