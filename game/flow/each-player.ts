import Flow from './flow';
import { Player } from '../player';
import { Loop } from './';

export default class EachPlayer<P extends Player> extends Loop<P> {
  type = 'each-player';
  position: { index: number, value?: P };

  constructor({ name, startingPlayer, nextPlayer, turns, continueUntil, do: block }: {
    name?: string,
    startingPlayer?: ((a: Record<any, any>) => P) | P,
    nextPlayer?: (p: P) => P,
    turns?: never,
    continueUntil: (p: P) => boolean,
    do: Flow,
  } | {
    name?: string,
    startingPlayer?: ((a: Record<any, any>) => P) | P,
    nextPlayer?: never,
    turns?: number,
    continueUntil?: never,
    do: Flow,
  }) {
    let initial: (r: Record<any, any>) => P
    if (startingPlayer) {
      initial = () => startingPlayer instanceof Function ? startingPlayer(this.flowStepArgs()) : startingPlayer
    } else {
      initial = () => this.ctx.game.players.current() as P;
    }
    let next = (player: P) => (nextPlayer ? nextPlayer(player) : this.ctx.game.players.after(player)) as P;

    super({
      name,
      initial,
      next,
      while: player => continueUntil !== undefined ? !continueUntil(player) : this.position.index < this.ctx.game.players.length * (turns || 1),
      do: block
    });
  }

  setPosition(position: typeof this.position, reset=true) {
    super.setPosition(position, reset);
    if (this.position.value) {
      this.ctx.game.players.setCurrent(this.position.value);
      this.ctx.game.board._ctx.player = this.position.value;
    }
  }

  toString(): string {
    return `each-player${this.name ? ":" + this.name : ""} (player: ${this.position?.value?.position}`;
  }
}
