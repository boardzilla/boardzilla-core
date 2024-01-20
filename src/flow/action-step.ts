import Flow from './flow.js';
import { deserialize, deserializeObject, serialize, serializeObject } from '../action/utils.js';

import type { FlowBranchNode, FlowDefinition, FlowStep } from './flow.js';
import type { Player } from '../player/index.js';
import type { Argument, ActionStub } from '../action/action.js';

export type ActionStepPosition<P extends Player> = { // turn taken by `player`
  player: number,
  name: string,
  args: Record<string, Argument<P>>,
  followups?: ActionStub<P>[]
} | { // waiting for `players`
  players: number[]
};

export default class ActionStep<P extends Player> extends Flow<P> {
  players?: P | P[] | ((args: Record<string, any>) => P | P[]); // if restricted to a particular player list. otherwise uses current player
  position: ActionStepPosition<P>;
  actions: {
    name: string,
    prompt?: string | ((args: Record<string, any>) => string),
    args?: Record<string, Argument<P>>,
    do?: FlowDefinition<P>
  }[];
  type: FlowBranchNode<P>['type'] = "action";
  optional?: string | ((args: Record<string, any>) => string);
  prompt?: string | ((args: Record<string, any>) => string); // needed if multiple board actions
  skipIf: 'always' | 'never' | 'only-one';

  constructor({ name, player, players, actions, prompt, optional, skipIf }: {
    name?: string,
    players?: P[] | ((args: Record<string, any>) => P[]),
    player?: P | ((args: Record<string, any>) => P),
    actions: (string | {
      name: string,
      prompt?: string | ((args: Record<string, any>) => string),
      args?: Record<string, Argument<P>>,
      do?: FlowDefinition<P>
    })[],
    prompt?: string | ((args: Record<string, any>) => string),
    optional?: string | ((args: Record<string, any>) => string),
    skipIf?: 'always' | 'never' | 'only-one',
  }) {
    super({ name });
    this.actions = actions.map(a => typeof a === 'string' ? {name: a} : a);
    if (optional) this.actions.push({name: '__pass__', prompt: typeof optional === 'function' ? optional(this.flowStepArgs()) : optional});
    this.prompt = prompt;
    this.skipIf = skipIf ?? 'always';
    this.players = players ?? player;
  }

  reset() {
    const players = this.getPlayers();
    if (players) this.game.players.setCurrent(players);
    this.setPosition({players});
  }

  getPlayers() {
    if (this.players) {
      const players = typeof this.players === 'function' ? this.players(this.flowStepArgs()) : this.players;
      return (players instanceof Array ? players : [players]).map(p => p.position);
    }
  }

  awaitingAction() {
    return !('player' in this.position) || this.position.followups?.length;
  }

  currentBlock() {
    if (!('player' in this.position) || this.position.followups) return;
    const actionName = this.position.name;
    const step = this.actions.find(a => a.name === actionName)?.do;
    if (step) return step;
  }

  // current actions that can process. does not check player
  allowedActions(): string[] {
    return 'followups' in this.position && this.position.followups?.length ? [this.position.followups[0].name] : (
      'player' in this.position ? [] : this.actions.map(a => a.name)
    );
  }

  actionNeeded(player: Player): {
    step?: string,
    prompt?: string,
    actions: ActionStub<P>[],
    skipIf: 'always' | 'never' | 'only-one';
  } | undefined {
    if (!('player' in this.position)) {
      if (!player || !this.position.players || this.position.players.includes(player.position)) {
        return {
          prompt: typeof this.prompt === 'function' ? this.prompt(this.flowStepArgs()) : this.prompt,
          step: this.name,
          actions: this.actions.map(action => ({
            name: action.name,
            prompt: typeof action.prompt === 'function' ? action.prompt(this.flowStepArgs()) : action.prompt,
            args: action.args,
          })),
          skipIf: this.skipIf,
        }
      }
    } else if (this.position.followups?.length && (!player || this.position.followups[0].player === undefined || this.position.followups[0].player === player)) {
      return {
        step: this.name,
        actions: [this.position.followups[0]],
        skipIf: this.skipIf, // not sure what goes here
      }
    }
  }

  processMove(move: {
    player: number,
    name: string,
    args: Record<string, Argument<P>>,
  }): string | undefined {
    if (!this.allowedActions().includes(move.name)) throw Error(`No action ${move.name} available at this point. Waiting for ${this.allowedActions().join(", ")}`);
    const game = this.game;

    if (!game.players.currentPosition.includes(move.player)) {
      throw Error(`Move ${move.name} from player #${move.player} not allowed. Current players: #${game.players.currentPosition.join('; ')}`);
    }

    const player = game.players.atPosition(move.player);
    if (!player) return `No such player position: ${move.player}`;

    if (move.name === '__pass__') {
      this.setPosition(move);
      return;
    }

    const gameAction = game.getAction(move.name, player);
    game.followups.splice(0, game.followups.length);
    const error = gameAction._process(player, move.args);
    if (error) {
      // failed with a selection required
      return error;
    } else if (game.followups.length > 0) {
      // validate that this is a proper action list
      if (game.followups.some(f => !game.actions[f.name])) {
        throw Error(`Action ${move.name} followup is not a valid action`);
      }
      if ('followups' in this.position && this.position.followups?.length) {
        this.setPosition({ ...this.position, followups: this.position.followups.slice(1) });
      } else {
        this.setPosition({...move, followups: [...game.followups]});
      }
    } else {
      // succeeded
      this.setPosition(move);
    }
  }

  toJSON(forPlayer=true) {
    if ('player' in this.position) {
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
    return { players: this.getPlayers() };
  }

  fromJSON(position: any) {
    if (!position) return {players: undefined};
    return !('player' in position) ? position : {
      ...position,
      args: deserializeObject(position.args ?? {}, this.game) as Record<string, Argument<P>>,
      followups: position.followups?.map((f: any) => ({
        name: f.name,
        player: deserialize(f.player, this.game),
        args: deserializeObject(f.args ?? {}, this.game) as Record<string, Argument<P>>,
      }))
    };
  }

  allSteps() {
    return this.actions.map(a => a.do).reduce<FlowStep<P>[]>((a, f) => f ? a.concat(f) : a, []);
  }

  toString(): string {
    return `player-action${this.name ? ":" + this.name : ""} (player #${this.game.players.currentPosition}, ${this.allowedActions().join(", ")}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }
}
