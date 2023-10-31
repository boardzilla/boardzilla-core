import Flow from './flow';
import { FlowControl } from './';

import type { Player } from '../player';
import type { FlowArguments, FlowDefinition, WhileLoopPosition, FlowBranchNode } from './types';

export default class WhileLoop<P extends Player> extends Flow<P> {
  block: FlowDefinition<P>;
  position: WhileLoopPosition;
  while: (a: FlowArguments) => boolean;
  type: FlowBranchNode<P>['type'] = 'loop';

  constructor({ do: block, while: whileCondition }: {
    while: (a: FlowArguments) => boolean,
    do: FlowDefinition<P>
  }) {
    super({ do: block });
    this.while = whileCondition;
  }

  reset() {
    const position: typeof this.position = { index: 0 };
    this.setPosition(position);
    if (!this.while(this.flowStepArgs())) this.setPosition({...position, index: -1});
  }

  currentBlock() {
    if (this.position.index !== -1) return this.block;
  }

  advance() {
    const position: typeof this.position = { index: this.position.index + 1 };
    this.setPosition(position);
    if (!this.while(this.flowStepArgs())) return this.exit();
    return FlowControl.ok;
  }

  repeat() {
    this.setPosition(this.position);
    if (!this.while(this.flowStepArgs())) return this.exit();
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
    return `loop${this.name ? ":" + this.name : ""} (index: ${this.position.index})$`;
  }
}
