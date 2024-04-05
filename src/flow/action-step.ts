import Flow from './flow.js';
import { deserialize, deserializeObject, serialize, serializeObject } from '../action/utils.js';

import type { FlowBranchNode, FlowDefinition, FlowStep } from './flow.js';
import type { Player } from '../player/index.js';
import type { Argument, ActionStub } from '../action/action.js';
import { FlowControl, InterruptControl, interruptSignal } from './enums.js';

export type ActionStepPosition = { // turn taken by `player`
  player: number,
  name: string,
  args: Record<string, Argument>,
  followups?: ActionStub[]
} | undefined // waiting;

export default class ActionStep extends Flow {
  players?: Player | Player[] | ((args: Record<string, any>) => Player | Player[]); // if restricted to a particular player list. otherwise uses current player
  position: ActionStepPosition;
  actions: {
    name: string,
    prompt?: string | ((args: Record<string, any>) => string),
    args?: Record<string, Argument> | ((args: Record<string, any>) => Record<string, Argument>),
    do?: FlowDefinition
  }[];
  type: FlowBranchNode['type'] = "action";
  prompt?: string | ((args: Record<string, any>) => string); // needed if multiple board actions
  condition?: (args: Record<string, any>) => boolean;
  continueIfImpossible?: boolean;
  repeatUntil?: boolean;
  description?: string;
  skipIf: 'always' | 'never' | 'only-one';

  constructor({ name, player, players, actions, prompt, description, optional, condition, continueIfImpossible, repeatUntil, skipIf }: {
    name?: string,
    players?: Player[] | ((args: Record<string, any>) => Player[]),
    player?: Player | ((args: Record<string, any>) => Player),
    actions: (string | {
      name: string,
      prompt?: string | ((args: Record<string, any>) => string),
      args?: Record<string, Argument> | ((args: Record<string, any>) => Record<string, Argument>),
      do?: FlowDefinition
    })[],
    prompt?: string | ((args: Record<string, any>) => string),
    condition?: (args: Record<string, any>) => boolean;
    continueIfImpossible?: boolean;
    repeatUntil?: string | ((args: Record<string, any>) => string);
    description?: string,
    optional?: string | ((args: Record<string, any>) => string),
    skipIf?: 'always' | 'never' | 'only-one',
  }) {
    super({ name });
    this.actions = actions.map(a => typeof a === 'string' ? {name: a} : a);
    this.prompt = prompt;
    if (repeatUntil) {
      this.repeatUntil = true;
      this.actions.push({name: '__pass__', prompt: typeof repeatUntil === 'function' ? repeatUntil(this.flowStepArgs()) : repeatUntil});
    } else if (optional) {
      this.actions.push({name: '__pass__', prompt: typeof optional === 'function' ? optional(this.flowStepArgs()) : optional});
    }
    this.description = description;
    this.condition = condition;
    this.continueIfImpossible = continueIfImpossible;
    this.skipIf = skipIf ?? 'always';
    this.players = players ?? player;
  }

  reset() {
    this.setPosition(undefined);
  }

  setPosition(position: ActionStepPosition) {
    super.setPosition(position);
    const players = this.getPlayers();
    if (players) this.gameManager.players.setCurrent(players);
  }

  getPlayers() {
    if (this.players) {
      const players = typeof this.players === 'function' ? this.players(this.flowStepArgs()) : this.players;
      return (players instanceof Array ? players : [players]).map(p => p.position);
    }
  }

  awaitingAction() {
    if (!this.position) {
      return !this.condition || this.condition(this.flowStepArgs());
    } else {
      return !!this.position.followups?.length;
    }
  }

  currentBlock() {
    if (this.position && !this.position.followups?.length) {
      const actionName = (this.position as { player: number, name: string, args: Record<string, Argument>, followups?: ActionStub[] }).name; // turn taken by `player`
      const step = this.actions.find(a => a.name === actionName)?.do;
      if (step) return step;
    }
  }

  // current actions that can process. does not check player
  allowedActions(): string[] {
    return this.position && this.position.followups?.length ? [this.position.followups[0].name] : (
      this.position ? [] : this.actions.map(a => a.name)
    );
  }

