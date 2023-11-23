import SwitchCase from './switch-case.js';

import type { FlowDefinition } from './flow.js';
import type { Player } from '../player/index.js';

export default class If<P extends Player> extends SwitchCase<P, boolean> {
  constructor({ name, if: test, do: doExpr, else: elseExpr }: {
    name?: string,
    if: (r: Record<any, any>) => boolean,
    do: FlowDefinition<P>;
    else?: FlowDefinition<P>
  }) {
    super({ name, switch: test, cases: [{ eq: true, do: doExpr }], default: elseExpr });
  }

  toString(): string {
    return `if-else${this.name ? ":" + this.name : ""} (${!!this.position.value}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }
}
