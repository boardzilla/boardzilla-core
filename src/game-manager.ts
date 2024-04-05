import {
  Space,
  Piece,
  GameElement
} from './board/index.js';
import { Action, Selection } from './action/index.js';
import { Player, PlayerCollection } from './player/index.js';
import Flow, { FlowBranchJSON } from './flow/flow.js';
import ActionStep from './flow/action-step.js';

import random from 'random-seed';

import type { BaseGame } from './board/game.js';
import type { BasePlayer } from './player/player.js';
import type { ElementClass } from './board/element.js';
import type { PlayerState, GameUpdate, GameState } from './interface.js';
import type { SerializedArg } from './action/utils.js';
import type { Argument, ActionStub } from './action/action.js';
import type { ResolvedSelection } from './action/selection.js';

// find all non-method non-internal attr's
export type PlayerAttributes<T extends Player = Player> = {
  [
    K in keyof InstanceType<{new(...args: any[]): T}>
      as InstanceType<{new(...args: any[]): T}>[K] extends (...args: unknown[]) => unknown ? never : (K extends '_players' | 'game' | 'gameManager' ? never : K)
  ]: InstanceType<{new(...args: any[]): T}>[K]
}

// a Move is a request from a particular Player to perform a certain Action with supplied args
export type Move = {
  player: Player,
  name: string,
  args: Record<string, Argument>
};

export type PendingMove = {
  name: string,
  prompt?: string,
  args: Record<string, Argument>,
  selections: ResolvedSelection[],
};

export type SerializedMove = {
  name: string,
  args: Record<string, SerializedArg>
}

export type Message = {
  position?: number
  body: string
}

export type ActionDebug = Record<string, {
  args: Record<string, 'sel' | 'skip' | 'only-one' | 'always' | 'tree' | 'forced' | 'imp' | 'ask' | 'future'>,
  // pruned?: Record<string, Argument[]>
  impossible?: boolean
}>

export type FlowStackJSON = {
  name?: string,
  args?: Record<string, any>,
  currentPosition: number[],
  stack: FlowBranchJSON[]
}

/**
 * Game manager is used to coordinate other classes, the {@link Game}, the
 * {@link Player}'s, the {@link Action}'s and the {@link Flow}.
 * @category Core
 */
export default class GameManager<G extends BaseGame = BaseGame, P extends BasePlayer = BasePlayer> {
  flows: Record<string, Flow> = {}; // list of defined flows, including at minimum __main__
  flowState: FlowStackJSON[] = []; // current state for all flows. only the active one is hydrated
  /**
   * The players in this game. See {@link Player}
   */
  players: PlayerCollection<P> = new PlayerCollection<P>;
  /**
   * The game. See {@link Game}
   */
  game: G;
  settings: Record<string, any>;
  actions: Record<string, (player: P) => Action<Record<string, Argument>>>;
  sequence: number = 0;
  /**
   * Current game phase
   */
  phase: 'new' | 'started' | 'finished' = 'new';
  rseed: string;
  random: () => number;
  messages: Message[] = [];
  announcements: string[] = [];
  intermediateUpdates: GameState[][] = [];
  /**
   * If true, allows any piece to be moved or modified in any way. Used only
   * during development.
   */
  godMode = false;
  winner: P[] = [];

  constructor(playerClass: {new(...a: any[]): P}, gameClass: ElementClass<G>, elementClasses: ElementClass[] = []) {
    this.players = new PlayerCollection<P>();
    this.players.className = playerClass;
    this.game = new gameClass({ gameManager: this, classRegistry: [GameElement, Space, Piece, ...elementClasses]})
    this.players.game = this.game;
  }

  /**
   * configuration functions
   */

  setSettings(settings: Record<string, any>) {
    this.settings = settings;
  }

  setRandomSeed(rseed: string) {
    this.rseed = rseed;
    this.random = random.create(rseed).random;
    if (this.game.random) this.game.random = this.random;
  }

