import Flow from './flow';

import type { Player } from '../player';
import type { Serializable } from '../action/types';
import type { FlowDefinition, ForLoopPosition, FlowBranchNode } from './types';

export default class ForLoop<P extends Player, T = Serializable<P>> extends Flow<P> {
  block: FlowDefinition<P>;
  position: ForLoopPosition<T>;
  initial: ((a?: Record<string, any>) => T) | T;
  next: (a: T) => T;
  while: (a: T) => boolean;
  type: FlowBranchNode<P>['type'] = 'loop';

  constructor({ name, initial, next, do: block, while: whileCondition }: {
    name: string,
    initial: ((a: Record<string, any>) => T) | T,
    next: (a: T) => T,
    while: (a: T) => boolean,
    do: FlowDefinition<P>
  }) {
    super({ name, do: block });
    this.initial = initial;
    this.next = next;
    this.while = whileCondition;
  }

  reset() {
    const position: typeof this.position = {
      index: 0,
      value: (this.initial instanceof Function ? this.initial(this.flowStepArgs()) : this.initial) as T
    }
    this.setPosition(position);
    if (!this.while(position.value)) this.setPosition({...position, index: -1});
  }
  
  currentBlock() {
    if (this.position.index !== -1) return this.block;
  }

  advance() {
    const position: typeof this.position = { ...this.position, index: this.position.index + 1 };
    if (this.next && this.position.value !== undefined) position.value = this.next(this.position.value);
    this.setPosition(position);
    if (!this.while(position.value)) {
      this.setPosition({...position, index: -1});
      return 'complete';
    }
    return 'ok';
  }

  repeat() {
    this.setPosition(this.position);
    if (!this.while(this.position.value)) {
      this.setPosition({...this.position, index: -1});
      return 'complete';
    }
    return 'ok';
  }

  toString(): string {
    return `loop${this.name ? ":" + this.name : ""} (index: ${this.position.index}, value: ${this.position.value})$`;
  }
}
