import Flow from './flow';
import { serializeArg, deserializeArg } from '../action/utils';

import type { ActionStepPosition, FlowBranchNode, FlowDefinition } from './types';
import type { Player } from '../player';
import type { ResolvedSelection } from '../action/types';

export default class PlayerAction<P extends Player> extends Flow<P> {
  position: ActionStepPosition<P>;
  actions: Record<string, FlowDefinition<P> | null>;
  type: FlowBranchNode<P>['type'] = "action";
  prompt?: string;

  constructor({ name, actions, prompt }: { name?: string, actions: Record<string, FlowDefinition<P> | null>, prompt?: string }) {
    super({ name });
    this.actions = actions;
    this.prompt = prompt;
  }

  reset() {
    this.position = {};
  }

  currentBlock() {
    if (!this.position.action) return;
    const step = this.actions[this.position.action];
    if (step) return step;
  }

  awaitingAction() {
    if (!this.position.action) {
      return Object.keys(this.actions);
    }
  }

  processMove(move: Required<ActionStepPosition<P>>) {
    if (!(move.action in this.actions)) throw Error(`No action ${move.action} available at this point. Waiting for ${Object.keys(this.actions).join(", ")}`);
    const game = this.game;

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
          game.message(message(...move.args));
        } else {
          game.message(message, ...move.args, {player});
        }
      }
      return [] as [ResolvedSelection<P>?]
    }
  }

  toJSON(forPlayer=true) {
    if (!this.position?.action) return {};
    return {
      player: this.position.player,
      action: this.position.action,
      args: this.position.args?.map(a => serializeArg(a, forPlayer))
    };
  }

  fromJSON(position: any) {
    return {
      player: position.player,
      action: position.action,
      args: position.args?.map((a: any) => deserializeArg(a, this.game))
    };
  }

  toString(): string {
    return `step${this.name ? ":" + this.name : ""} (${Object.keys(this.actions).join(", ")})`;
  }
}
