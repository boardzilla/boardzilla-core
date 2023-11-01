import Flow from './flow';
import { serializeArg, deserializeArg } from '../action/utils';

import type { ActionStepPosition, FlowBranchNode, FlowDefinition, FlowStep } from './types';
import type { Player } from '../player';

export default class ActionStep<P extends Player> extends Flow<P> {
  player?: (args: Record<string, any>) => P
  position: ActionStepPosition<P>;
  actions: Record<string, FlowDefinition<P> | null>;
  type: FlowBranchNode<P>['type'] = "action";
  prompt?: string; // needed if multiple board actions
  skipIfOnlyOne: boolean;
  expand: boolean;

  constructor({ name, player, actions, prompt, expand, skipIfOnlyOne }: {
    name?: string,
    player?: (args: Record<string, any>) => P,
    actions: Record<string, FlowDefinition<P> | null>,
    prompt?: string,
    expand?: boolean,
    skipIfOnlyOne?: boolean,
  }) {
    super({ name });
    this.actions = actions;
    this.prompt = prompt;
    this.expand = expand ?? true;
    this.skipIfOnlyOne = skipIfOnlyOne ?? false;
    this.player = player;
  }

  reset() {
    if (this.player) this.game.players.setCurrent(this.player(this.flowStepArgs()));
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

  processMove(move: Required<ActionStepPosition<P>>): string | undefined {
    if (!(move.action in this.actions)) throw Error(`No action ${move.action} available at this point. Waiting for ${Object.keys(this.actions).join(", ")}`);
    const game = this.game;

    if (game.players.currentPosition && move.player !== game.players.currentPosition) {
      throw Error(`move ${move.action} from player #${move.player} not allowed. player #${game.players.currentPosition} turn`);
    }

    const player = game.players.atPosition(move.player)!;
    const gameAction = game.action(move.action, player);
    const error = gameAction._process(...move.args);
    if (error) {
      // failed with a selection required
      return error;
    } else {
      // succeeded
      this.setPosition(move);
      for (const message of gameAction._cfg.messages) {
        if (typeof message === 'function') {
          game.message(message(...move.args));
        } else {
          game.message(message, ...move.args, {player});
        }
      }
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

  allSteps() {
    return Object.values(this.actions).reduce<FlowStep<P>[]>((a, f) => a.concat(f), []);
  }

  toString(): string {
    return `step${this.name ? ":" + this.name : ""} (${Object.keys(this.actions).join(", ")})`;
  }
}
