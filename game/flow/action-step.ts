import Flow from './flow.js';
import { serializeArg, deserializeArg } from '../action/utils.js';

import type { ActionStepPosition, FlowBranchNode, FlowDefinition, FlowStep } from './types.d.ts';
import type { Player } from '../player/index.js';

export default class ActionStep<P extends Player> extends Flow<P> {
  players?: P | P[] | ((args: Record<string, any>) => P | P[]);
  position: ActionStepPosition<P>;
  actions: Record<string, FlowDefinition<P> | null>;
  type: FlowBranchNode<P>['type'] = "action";
  prompt?: string; // needed if multiple board actions
  skipIfOnlyOne: boolean;
  expand: boolean;

  constructor({ name, players, actions, prompt, expand, skipIfOnlyOne }: {
    name?: string,
    players?: P | P[] | ((args: Record<string, any>) => P | P[]),
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
    this.players = players;
  }

  reset() {
    if (this.players) {
      const currentPlayer = typeof this.players === 'function' ? this.players(this.flowStepArgs()) : this.players;
      this.game.players.setCurrent(currentPlayer);
    }
    this.setPosition(null);
  }

  currentBlock() {
    if (!this.position) return;
    const step = this.actions[this.position.action];
    if (step) return step;
  }

  actionNeeded(player?: P) {
    if (!this.position) return {
      prompt: this.prompt,
      step: this.name,
      actions: Object.keys(this.actions),
      skipIfOnlyOne: this.skipIfOnlyOne,
      expand: this.expand,
    }
  }

  processMove(move: Exclude<ActionStepPosition<P>, null>): string | undefined {
    if (!(move.action in this.actions)) throw Error(`No action ${move.action} available at this point. Waiting for ${Object.keys(this.actions).join(", ")}`);
    const game = this.game;

    if (!game.players.currentPosition.includes(move.player)) {
      throw Error(`Move ${move.action} from player #${move.player} not allowed. Current players: #${game.players.currentPosition.join('; ')}`);
    }

    const player = game.players.atPosition(move.player);
    if (!player) return `No such player position: ${move.player}`;
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
          game.message(message(...move.args), {player});
        } else {
          game.message(message, ...move.args, {player});
        }
      }
    }
  }

  toJSON(forPlayer=true) {
    return this.position ? {
      player: this.position.player,
      action: this.position.action,
      args: this.position.args?.map(a => serializeArg(a, forPlayer))
    } : null;
  }

  fromJSON(position: any) {
    return position ? {
      player: position.player,
      action: position.action,
      args: position.args?.map((a: any) => deserializeArg(a, this.game))
    } : null;
  }

  allSteps() {
    return Object.values(this.actions).reduce<FlowStep<P>[]>((a, f) => a.concat(f), []);
  }

  toString(): string {
    return `step${this.name ? ":" + this.name : ""} (${Object.keys(this.actions).join(", ")})`;
  }
}
