import Loop from './loop';
import Flow from './flow';
import { serializeSingleArg, deserializeSingleArg } from '../action/utils';

import type { SingleArgument } from '../action/types';
import type { Player } from '../player';

export default class ForEach<P extends Player> extends Loop<P, SingleArgument<P>> {
  collection: ((a: Record<any, any>) => SingleArgument<P>[]) | SingleArgument<P>[]
  position: { index: number, value?: SingleArgument<P>, collection: SingleArgument<P>[] };
  type = 'foreach';

  constructor({ name, collection, do: block }: {
    name?: string,
    collection: ((a: Record<any, any>) => SingleArgument<P>[]) | SingleArgument<P>[],
    do: Flow<P>,
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
      value: this.position.value ? serializeSingleArg<P>(this.position.value) : undefined,
      collection: this.position.collection.map(a => serializeSingleArg<P>(a, forPlayer))
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
