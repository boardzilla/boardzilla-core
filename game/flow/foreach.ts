import Loop from './loop';
import Flow from './flow';
import { serializeArg, deserializeArg } from '../action/utils';

import type { Argument } from '../action/types';

export default class ForEach extends Loop<Argument> {
  collection: ((a: Record<any, any>) => Argument[]) | Argument[]
  position: { index: number, value?: Argument, collection: Argument[] };
  type = 'foreach';

  constructor({ name, collection, do: block }: {
    name?: string,
    collection: ((a: Record<any, any>) => Argument[]) | Argument[],
    do: Flow,
  }) {
    super({
      name,
      next: () => this.position.collection[this.position.index + 1],
      while: () => this.position.index >= 0 && this.position.index < this.position.collection.length,
      do: block
    });
    this.collection = collection;
  }

  reset() {
    const collection = (typeof this.collection === 'function') ? this.collection(this.flowStepArgs()) : this.collection;
    this.setPosition({ index: collection.length ? 0 : -1, value: collection[0], collection });
  }

  positionJSON() {
    return {
      index: this.position.index,
      value: this.position.value ? serializeArg(this.position.value) : undefined,
      collection: this.position.collection.map(serializeArg)
    };
  }

  setPositionFromJSON(position: any) {
    this.setPosition({
      index: position.index,
      value: deserializeArg(position.value, this.ctx.game),
      collection: position.collection.map((a: any) => deserializeArg(a, this.ctx.game))
    }, false);
  }

  toString(): string {
    return `foreach${this.name ? ":" + this.name : ""} (index: ${this.position.index}, value: ${this.position.value})$`;
  }
}

// export default<T> (name: string, collection: T[], block: (i: T) => FlowStep) => new ForEach(name, collection, block);