  /**
   * flow functions
   * @internal
   */

  start() {
    if (this.phase === 'started') throw Error('cannot call start once started');
    if (!this.players.length) {
      throw Error("No players");
    }
    this.phase = 'started';
    this.players.currentPosition = [...this.players].map(p => p.position)
    this.flowState = [{stack: [], currentPosition: this.players.currentPosition}];
    this.flows['__main__'].reset();
  }

  play(): void {
    if (this.phase === 'finished') return;
    if (this.phase !== 'started') throw Error('cannot call play until started');

    const result = this.flow().play();
    if (result instanceof Flow) {
      if ('continueIfImpossible' in result && result.continueIfImpossible) {
        // check if move is impossible and advance here
        const possible = this.players.allCurrent().some(player => this.getPendingMoves(player) !== undefined);
        if (!possible) {
          console.debug(`Continuing past playerActions "${result.name}" with no possible moves`);
          this.flow().processMove({ player: this.players.currentPosition[0], name: '__continue__', args: {} });
          this.play();
        }
      }
      // now awaiting action
    } else if (result) {
      // proceed to new subflow
      for (const flow of result.reverse()) this.beginSubflow(flow);
      this.play();
    } else {
      // completed this flow, go up the stack
      if (this.flowState.length > 1) {
        this.flowState.shift();
        this.hydrateFlow(this.flowState[0]);
        this.play();
      } else {
        this.game.finish();
      }
    }
  }

  flow() {
    if (this.flowState[0].name === '__followup__' && !this.flows.__followup__) {
      const actions = this.flowState[0].args as ActionStub;
      const followup = new ActionStep({ name: '__followup__', player: actions.player, actions: [actions] });
      followup.gameManager = this;
      this.flows.__followup__ = followup;
    }
    return this.flows[this.flowState[0].name ?? '__main__'];
  }

  getFlowStep(name: string) {
    for (const flow of Object.values(this.flows)) {
      const step = flow.getStep(name);
      if (step) return step;
    }
  }

  beginSubflow(flow: {name: string, args: Record<string, any>}) {
    this.flowState[0].stack = this.flow().branchJSON();
    this.flowState[0].currentPosition = this.players.currentPosition;
    this.flowState.unshift({
      name: flow.name,
      args: flow.args,
      currentPosition: this.players.currentPosition,
      stack: []
    });
    if (flow.name === '__followup__') delete this.flows.__followup__;
    this.flow().reset();
  }

  setFlowFromJSON(json: FlowStackJSON[]) {
    this.flowState = json;
    this.hydrateFlow(json[0]);
  }

  hydrateFlow({ name, args, stack, currentPosition }: FlowStackJSON) {
    this.flows[name ?? '__main__'].setBranchFromJSON(stack);
    this.flows[name ?? '__main__'].args = args;
    if (name === '__followup__') delete this.flows.__followup__;
    this.players.currentPosition = currentPosition;
  }

  flowJSON(player: boolean = false) {
    return this.flowState.map(({ name }) => {
      const flow = this.flows[name ?? '__main__'];
      const json: FlowStackJSON = {
        stack: flow.branchJSON(!!player),
        currentPosition: this.players.currentPosition
      };
      if (name && name !== '__main__') json.name = name;
      if (flow.args) json.args = flow.args;
      return json;
    });
  }

  /**
   * state functions
   * @internal
   */

  getState(player?: P): GameState {
    return {
      players: this.players.map(p => p.toJSON() as PlayerAttributes), // TODO scrub for player
      settings: this.settings,
      position: this.flowJSON(!!player),
      board: this.game.allJSON(player?.position),
      sequence: this.sequence,
      messages: this.messages.filter(m => player && (!m.position || m.position === player?.position)),
      announcements: [...this.announcements],
      rseed: player ? '' : this.rseed,
    }
  }

