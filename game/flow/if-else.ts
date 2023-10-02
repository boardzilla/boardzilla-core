import SwitchCase from './switch-case';

import type { FlowDefinition } from './types';
import type { Player } from '../player';

export default class If<P extends Player> extends SwitchCase<P, boolean> {
  constructor({ name, test, do: doExpr, else: elseExpr }: {
    name?: string,
    test: (r: Record<any, any>) => boolean,
    do: FlowDefinition<P>;
    else?: FlowDefinition<P>
  }) {
    super({ name, switch: test, cases: [{ eq: true, do: doExpr }], default: elseExpr });
  }

  toString(): string {
    return `if-else${this.name ? ":" + this.name : ""} (${this.position.index})`;
  }
}
