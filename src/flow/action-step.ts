import Flow from './flow.js';
import { deserialize, deserializeObject, serialize, serializeObject } from '../action/utils.js';

import type { FlowBranchNode, FlowDefinition, FlowStep } from './flow.js';
import type { Player } from '../player/index.js';
import type { Argument, FollowUp } from '../action/action.js';

export type ActionStepPosition<P extends Player> = {
  player: number,
  name: string,
  args: Record<string, Argument<P>>,
  followups?: FollowUp<P>[]
} | null;

export default class ActionStep<P extends Player> extends Flow<P> {
  players?: P | P[] | ((args: Record<string, any>) => P | P[]); // if restricted to a particular player list. otherwise uses current player
  position: ActionStepPosition<P>;
  actions: {name: string, do?: FlowDefinition<P>}[];
  type: FlowBranchNode<P>['type'] = "action";
  prompt?: string; // needed if multiple board actions
  skipIfOnlyOne: boolean;
  expand: boolean;

  constructor({ name, player, players, actions, prompt, expand, skipIfOnlyOne }: {
    name?: string,
    players?: P[] | ((args: Record<string, any>) => P[]),
    player?: P | ((args: Record<string, any>) => P),
    actions: (string | {name: string, do?: FlowDefinition<P>})[],
    prompt?: string,
    expand?: boolean,
    skipIfOnlyOne?: boolean,
  }) {
    super({ name });
    this.actions = actions.map(a => typeof a === 'string' ? {name: a} : a);
    this.prompt = prompt;
    this.expand = expand ?? true;
    this.skipIfOnlyOne = skipIfOnlyOne ?? false;
    this.players = players ?? player;
  }

  reset() {
    const players = this.getPlayers();
    if (players) this.game.players.setCurrent(players);
    this.setPosition(null);
  }

  getPlayers() {
    if (this.players) {
      const players = typeof this.players === 'function' ? this.players(this.flowStepArgs()) : this.players;
      return players instanceof Array ? players : [players];
    }
  }

  awaitingAction() {
    return !this.position || this.position.followups?.length;
  }

  currentBlock() {
    if (!this.position || this.position.followups) return;
    const step = this.actions.find(a => a.name === this.position?.name)?.do;
    if (step) return step;
  }

  allowedActions(): string[] {
    return this.position?.followups?.length ? [this.position.followups[0].name] : this.position ? [] : this.actions.map(a => a.name);
  }

  actionNeeded(player: Player) {
    if (!this.position) {
      const players = this.getPlayers();
      if (!player || !players || players.includes(player as P)) {
        return {
          prompt: this.prompt,
          step: this.name,
          actions: this.actions.map(action => ({name: action.name})),
          skipIfOnlyOne: this.skipIfOnlyOne,
          expand: this.expand,
        }
      }
    } else if (this.position.followups?.length && (!player || this.position.followups[0].player === undefined || this.position.followups[0].player === player)) {
      return {
        step: this.name,
        actions: [this.position.followups[0]],
        skipIfOnlyOne: this.skipIfOnlyOne,
        expand: this.expand,
      }
    }
  }

  processMove(move: Exclude<ActionStepPosition<P>, null>): string | undefined {
    if (!this.allowedActions().includes(move.name)) throw Error(`No action ${move.name} available at this point. Waiting for ${this.allowedActions().join(", ")}`);
    const game = this.game;

    if (!game.players.currentPosition.includes(move.player)) {
      throw Error(`Move ${move.name} from player #${move.player} not allowed. Current players: #${game.players.currentPosition.join('; ')}`);
    }

    const player = game.players.atPosition(move.player);
    if (!player) return `No such player position: ${move.player}`;
    const gameAction = game.getAction(move.name, player);
    const errorOrFollowups = gameAction._process(player, move.args);
    if (typeof errorOrFollowups === 'string') {
      // failed with a selection required
      return errorOrFollowups;
    } else if (errorOrFollowups) {
      this.setPosition({...move, followups: errorOrFollowups});
    } else {
      // succeeded
      this.setPosition(move);
    }
  }

  toJSON(forPlayer=true) {
    if (this.position) {
      const json: any = {
        player: this.position.player,
        name: this.position.name,
        args: serializeObject(this.position.args, forPlayer),
      };
      if (this.position.followups?.length) {
        json.followups = this.position.followups.map(f => ({
          name: f.name,
          player: serialize(f.player),
          args: f.args ? serializeObject(f.args, forPlayer) : undefined,
        }));
      }
      return json;
    }
    return null;
  }

  fromJSON(position: any) {
    return position ? {
      ...position,
      args: deserializeObject(position.args ?? {}, this.game) as Record<string, Argument<P>>,
      followups: position.followups?.map((f: any) => ({
        name: f.name,
        player: deserialize(f.player, this.game),
        args: deserializeObject(f.args ?? {}, this.game) as Record<string, Argument<P>>,
      }))
    } : null;
  }

  allSteps() {
    return this.actions.map(a => a.do).reduce<FlowStep<P>[]>((a, f) => f ? a.concat(f) : a, []);
  }

  toString(): string {
    return `player-action${this.name ? ":" + this.name : ""} (player #${this.game.players.currentPosition}, ${this.allowedActions().join(", ")}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }
}
