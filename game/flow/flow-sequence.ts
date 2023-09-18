import Flow from './flow';
import type { SequencePosition } from './types.d';

export default class FlowSequence extends Flow {
  subflows: Flow[];
  position: SequencePosition;
  type = "sequence";

  constructor({ name, steps }: { name?: string, steps: Flow[] }) {
    super({ name });
    steps.forEach(step => step.parent = this);
    this.subflows = steps;
  }

  reset() {
    this.setPosition(0);
  }

  currentSubflow(): Flow {
    if (typeof this.position !== "number") throw Error(`Invalid flow position: ${this.position}`);
    if (!this.subflows[this.position]) {
      throw Error(`Cannot set flow ${this.name} to position ${this.position}`);
    }
    return this.subflows[this.position];
  }

  advance() {
    if (this.position + 1 === this.subflows.length) return 'complete';
    this.setPosition(this.position + 1);
    return 'ok';
  }

  toString(): string {
    return `sequence${this.name ? ":" + this.name : ""}`;
  }
}
