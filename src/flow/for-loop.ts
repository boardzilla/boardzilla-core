import Flow from './flow.js';

import type { Player } from '../player/index.js';
import type { Serializable } from '../action/utils.js';
import type { FlowArguments, FlowDefinition, FlowBranchNode } from './flow.js';
import { FlowControl } from './enums.js';

export type ForLoopPosition<T> = { index: number, value: T };

export default class ForLoop<P extends Player, T = Serializable<P>> extends Flow<P> {
  block: FlowDefinition<P>;
  position: ForLoopPosition<T>;
  initial: ((a: FlowArguments) => T) | T;
  next: (a: T) => T;
  while: (a: T) => boolean;
  type: FlowBranchNode<P>['type'] = 'loop';

  constructor({ name, initial, next, do: block, while: whileCondition }: {
    name: string,
    initial: ((a: FlowArguments) => T) | T,
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
    if (!this.validPosition(position)) {
      this.setPosition({...position, index: -1});
    } else {
      this.setPosition(position);
    }
  }

  validPosition(position: typeof this.position) {
    return this.while(position.value);
  }
  
  currentBlock() {
    if (this.position.index !== -1) return this.block;
  }

  advance() {
    if (this.position.index > 10000) throw Error(`Endless loop detected: ${this.name}`);
    if (this.position.index === -1) return FlowControl.complete;
    const position: typeof this.position = { ...this.position, index: this.position.index + 1 };
    if (this.next && this.position.value !== undefined) position.value = this.next(this.position.value);
    if (!this.validPosition(position)) return this.exit();
    this.setPosition(position);
    return FlowControl.ok;
  }

  repeat() {
    if (!this.validPosition(this.position)) return this.exit();
    this.setPosition(this.position);
    return FlowControl.ok;
  }

  exit(): FlowControl.complete {
    this.setPosition({...this.position, index: -1});
    return FlowControl.complete;
  }

  toString(): string {
    return `loop${this.name ? ":" + this.name : ""} (index: ${this.position.index}, value: ${this.position.value}${this.block instanceof Array ? ', item #' + this.sequence: ''})$`;
  }
}
