import Flow from './flow';
import { serializeArg, deserializeArg } from '../action/utils';

import type { ActionStepPosition } from './types.d';
import type { ResolvedSelection } from '../action/types';

export default class PlayerAction extends Flow {
  position: ActionStepPosition | undefined;
  actions: Record<string, Flow | null>;
  type = "action";
  prompt?: string;

  constructor({ name, actions, prompt }: { name?: string, actions: Record<string, Flow | null>, prompt?: string }) {
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
    const step = this.actions[this.position.action] as Flow;
    if (step) return step;
  }

  awaitingAction() {
    if (!this.position) {
      return Object.keys(this.actions);
    }
  }

  processMove(move: ActionStepPosition) {
    if (!(move.action in this.actions)) throw Error(`No action ${move.action} available at this point. Waiting for ${Object.keys(this.actions).join(", ")}`);
    if (this.ctx.game.players.currentPosition && move.player !== this.ctx.game.players.currentPosition) {
      throw Error(`move ${move.action} from player #${move.player} not allowed. player #${this.ctx.game.players.currentPosition} turn`);
    }

    const player = this.ctx.game.players.atPosition(move.player)!;
    const gameAction = this.ctx.game.action(move.action, player);
    const response = gameAction.process(...move.args);
    if (response[0]) {
      return response;
    } else {
      this.setPosition(move);
      return [] as [ResolvedSelection?]
    }
  }

  positionJSON() {
    if (this.position) return {
      player: this.position.player,
      action: this.position.action,
      args: this.position.args.map(serializeArg)
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
