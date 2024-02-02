import Flow from './flow.js';
import { FlowControl } from './index.js';

import type { Player } from '../player/index.js';
import type { FlowArguments, FlowDefinition, FlowBranchNode } from './flow.js';

export type WhileLoopPosition = { index: number, value?: any };

export default class WhileLoop<P extends Player> extends Flow<P> {
  block: FlowDefinition<P>;
  position: WhileLoopPosition;
  whileCondition: (position: WhileLoopPosition) => boolean;
  type: FlowBranchNode<P>['type'] = 'loop';
  next?: (...a: any) => void;
  initial?: any;

  constructor({ do: block, while: whileCondition }: {
    while: (a: FlowArguments) => boolean,
    do: FlowDefinition<P>,
  }) {
    super({ do: block });
    this.whileCondition = () => whileCondition(this.flowStepArgs());
  }

  reset() {
    const position: typeof this.position = { index: 0 };
    if (this.initial !== undefined) position.value = this.initial instanceof Function ? this.initial(this.flowStepArgs()) : this.initial

    if (!this.whileCondition(position)) {
      this.setPosition({...position, index: -1});
    } else {
      this.setPosition(position);
    }
  }

  currentBlock() {
    if (this.position.index !== -1) return this.block;
  }

  advance() {
    if (this.position.index > 10000) throw Error(`Endless loop detected: ${this.name}`);
    const position: typeof this.position = { ...this.position, index: this.position.index + 1 };
    if (this.next && this.position.value !== undefined) position.value = this.next(this.position.value);
    if (!this.whileCondition(position)) return this.exit();
    this.setPosition(position);
    return FlowControl.ok;
  }

  repeat() {
    if (!this.whileCondition(this.position)) return this.exit();
    this.setPosition(this.position);
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
    return `loop${this.name ? ":" + this.name : ""} (loop ${this.position.index === -1 ? 'complete' : '#' + this.position.index}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }

  visualize() {
    const isLoop = this.whileCondition.toString() === '() => true';
    return this.visualizeBlocks({
      type: isLoop ? 'loop' : 'whileLoop',
      blocks: {
        do: this.block instanceof Array ? this.block : [this.block]
      },
      block: 'do',
      position: this.position ? this.position.index + 1 : undefined,
    });
  }
}
