import ForLoop from './for-loop';
import { Player } from '../player';
import { serializeSingleArg, deserializeSingleArg } from '../action/utils';

import type { FlowDefinition } from './types';

export default class EachPlayer<P extends Player> extends ForLoop<P, P> {
  constructor({ name, startingPlayer, nextPlayer, turns, continueUntil, do: block }: {
    name: string,
    startingPlayer?: ((a: Record<any, any>) => P) | P,
    nextPlayer?: (p: P) => P,
    turns?: number,
    continueUntil?: (p: P) => boolean,
    do: FlowDefinition<P>,
  }) {
    let initial: (r: Record<any, any>) => P
    if (startingPlayer) {
      initial = () => startingPlayer instanceof Function ? startingPlayer(this.flowStepArgs()) : startingPlayer
    } else {
      initial = () => this.game.players.current();
    }
    let next = (player: P) => (nextPlayer ? nextPlayer(player) : this.game.players.after(player));

    super({
      name,
      initial,
      next,
      while: player => continueUntil !== undefined ? !continueUntil(player) : this.position.index < this.game.players.length * (turns || 1),
      do: block
    });
  }

  setPosition(position: typeof this.position, sequence?: number, reset=true) {
    super.setPosition(position, sequence, reset);
    if (typeof this.position.value === 'string') throw Error(this.position.value);
    if (this.position.value) {
      this.game.players.setCurrent(this.position.value);
      this.game.board._ctx.player = this.position.value;
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
    return `each-player${this.name ? ":" + this.name : ""} (player: ${this.position?.value?.position}`;
  }
}
