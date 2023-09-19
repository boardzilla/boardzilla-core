import Loop from './loop';
import Flow from './flow';
import { serializeSingleArg, deserializeSingleArg } from '../action/utils';

import type { SingleArgument } from '../action/types';

export default class ForEach extends Loop<SingleArgument> {
  collection: ((a: Record<any, any>) => SingleArgument[]) | SingleArgument[]
  position: { index: number, value?: SingleArgument, collection: SingleArgument[] };
  type = 'foreach';

  constructor({ name, collection, do: block }: {
    name?: string,
    collection: ((a: Record<any, any>) => SingleArgument[]) | SingleArgument[],
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

  positionJSON(forPlayer=true) {
    return {
      index: this.position.index,
      value: this.position.value ? serializeSingleArg(this.position.value) : undefined,
      collection: this.position.collection.map(a => serializeSingleArg(a, forPlayer))
    };
  }

  setPositionFromJSON(position: any) {
    this.setPosition({
      index: position.index,
      value: deserializeSingleArg(position.value, this.ctx.game),
      collection: position.collection.map((a: any) => deserializeSingleArg(a, this.ctx.game))
    }, false);
  }

  toString(): string {
    return `foreach${this.name ? ":" + this.name : ""} (index: ${this.position.index}, value: ${this.position.value})$`;
  }
}

// export default<T> (name: string, collection: T[], block: (i: T) => FlowStep) => new ForEach(name, collection, block);