  actionNeeded(player?: Player): {
    step?: string,
    prompt?: string,
    description?: string,
    actions: ActionStub[],
    continueIfImpossible?: boolean,
    skipIf: 'always' | 'never' | 'only-one';
  } | undefined {
    if (!this.position) {
      if (!player || player.isCurrent()) {
        return {
          prompt: typeof this.prompt === 'function' ? this.prompt(this.flowStepArgs()) : this.prompt,
          description: this.description,
          step: this.name,
          actions: this.actions.map(action => ({
            name: action.name,
            prompt: typeof action.prompt === 'function' ? action.prompt(this.flowStepArgs()) : action.prompt,
            args: typeof action.args === 'function' ? action.args(this.flowStepArgs()) : action.args,
          })),
          continueIfImpossible: this.continueIfImpossible,
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

  // returns error (string) or subflow {args, name} or ok (undefined)
  processMove(move: {
    player: number,
    name: string,
    args: Record<string, Argument>,
  }): string | {name: string, args: Record<string, any>}[] | undefined {
    if ((move.name !== '__continue__' || !this.continueIfImpossible) && !this.allowedActions().includes(move.name)) {
      throw Error(`No action ${move.name} available at this point. Waiting for ${this.allowedActions().join(", ")}`);
    }
    const gameManager = this.gameManager;

    if (!gameManager.players.currentPosition.includes(move.player)) {
      throw Error(`Move ${move.name} from player #${move.player} not allowed. Current players: #${gameManager.players.currentPosition.join('; ')}`);
    }

    const player = gameManager.players.atPosition(move.player);
    if (!player) return `No such player position: ${move.player}`;

    if (move.name === '__pass__' || move.name === '__continue__') {
      this.setPosition(move);
      return;
    }

    const gameAction = gameManager.getAction(move.name, player);
    gameManager.followups.splice(0, gameManager.followups.length);
    const error = gameAction._process(player, move.args);
    if (error) {
      // failed with a selection required
      return error;
    } else if (interruptSignal[0]) {
      const interrupt = interruptSignal.splice(0);
      if (interrupt[0].signal === InterruptControl.subflow) return interrupt.map(s => s.data as {name: string, args: Record<string, any>});
      const loop = this.currentLoop(interrupt[0].data);
      if (!loop) {
        if (interrupt[0].data) throw Error(`No loop found "${interrupt[0].data}" for interrupt`);
        if (interrupt[0].signal === InterruptControl.continue) throw Error("Cannot use Do.continue when not in a loop");
        if (interrupt[0].signal === InterruptControl.repeat) throw Error("Cannot use Do.repeat when not in a loop");
        throw Error("Cannot use Do.break when not in a loop");
      } else {
        loop.interrupt(interrupt[0].signal);
        return;
      }
    } else if (gameManager.followups.length > 0) {
      // validate that this is a proper action list
      const badFollowup = gameManager.followups.find(f => !gameManager.actions[f.name]);
      if (badFollowup) throw Error(`Action "${move.name}" followUp "${badFollowup.name}" is not a valid action`);
    }

    // succeeded
    const followups = (this.position?.followups?.length ? this.position.followups.slice(1) : []).concat(gameManager.followups ?? []);
    const position: ActionStepPosition = this.position ? {...this.position, followups: undefined} : move;
    if (followups.length) {
      position.followups = followups;
      if (followups[0].player) {
        this.gameManager.players.setCurrent(followups[0].player);
      }
    } else if (this.position?.followups?.length) {
      // completed all followups - revert to current player
      this.gameManager.players.setCurrent(this.position.player);
    }
    this.setPosition(position);
  }

  playOneStep(): {data?: any, signal: InterruptControl}[] | FlowControl | Flow {
    return this.awaitingAction() ? this : super.playOneStep();
  }

  advance() {
    if (!this.repeatUntil || this.position?.name === '__pass__') return FlowControl.complete;
    this.reset();
    return FlowControl.ok;
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
          prompt: f.prompt,
          player: serialize(f.player),
          args: f.args ? serializeObject(f.args, forPlayer) : undefined,
        }));
      }
      return json;
    }
    return undefined;
  }

  fromJSON(position: any) {
    if (!position) return undefined;
    return !('player' in position) ? position : {
      ...position,
      args: deserializeObject(position.args ?? {}, this.gameManager.game) as Record<string, Argument>,
      followups: position.followups?.map((f: any) => ({
        name: f.name,
        prompt: f.prompt,
        player: deserialize(f.player, this.gameManager.game),
        args: deserializeObject(f.args ?? {}, this.gameManager.game) as Record<string, Argument>,
      }))
    };
  }

  allSteps() {
    return this.actions.map(a => a.do).reduce<FlowStep[]>((a, f) => f ? a.concat(f) : a, []);
  }

  toString(): string {
    return `player-action${this.name ? ":" + this.name : ""} (player #${this.gameManager.players.currentPosition}, ${this.allowedActions().join(", ")}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }

  visualize() {
    const args = this.position && '{' + Object.entries(this.position.args).map(([k, v]) => `${k}: ${v}`).join(', ') + '}'
    return this.visualizeBlocks({
      type: 'playerActions',
      name: this.position?.name ?? '',
      blocks: Object.fromEntries(
        this.actions.filter(a => a.name !== '__pass__').map(a => [a.name, a.do ? (a.do instanceof Array ? a.do : [a.do]) : undefined])
      ) as Record<string, FlowStep[]>,
      block: this.position?.name,
      position: args ?? this.gameManager.players.allCurrent().map(p => p.name).join(', ')
    });
  }
}
