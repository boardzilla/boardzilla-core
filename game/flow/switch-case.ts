import Flow from './flow';

import { serialize, deserialize } from '../action/utils';

import type { FlowDefinition, FlowBranchNode, SwitchCaseCases, SwitchCasePostion } from './types';
import type { Player } from '../player';
import type { Serializable } from '../action/types';

export default class SwitchCase<P extends Player, T extends Serializable<P>> extends Flow<P> {
  position: SwitchCasePostion<T>;
  switch: ((a?: Record<string, any>) => T) | T;
  cases: SwitchCaseCases<P, T>;
  default?: FlowDefinition<P>;
  type: FlowBranchNode<P>['type'] = "switch-case";

  constructor({ name, switch: switchExpr, cases, default: def }: {
    name?: string,
    switch: ((r: Record<string, any>) => T) | T,
    cases: SwitchCaseCases<P, T>;
    default?: FlowDefinition<P>
  }) {
    super({ name });
    this.switch = switchExpr;
    this.cases = cases;
    this.default = def;
  }

  reset() {
    const test = (typeof this.switch === 'function') ? this.switch(this.flowStepArgs()) : this.switch;
    let position: typeof this.position = { index: -1, value: test }
    for (let c = 0; c != this.cases.length; c += 1) {
      const ca = this.cases[c];
      if ('test' in ca && ca.test(test) || ('eq' in ca && ca.eq === test)) {
        position.index = c;
      }
    }
    if (position.index === -1 && this.default) position.default = true;
    this.setPosition(position);
  }
  
  currentBlock() {
    if (this.position.default) return this.default;
    if (this.position.index !== undefined && this.position.index >= 0) {
      return this.cases[this.position.index].do;
    }
  }

  toJSON(forPlayer=true) {
    return {
      index: this.position.index,
      value: serialize<P>(this.position.value, forPlayer),
      default: !!this.position.default
    };
  }

  fromJSON(position: any) {
    return {
      index: position.index,
      value: deserialize(position.value, this.game),
      default: position.default,
    };
  }

  toString(): string {
    return `switch-case${this.name ? ":" + this.name : ""} (${this.position.index})`;
  }
}
