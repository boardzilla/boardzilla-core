import ForLoop from './for-loop.js';
import { serialize, deserialize } from '../action/utils.js';

import type { FlowArguments, FlowDefinition, FlowBranchNode } from './flow.js';
import type { ForLoopPosition } from './for-loop.js';
import type { Serializable } from '../action/utils.js';
import type Flow from './flow.js';

export type ForEachPosition<T> = ForLoopPosition<T> & { collection: T[] };

export default class ForEach<T extends Serializable> extends ForLoop<T> {
  collection: ((a: FlowArguments) => T[]) | T[]
  position: ForEachPosition<T>;
  whileCondition: (position: ForEachPosition<T>) => boolean;
  type: FlowBranchNode['type'] = 'foreach';

  constructor({ name, collection, do: block }: {
    name: string,
    collection: ((a: FlowArguments) => T[]) | T[],
    do: FlowDefinition
  }) {
    super({
      name,
      initial: () => ((typeof collection === 'function') ? collection(this.flowStepArgs()) : collection)[0],
      next: () => this.position.collection[this.position.index + 1],
      while: () => true,
      do: block
    });
    this.collection = collection;
    this.whileCondition = position => position.index >= 0 && position.index < position.collection.length;
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
      value: deserialize(position.value, this.gameManager.game),
      collection: deserialize(position.collection, this.gameManager.game)
    };
  }

  toString(): string {
    return `foreach${this.name ? ":" + this.name : ""} (index: ${this.position.index}, value: ${this.position.value}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }

  visualize(top: Flow) {
    return this.visualizeBlocks({
      type: 'forEach',
      top,
      blocks: {
        do: this.block instanceof Array ? this.block : [this.block]
      },
      block: 'do',
      position: this.position?.value,
    });
  }
}
