import Flow from './flow';
import SwitchCase from './switch-case';

import type { Player } from '../player';

export default class If<P extends Player> extends SwitchCase<P, boolean> {
  type = "if-else";

  constructor({ name, test, do: doExpr, else: elseExpr }: {
    name: string,
    test: (r: Record<any, any>) => boolean,
    do: Flow<P>;
    else?: Flow<P>
  }) {
    super({ name, switch: test, cases: [{ eq: true, flow: doExpr }], default: elseExpr });
  }

  toString(): string {
    return `if-else${this.name ? ":" + this.name : ""} (${this.position.value})`;
  }
}
