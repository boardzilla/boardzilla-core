import {default as Action} from './action';
export {default as Selection} from './selection';

import type { Player} from '../';

export {
  Action,
}
export {
  humanizeArg,
  serializeArg,
  deserializeArg
} from './utils';

export const action = <P extends Player>(definition: {
  prompt: string,
  condition?: Action<P, []>['condition'],
  message?: Action<P, []>['message']
}) => new Action<P, []>(definition);
