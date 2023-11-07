import ForLoop from './for-loop.js';
import { serialize, deserialize } from '../action/utils.js';

import type { FlowArguments, FlowDefinition, ForEachPosition, FlowBranchNode } from './types.d.ts';
import type { Serializable } from '../action/types.d.ts';
import type { Player } from '../player/index.js';

export default class ForEach<P extends Player, T extends Serializable<P>> extends ForLoop<P, T> {
  collection: ((a: FlowArguments) => T[]) | T[]
  position: ForEachPosition<T>;
  type: FlowBranchNode<P>['type'] = 'foreach';

  constructor({ name, collection, do: block }: {
    name: string,
    collection: ((a: FlowArguments) => T[]) | T[],
    do: FlowDefinition<P>
  }) {
    super({
      name,
      initial: () => ((typeof collection === 'function') ? collection(this.flowStepArgs()) : collection)[0],
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

  toJSON(forPlayer=true) {
    return {
      index: this.position.index,
      value: serialize(this.position.value, forPlayer),
      collection: serialize(this.position.collection, forPlayer)
    };
  }

  fromJSON(position: any) {
    return {
      index: position.index,
      value: deserialize(position.value, this.game),
      collection: deserialize(position.collection, this.game)
    };
  }

  toString(): string {
    return `foreach${this.name ? ":" + this.name : ""} (index: ${this.position.index}, value: ${this.position.value})$`;
  }
}
