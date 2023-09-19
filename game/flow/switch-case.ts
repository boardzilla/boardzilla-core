import Flow from './flow';
import { serializeSingleArg, deserializeSingleArg } from '../action/utils';

import type { SingleArgument } from '../action/types';
import type { SwitchCaseCases } from './types';

export default class SwitchCase<T extends SingleArgument> extends Flow {
  position: { index?: number, default?: boolean, value: T };
  switch: ((r: Record<any, any>) => T) | T;
  cases: SwitchCaseCases<T>;
  default?: Flow;
  type = "switch-case";

  constructor({ name, switch: switchExpr, cases, default: def }: {
    name: string,
    switch: ((r: Record<any, any>) => T) | T,
    cases: SwitchCaseCases<T>;
    default?: Flow
  }) {
    super({ name });
    this.switch = switchExpr;
    cases.forEach(c => c.flow.parent = this);
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
    if (position.index === -1 && this.default) position = { default: true, value: test };
    this.setPosition(position);
  }
  
  currentSubflow() {
    if (this.position.index !== undefined && this.position.index >= 0) {
      return this.cases[this.position.index].flow;
    }
    if (this.position.default) return this.default;
  }

  positionJSON(forPlayer=true) {
    return {
      index: this.position.index,
      default: this.position.default,
      value: serializeSingleArg(this.position.value, forPlayer)
    };
  }

  setPositionFromJSON(position: any) {
    this.setPosition({
      index: position.index,
      default: position.default,
      value: deserializeSingleArg(position.value, this.ctx.game)
    }, false);
  }

  toString(): string {
    return `switch-case${this.name ? ":" + this.name : ""} (${this.position.value})`;
  }
}
