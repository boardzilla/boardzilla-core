import ForLoop from './for-loop';
import { serialize, deserialize } from '../action/utils';

import type { FlowDefinition, ForEachPosition, FlowBranchNode } from './types';
import type { Serializable } from '../action/types';
import type { Player } from '../player';

export default class ForEach<P extends Player, T extends Serializable<P>> extends ForLoop<P, T> {
  collection: ((a?: Record<string, any>) => T[]) | T[]
  position: ForEachPosition<T>;
  type: FlowBranchNode<P>['type'] = 'foreach';

  constructor({ name, collection, do: block }: {
    name: string,
    collection: ((a: Record<string, any>) => T[]) | T[],
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
