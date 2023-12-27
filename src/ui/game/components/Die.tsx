import React from 'react';

import type Die from '../../../board/die.js';

const DieComponent = (die: Die) => {
  return die.current;
}

export default DieComponent;
