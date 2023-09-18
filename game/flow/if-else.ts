import Flow from './flow';
import SwitchCase from './switch-case';

export default class If extends SwitchCase<boolean> {
  type = "if-else";

  constructor({ name, test, do: doExpr, else: elseExpr }: {
    name: string,
    test: (r: Record<any, any>) => boolean,
    do: Flow;
    else?: Flow
  }) {
    super({ name, switch: test, cases: [{ eq: true, flow: doExpr }], default: elseExpr });
  }

  toString(): string {
    return `if-else${this.name ? ":" + this.name : ""} (${this.position.value})`;
  }
}
