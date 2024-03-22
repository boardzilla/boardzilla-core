import SwitchCase from './switch-case.js';

import type { FlowDefinition, FlowStep } from './flow.js';

export default class If extends SwitchCase<boolean> {
  constructor({ name, if: test, do: doExpr, else: elseExpr }: {
    name?: string,
    if: (r: Record<any, any>) => boolean,
    do: FlowDefinition;
    else?: FlowDefinition
  }) {
    super({ name, switch: test, cases: [{ eq: true, do: doExpr }], default: elseExpr });
  }

  toString(): string {
    return `if-else${this.name ? ":" + this.name : ""} (${!!this.position.value}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }

  visualize() {
    const blocks = {
      do: this.cases[0].do instanceof Array ? this.cases[0].do : [this.cases[0].do],
    } as Record<string, FlowStep[]>;
    if (this.default) blocks.else = this.default instanceof Array ? this.default : [this.default];

    return this.visualizeBlocks({
      type: 'ifElse',
      blocks,
      block: this.position ? (this.position.default ? 'else' : 'do') : undefined,
      position: this.position?.value,
    });
  }
}
