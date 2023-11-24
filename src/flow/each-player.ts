import ForLoop from './for-loop.js';
import { Player } from '../player/index.js';
import { serializeSingleArg, deserializeSingleArg } from '../action/utils.js';

import type { FlowArguments, FlowDefinition } from './flow.js';

export default class EachPlayer<P extends Player> extends ForLoop<P, P> {
  continueUntil?: (p: P) => boolean;
  turns?: number;

  constructor({ name, startingPlayer, nextPlayer, turns, continueUntil, do: block }: {
    name: string,
    startingPlayer?: ((a: FlowArguments) => P) | P,
    nextPlayer?: (p: P) => P,
    turns?: number,
    continueUntil?: (p: P) => boolean,
    do: FlowDefinition<P>,
  }) {
    let initial: (r: Record<any, any>) => P
    if (startingPlayer) {
      initial = () => startingPlayer instanceof Function ? startingPlayer(this.flowStepArgs()) : startingPlayer
    } else {
      initial = () => this.game.players[0];
    }
    let next = (player: P) => (nextPlayer ? nextPlayer(player) : this.game.players.after(player));

    super({
      name,
      initial,
      next,
      while: () => true,
      do: block
    });

    this.whileCondition = position => continueUntil !== undefined ? !continueUntil(position.value) : position.index < this.game.players.length * (this.turns || 1)
    this.turns = turns;
  }

  setPosition(position: typeof this.position, sequence?: number, reset=true) {
    super.setPosition(position, sequence, reset);
    if (this.position.value) {
      this.game.players.setCurrent(this.position.value);
      this.game.contextualizeBoardToPlayer(this.position.value);
    }
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
      value: position.value ? deserializeSingleArg(position.value, this.game) as P: undefined
    }
  }

  allSteps() {
    return this.block;
  }

  toString(): string {
    return `each-player${this.name ? ":" + this.name : ""} (player: ${this.position?.value?.position}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }
}