  getPlayerStates(): PlayerState[] {
    return this.players.map((p, i) => ({
      position: p.position,
      state: this.intermediateUpdates.length ?
        this.intermediateUpdates.map(state => state[i]).concat([this.getState(p)]) :
        this.getState(p)
    }));
  }

  getUpdate(): GameUpdate {
    this.sequence += 1;
    if (this.phase === 'started') {
      return {
        game: {
          state: this.getState(),
          currentPlayers: this.players.currentPosition,
          phase: this.phase
        },
        players: this.getPlayerStates(),
        messages: this.messages,
      }
    }
    if (this.phase === 'finished') {
      return {
        game: {
          state: this.getState(),
          winners: this.winner.map(p => p.position),
          phase: this.phase
        },
        players: this.getPlayerStates(),
        messages: this.messages,
      }
    }
    throw Error('unable to initialize game');
  }

  contextualizeBoardToPlayer(player?: Player) {
    const prev = this.game._ctx.player;
    this.game._ctx.player = player;
    return prev;
  }

  inContextOfPlayer<T>(player: Player, fn: () => T): T {
    const prev = this.contextualizeBoardToPlayer(player);
    const results = fn();
    this.contextualizeBoardToPlayer(prev);
    return results;
  }

  trackMovement(track=true) {
    if (this.game._ctx.trackMovement !== track) {
      this.game._ctx.trackMovement = track;
      if (track) this.intermediateUpdates = [];
    }
  }

  /**
   * action functions
   */

  getAction(name: string, player: P) {
    if (this.godMode) {
      const godModeAction = this.godModeActions()[name];
      if (godModeAction) {
        godModeAction.name = name;
        return godModeAction as Action & {name: string};
      }
    }

    if (!this.actions[name]) {
      throw Error(`No action found: "${name}". All actions must be specified in defineActions()`);
    }

    return this.inContextOfPlayer(player, () => {
      const action = this.actions[name](player);
      action.gameManager = this;
      action.name = name;
      return action as Action & {name: string};
    });
  }

  godModeActions(): Record<string, Action> {
    if (this.phase !== 'started') throw Error('cannot call god mode actions until started');
    return {
      _godMove: this.game.action({
        prompt: "Move",
      }).chooseOnBoard(
        'piece', this.game.all(Piece),
      ).chooseOnBoard(
        'into', this.game.all(GameElement)
      ).move(
        'piece', 'into'
      ),
      _godEdit: this.game.action({
        prompt: "Change",
      })
        .chooseOnBoard('element', this.game.all(GameElement))
        .chooseFrom<'property', string>(
          'property',
          ({ element }) => Object.keys(element).filter(a => !GameElement.unserializableAttributes.concat(['_visible', 'mine', 'owner']).includes(a)),
          { prompt: "Change property" }
        ).enterText('value', {
          prompt: ({ property }) => `Change ${property}`,
          initial: ({ element, property }) => String(element[property as keyof GameElement])
        }).do(({ element, property, value }) => {
          let v: any = value
          if (value === 'true') {
            v = true;
          } else if (value === 'false') {
            v = false;
          } else if (parseInt(value).toString() === value) {
            v = parseInt(value);
          }
          // @ts-ignore
          element[property] = v;
      })
    };
  }

