import type { Player } from '../player/index.js';
import type { Serializable } from '../action/utils.js';
import type { FlowArguments, FlowDefinition, FlowBranchNode } from './flow.js';
import WhileLoop from './while-loop.js';

export type ForLoopPosition<T> = { index: number, value: T };

export default class ForLoop<T = Serializable> extends WhileLoop {
  block: FlowDefinition;
  position: ForLoopPosition<T>;
  initial: ((a: FlowArguments) => T) | T;
  whileCondition: (position: ForLoopPosition<T>) => boolean;
  next: (a: T) => T;
  type: FlowBranchNode['type'] = 'loop';

  constructor({ name, initial, next, do: block, while: whileCondition }: {
    name: string,
    initial: ((a: FlowArguments) => T) | T,
    next: (a: T) => T,
    while: (a: T) => boolean,
    do: FlowDefinition
  }) {
    super({ do: block, while: () => true });
    this.name = name;
    this.initial = initial;
    this.next = next;
    this.whileCondition = position => whileCondition(position.value)
  }
  
  currentBlock() {
    if (this.position.index !== -1) return this.block;
  }

  toString(): string {
    return `loop${this.name ? ":" + this.name : ""} (index: ${this.position.index}, value: ${this.position.value}${this.block instanceof Array ? ', item #' + this.sequence: ''})$`;
  }

  visualize() {
    return this.visualizeBlocks({
      type: 'forLoop',
      blocks: {
        do: this.block instanceof Array ? this.block : [this.block]
      },
      block: 'do',
      position: this.position?.value,
    });
  }
}
