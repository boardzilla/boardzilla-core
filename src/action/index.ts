import {default as Action, Argument} from './action.js';
export {default as Selection} from './selection.js';

import type { Player} from '../index.js';

export {
  Action,
}
export {
  serializeArg,
  deserializeArg
} from './utils.js';

export const action = <P extends Player, A extends Record<string, Argument<P>> = Record<string, never>>(definition: {
  prompt?: string,
  condition?: Action<P, A>['condition'],
}) => new Action<P, A>(definition);