  // given a player's move (minimum a selected action), attempts to process
  // it. if not, returns next selection for that player, plus any implied partial
  // moves
  processMove({ player, name, args }: Move): string | undefined {
    if (this.phase === 'finished') return 'Game is finished';
    let result: string | {name: string, args: Record<string, any>}[] | undefined;
    return this.inContextOfPlayer(player, () => {
      if (this.godMode && this.godModeActions()[name]) {
        const godModeAction = this.godModeActions()[name];
        result = godModeAction._process(player, args);
      } else {
        result = this.flow().processMove({
          name,
          player: player.position,
          args
        });
        if (result instanceof Array) {
          for (const flow of result.reverse()) this.beginSubflow(flow);
        }
      }
      console.debug(`Received move from player #${player.position} ${name}({${Object.entries(args).map(([k, v]) => `${k}: ${v}`).join(', ')}}) ${result ? (typeof result === 'string' ? '❌ ' + result : `⮕ ${result[0].name}({${Object.entries(result[0].args || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}})`) : '✅'}`);
      return typeof result === 'string' ? result : undefined;
    });
  }

  allowedActions(player: P, debug?: ActionDebug): {
    step?: string,
    prompt?: string,
    description?: string,
    skipIf: 'always' | 'never' | 'only-one',
    continueIfImpossible?: boolean,
    actions: ActionStub[]
  } {
    const actions: ActionStub[] = this.godMode ? Object.keys(this.godModeActions()).map(name => ({ name })) : [];
    if (!player.isCurrent()) return {
      actions,
      skipIf: 'always',
    };

    const actionStep = this.flow().actionNeeded(player);
    if (actionStep?.actions) {
      for (const allowedAction of actionStep.actions) {
        if (allowedAction.name === '__pass__') {
          actions.push(allowedAction);
        } else {
          const gameAction = this.getAction(allowedAction.name, player);
          if (gameAction.isPossible(allowedAction.args ?? {})) {
            // step action config take priority over action config
            actions.push({ ...gameAction, ...allowedAction, player });
          } else if (debug) {
            debug[allowedAction.name] = { impossible: true, args: {} };
          }
        }
      }
      return {
        ...actionStep,
        actions
      }
    }

    // check any other current players, if no action possible, warn and skip somehow ???
    return {
      skipIf: 'always',
      actions: []
    };
  }

  getPendingMoves(player: P, name?: string, args?: Record<string, Argument>, debug?: ActionDebug): {step?: string, prompt?: string, moves: PendingMove[]} | undefined {
    if (this.phase === 'finished') return;
    const allowedActions = this.allowedActions(player, debug);
    let possibleActions: string[] = [];

    if (allowedActions.actions.length) {
      const { step, prompt, actions, skipIf } = allowedActions;

      if (!name) {
        let pendingMoves: PendingMove[] = [];
        for (const action of actions) {
          if (action.name === '__pass__') {
            possibleActions.push('__pass__');
            pendingMoves.push({
              name: '__pass__',
              args: {},
              selections: [
                new Selection('__action__', { prompt: action.prompt, value: '__pass__' }).resolve({})
              ]
            });
            if (debug) {
              debug['__pass__'] = { args: {} };
            }
          } else {
            const playerAction = this.getAction(action.name, player)
            const args = action.args || {}
            let submoves = playerAction._getPendingMoves(args, debug);
            if (submoves !== undefined) {
              possibleActions.push(action.name);
              // no sub-selections to show so just create a prompt selection of this action
              // if an explcit confirm is required, this would be where to add the logic for it, e.g. playerAction.explicit? => selection[0].confirm
              if (submoves.length === 0 || skipIf === 'never' || (skipIf === 'only-one' && actions.length > 1)) {
                submoves = [{
                  name: action.name,
                  prompt: action.prompt,
                  args,
                  selections: [
                    new Selection('__action__', {
                      prompt: action.prompt ?? playerAction.prompt,
                      value: action.name,
                      skipIf
                    }).resolve({})
                  ]
                }];
              }
              pendingMoves = pendingMoves.concat(submoves);
            } else {
              console.debug(`Action ${action.name} not allowed because no valid selections exist`);
            }
          }
        }

        if (possibleActions.length) return { step, prompt, moves: pendingMoves};

      } else { // action provided
        if (name === '__pass__') return { step, prompt, moves: [] };
        const moves = this.getAction(name, player)?._getPendingMoves(args || {}, debug);
        if (moves) return { step, prompt, moves };
      }
    }

    return undefined;
  }
}
