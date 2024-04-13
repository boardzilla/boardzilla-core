import ForLoop from './for-loop.js';
import { Player } from '../player/index.js';
import { serializeSingleArg, deserializeSingleArg } from '../action/utils.js';

import type { FlowArguments, FlowDefinition } from './flow.js';
import type Flow from './flow.js';

export default class EachPlayer<P extends Player> extends ForLoop<P> {
  continueUntil?: (p: P) => boolean;
  turns?: number;

  constructor({ name, startingPlayer, nextPlayer, turns, continueUntil, do: block }: {
    name: string,
    startingPlayer?: ((a: FlowArguments) => P) | P,
    nextPlayer?: (p: P) => P,
    turns?: number,
    continueUntil?: (p: P) => boolean,
    do: FlowDefinition,
  }) {
    let initial: (r: Record<any, any>) => P
    if (startingPlayer) {
      initial = () => startingPlayer instanceof Function ? startingPlayer(this.flowStepArgs()) : startingPlayer
    } else {
      initial = () => this.gameManager.players[0] as P;
    }
    let next = (player: P) => (nextPlayer ? nextPlayer(player) : this.gameManager.players.after(player)) as P;

    super({
      name,
      initial,
      next,
      while: () => true,
      do: block
    });

    this.whileCondition = position => continueUntil !== undefined ? !continueUntil(position.value) : position.index < this.gameManager.players.length * (this.turns || 1)
    this.turns = turns;
  }

  setPosition(position: typeof this.position, sequence?: number, reset=true) {
    if (position.value && position.value.position !== this.position?.value.position) {
      this.gameManager.players.setCurrent(position.value);
    }
    super.setPosition(position, sequence, reset);
  }

  toJSON() {
    return {
      index: this.position.index,
      value: this.position.value ? serializeSingleArg(this.position.value) : undefined
    };
  }

  fromJSON(position: any) {
    return {
      index: position.index,
      value: position.value ? deserializeSingleArg(position.value, this.gameManager.game) as P: undefined
    }
  }

  allSteps() {
    return this.block;
  }

  toString(): string {
    return `each-player${this.name ? ":" + this.name : ""} (player #${this.position?.value?.position}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }

  visualize(top: Flow) {
    return this.visualizeBlocks({
      type: 'eachPlayer',
      top,
      blocks: {
        do: this.block instanceof Array ? this.block : [this.block]
      },
      block: 'do',
      position: this.position?.value,
    });
  }
}
