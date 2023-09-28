import Flow from './flow';
import { serializeArg, deserializeArg } from '../action/utils';

import type { ActionStepPosition } from './types.d';
import type { Player } from '../player';
import type { ResolvedSelection } from '../action/types';

export default class PlayerAction<P extends Player> extends Flow<P> {
  position: ActionStepPosition<P> | undefined;
  actions: Record<string, Flow<P> | null>;
  type = "action";
  prompt?: string;

  constructor({ name, actions, prompt }: { name?: string, actions: Record<string, Flow<P> | null>, prompt?: string }) {
    super({ name });
    for (const action of Object.values(actions)) {
      if (action) action.parent = this;
    };
    this.actions = actions;
    this.prompt = prompt;
  }

  reset() {
    this.position = undefined;
  }

  currentSubflow() {
    if (!this.position) return;
    const step = this.actions[this.position.action];
    if (step) return step;
  }

  awaitingAction() {
    if (!this.position) {
      return Object.keys(this.actions);
    }
  }

  processMove(move: ActionStepPosition<P>) {
    if (!(move.action in this.actions)) throw Error(`No action ${move.action} available at this point. Waiting for ${Object.keys(this.actions).join(", ")}`);
    const game = this.ctx.game;

    if (game.players.currentPosition && move.player !== game.players.currentPosition) {
      throw Error(`move ${move.action} from player #${move.player} not allowed. player #${game.players.currentPosition} turn`);
    }

    const player = game.players.atPosition(move.player)!;
    const gameAction = game.action(move.action, player);
    const response = gameAction.process(...move.args);
    if (response[0]) {
      // failed with a selection required
      return response;
    } else {
      // succeeded
      this.setPosition(move);
      const message = gameAction.message;
      if (message) {
        if (typeof message === 'function') {
          this.ctx.game.message(message(...move.args));
        } else {
          this.ctx.game.message(message, ...move.args, {player});
        }          
      }
      return [] as [ResolvedSelection<P>?]
    }
  }

  positionJSON(forPlayer=true) {
    if (this.position) return {
      player: this.position.player,
      action: this.position.action,
      args: this.position.args.map(a => serializeArg(a, forPlayer))
    };
  }

  setPositionFromJSON(position: any) {
    if (position) this.setPosition({
      player: position.player,
      action: position.action,
      args: position.args.map((a: any) => deserializeArg(a, this.ctx.game))
    }, false);
  }

  toString(): string {
    return `step${this.name ? ":" + this.name : ""} (${Object.keys(this.actions).join(", ")})`;
  }
}

//export default (name: string, actions: Record<string, FlowStep>) => new ActionStep(name, actions);
