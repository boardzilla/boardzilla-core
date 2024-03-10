import Flow from './flow.js';
import { deserialize, deserializeObject, serialize, serializeObject } from '../action/utils.js';

import type { FlowBranchNode, FlowDefinition, FlowStep } from './flow.js';
import type { Player } from '../player/index.js';
import type { Argument, ActionStub } from '../action/action.js';
import { LoopInterruptControl, loopInterrupt } from './enums.js';

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
    args?: Record<string, Argument<P>> | ((args: Record<string, any>) => Record<string, Argument<P>>),
    do?: FlowDefinition<P>
  }[];
  type: FlowBranchNode<P>['type'] = "action";
  optional?: string | ((args: Record<string, any>) => string);
  prompt?: string | ((args: Record<string, any>) => string); // needed if multiple board actions
  description?: string;
  skipIf: 'always' | 'never' | 'only-one';

  constructor({ name, player, players, actions, prompt, description, optional, skipIf }: {
    name?: string,
    players?: P[] | ((args: Record<string, any>) => P[]),
    player?: P | ((args: Record<string, any>) => P),
    actions: (string | {
      name: string,
      prompt?: string | ((args: Record<string, any>) => string),
      args?: Record<string, Argument<P>> | ((args: Record<string, any>) => Record<string, Argument<P>>),
      do?: FlowDefinition<P>
    })[],
    prompt?: string | ((args: Record<string, any>) => string),
    description?: string,
    optional?: string | ((args: Record<string, any>) => string),
    skipIf?: 'always' | 'never' | 'only-one',
  }) {
    super({ name });
    this.actions = actions.map(a => typeof a === 'string' ? {name: a} : a);
    if (optional) this.actions.push({name: '__pass__', prompt: typeof optional === 'function' ? optional(this.flowStepArgs()) : optional});
    this.prompt = prompt;
    this.description = description;
    this.skipIf = skipIf ?? 'always';
    this.players = players ?? player;
  }

  reset() {
    const players = this.getPlayers();
    if (players) this.gameManager.players.setCurrent(players);
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
    description?: string,
    actions: ActionStub<P>[],
    skipIf: 'always' | 'never' | 'only-one';
  } | undefined {
    if (!('player' in this.position)) {
      if (!player || !this.position.players || this.position.players.includes(player.position)) {
        return {
          prompt: typeof this.prompt === 'function' ? this.prompt(this.flowStepArgs()) : this.prompt,
          description: this.description,
          step: this.name,
          actions: this.actions.map(action => ({
            name: action.name,
            prompt: typeof action.prompt === 'function' ? action.prompt(this.flowStepArgs()) : action.prompt,
            args: typeof action.args === 'function' ? action.args(this.flowStepArgs()) : action.args,
          })),
          skipIf: this.skipIf,
        }
      }
    } else if (this.position.followups?.length && (!player || this.position.followups[0].player === undefined || this.position.followups[0].player === player)) {
      return {
        step: this.name,
        description: this.position.followups[0].description,
        actions: [this.position.followups[0]],
        skipIf: this.skipIf // TODO separate this from `this`
      }
    }
  }

  processMove(move: {
    player: number,
    name: string,
    args: Record<string, Argument<P>>,
  }): string | undefined {
    if (!this.allowedActions().includes(move.name)) throw Error(`No action ${move.name} available at this point. Waiting for ${this.allowedActions().join(", ")}`);
    const gameManager = this.gameManager;

    if (!gameManager.players.currentPosition.includes(move.player)) {
      throw Error(`Move ${move.name} from player #${move.player} not allowed. Current players: #${gameManager.players.currentPosition.join('; ')}`);
    }

    const player = gameManager.players.atPosition(move.player);
    if (!player) return `No such player position: ${move.player}`;

    if (move.name === '__pass__') {
      this.setPosition(move);
      return;
    }

    const gameAction = gameManager.getAction(move.name, player);
    gameManager.followups.splice(0, gameManager.followups.length);
    const error = gameAction._process(player, move.args);
    if (error) {
      // failed with a selection required
      return error;
    } else if (loopInterrupt[0]) {
      const loop = this.currentLoop(loopInterrupt[0].loop);
      if (!loop) {
        if (loopInterrupt[0].loop) throw Error(`No loop found "${loopInterrupt[0].loop}" for interrupt`);
        if (loopInterrupt[0].signal === LoopInterruptControl.continue) throw Error("Cannot use Do.continue when not in a loop");
        if (loopInterrupt[0].signal === LoopInterruptControl.repeat) throw Error("Cannot use Do.repeat when not in a loop");
        if (loopInterrupt[0].signal === LoopInterruptControl.break) throw Error("Cannot use Do.break when not in a loop");
      } else {
        loop.interrupt(loopInterrupt.shift()!.signal);
        return;
      }
    } else if (gameManager.followups.length > 0) {
      // validate that this is a proper action list
      const badFollowup = gameManager.followups.find(f => !gameManager.actions[f.name]);
      if (badFollowup) throw Error(`Action "${move.name}" followUp "${badFollowup.name}" is not a valid action`);
    }

    // succeeded
    const followups = ('followups' in this.position && this.position.followups?.length ? this.position.followups.slice(1) : []).concat(gameManager.followups ?? []);
    const position: ActionStepPosition<P> = 'followups' in this.position ? {...this.position, followups: undefined} : move;
    if (followups.length) {
      position.followups = followups;
      if (followups[0].player) {
        this.gameManager.players.setCurrent(followups[0].player);
      }
    }
    this.setPosition(position);
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
          prompt: f.prompt,
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
      args: deserializeObject(position.args ?? {}, this.gameManager.game) as Record<string, Argument<P>>,
      followups: position.followups?.map((f: any) => ({
        name: f.name,
        prompt: f.prompt,
        player: deserialize(f.player, this.gameManager.game),
        args: deserializeObject(f.args ?? {}, this.gameManager.game) as Record<string, Argument<P>>,
      }))
    };
  }

  allSteps() {
    return this.actions.map(a => a.do).reduce<FlowStep<P>[]>((a, f) => f ? a.concat(f) : a, []);
  }

  toString(): string {
    return `player-action${this.name ? ":" + this.name : ""} (player #${this.gameManager.players.currentPosition}, ${this.allowedActions().join(", ")}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }

  visualize() {
    const args = this.position && ('args' in this.position) && '{' + Object.entries(this.position.args).map(([k, v]) => `${k}: ${v}`).join(', ') + '}'
    return this.visualizeBlocks({
      type: 'playerActions',
      name: this.position && 'name' in this.position ? this.position.name : '',
      blocks: Object.fromEntries(
        this.actions.filter(a => a.name !== '__pass__').map(a => [a.name, a.do ? (a.do instanceof Array ? a.do : [a.do]) : undefined])
      ) as Record<string, FlowStep<P>[]>,
      block: this.position && 'name' in this.position ? this.position.name : undefined,
      position: this.position && (
        ('player' in this.position ? args : undefined) ??
          ('players' in this.position && this.position.players ? this.position.players.map(p => this.gameManager.players.atPosition(p)).join(', ') : undefined)
      ),
    });
  }
}
