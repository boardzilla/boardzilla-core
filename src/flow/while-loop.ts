import Flow from './flow.js';
import { FlowControl } from './index.js';

import type { Player } from '../player/index.js';
import type { FlowArguments, FlowDefinition, FlowBranchNode } from './flow.js';

export type WhileLoopPosition = { index: number };

export default class WhileLoop<P extends Player> extends Flow<P> {
  block: FlowDefinition<P>;
  position: WhileLoopPosition;
  while: boolean | ((a: FlowArguments) => boolean);
  type: FlowBranchNode<P>['type'] = 'loop';

  constructor({ do: block, while: whileCondition }: {
    while: boolean | ((a: FlowArguments) => boolean),
    do: FlowDefinition<P>
  }) {
    super({ do: block });
    this.while = whileCondition;
  }

  reset() {
    const position: typeof this.position = { index: 0 };
    if (!this.validPosition()) {
      this.setPosition({...position, index: -1});
    } else {
      this.setPosition(position);
    }
  }

  validPosition() {
    return typeof this.while === 'function' ? this.while(this.flowStepArgs()) : this.while;
  }

  currentBlock() {
    if (this.position.index !== -1) return this.block;
  }

  advance() {
    if (this.position.index > 10000) throw Error(`Endless loop detected: ${this.name}`);
    const position: typeof this.position = { index: this.position.index + 1 };
    if (!this.validPosition()) return this.exit();
    this.setPosition(position);
    return FlowControl.ok;
  }

  repeat() {
    this.setPosition(this.position);
    if (typeof this.while === 'function' ? !this.while(this.flowStepArgs()) : !this.while) return this.exit();
    return FlowControl.ok;
  }

  exit(): FlowControl.complete {
    this.setPosition({...this.position, index: -1});
    return FlowControl.complete;
  }

  allSteps() {
    return this.block;
  }

  toString(): string {
    return `loop${this.name ? ":" + this.name : ""} (loop #${this.position.index}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }
}
