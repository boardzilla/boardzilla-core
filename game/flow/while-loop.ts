import Flow from './flow';

import type { Player } from '../player';
import type { FlowDefinition, WhileLoopPosition, FlowBranchNode } from './types';

export default class WhileLoop<P extends Player> extends Flow<P> {
  block: FlowDefinition<P>;
  position: WhileLoopPosition;
  while: () => boolean;
  type: FlowBranchNode<P>['type'] = 'loop';

  constructor({ name, do: block, while: whileCondition }: {
    name?: string,
    while: () => boolean,
    do: FlowDefinition<P>
  }) {
    super({ name, do: block });
    this.while = whileCondition;
  }

  reset() {
    const position: typeof this.position = { index: 0 };
    this.setPosition(position);
    if (!this.while()) this.setPosition({...position, index: -1});
  }

  currentBlock() {
    if (this.position.index !== -1) return this.block;
  }

  advance() {
    const position: typeof this.position = { index: this.position.index + 1 };
    this.setPosition(position);
    if (!this.while()) {
      this.setPosition({ index: -1});
      return 'complete';
    }
    return 'ok';
  }

  repeat() {
    this.setPosition(this.position);
    if (!this.while()) {
      this.setPosition({...this.position, index: -1});
      return 'complete';
    }
    return 'ok';
  }

  toString(): string {
    return `loop${this.name ? ":" + this.name : ""} (index: ${this.position.index})$`;
  }
}
