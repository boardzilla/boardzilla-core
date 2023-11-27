import {default as Action} from './action.js';
export {default as Selection} from './selection.js';

import type { Player} from '../index.js';

export {
  Action,
}
export {
  humanizeArg,
  serializeArg,
  deserializeArg
} from './utils.js';

export const action = <P extends Player>(definition: {
  prompt?: string,
  condition?: Action<P>['condition'],
}) => new Action<P>(definition);
