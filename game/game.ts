import { action } from './action/index.js';
import { escapeArgument } from './action/utils.js';
import {
  Board,
  Space,
  Piece,
  GameElement
} from './board/index.js';
import { Action, Selection } from './action/index.js';
import { Player, PlayerCollection } from './player/index.js';
import Flow from './flow/flow.js';

import random from 'random-seed';

import type { ElementClass } from './board/types.d.ts';
import type { SetupComponentProps } from '../ui/types.d.ts';
import type { FlowDefinition } from './flow/types.d.ts';
import type {
  GameState,
  GameUpdate,
  PlayerPositionState,
  Message,
} from '../types.d.ts';
import type {
  Move,
  Argument,
  SerializedArg,
  PendingMove,
} from './action/types.d.ts';
import type { PlayerAttributes } from './player/types.d.ts';
import type React from 'react';

export default class Game<P extends Player, B extends Board<P>> {
  flow: Flow<P>;
  flowDefinition: (board: B) => FlowDefinition<P>;
  players: PlayerCollection<P> = new PlayerCollection<P>;
  board: B;
  setupComponents?: Record<string, (p: SetupComponentProps) => React.JSX.Element>
  settings: Record<string, any>;
  actions: (board: B, a: typeof action<P>, player: P) => Record<string, Action<P, Argument<P>[]>>;
  phase: 'define' | 'new' | 'started' | 'finished' = 'define';
  rseed: string;
  random: () => number;
  messages: Message[] = [];
  godMode = false;
  winner: P[] = [];

  /**
   * configuration functions
   */
  defineFlow(flowDefinition: typeof this.flowDefinition) {
    if (this.phase !== 'define') throw Error('cannot call defineFlow once started');
    this.flowDefinition = flowDefinition;
  }

  defineActions(actions: (board: B, a: typeof action<P>, player: P) => Record<string, Action<P, Argument<P>[]>>) {
    if (this.phase !== 'define') throw Error('cannot call defineActions once started');
    this.actions = actions;
  }

  defineBoard(
    className: ElementClass<P, B>,
    classRegistry: ElementClass<P, GameElement<P>>[]
  ): B {
    if (this.phase !== 'define') throw Error('cannot call defineBoard once started');
    this.board = new className({ game: this, classRegistry: [GameElement, Space, Piece, ...classRegistry]})
    return this.board;
  }

  definePlayers(
    className: {new(...a: any[]): P},
  ): PlayerCollection<P> {
    if (this.phase !== 'define') throw Error('cannot call definePlayer once started');
    this.players = new PlayerCollection<P>();
    this.players.game = this;
    this.players.className = className;
    return this.players as PlayerCollection<P>;
  }

  setSettings(settings: Record<string, any>) {
    this.settings = settings;
  }

  setRandomSeed(rseed: string) {
    this.rseed = rseed;
    this.random = random.create(rseed).random;
  }

  /**
   * flow functions
   */
  start() {
    if (this.phase === 'started') throw Error('cannot call start once started');
    if (!this.players.length) {
      throw Error("No players");
    }
    this.phase = 'started';
    this.buildFlow();
    this.flow.reset();
  }

  finish(winner?: P | P[]) {
    this.phase = 'finished';
    if (winner) this.winner = winner instanceof Array ? winner : [winner];
  }

  buildFlow() {
    const flow = this.flowDefinition(this.board);
    this.flow = new Flow({ do: flow });
    this.flow.game = this;
  }

  /**
   * state management functions
   */
  setState(state: GameState<P> & { currentPlayerPosition: number[] }) {
    this.players.fromJSON(state.players);
    this.setSettings(state.settings);
    this.board.fromJSON(state.board);
    this.buildFlow();
    this.flow.setBranchFromJSON(state.position);
    this.players.setCurrent(state.currentPlayerPosition);
    this.setRandomSeed(state.rseed);
  }

  // state variables for server updates. does not includes phase, current player or winners.
  getState(forPlayer?: number): GameState<P> & { currentPlayerPosition: number[] } {
    return {
      players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub
      settings: this.settings,
      position: this.flow.branchJSON(!!forPlayer),
      currentPlayerPosition: this.players.currentPosition,
      board: this.board.allJSON(forPlayer),
      rseed: this.rseed,
    };
  }

  getPlayerStates(): PlayerPositionState<P>[] {
    return this.players.map(p => ({
      position: p.position,
      state: this.getState(p.position)
    }));
  }

  getUpdate(): GameUpdate<P> {
    const { currentPlayerPosition, ...state } = this.getState();
    if (this.phase === 'started') {
      return {
        game: {
          ...state,
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
          ...state,
          winners: this.winner.map(p => p.position),
          phase: this.phase
        },
        players: this.getPlayerStates(),
        messages: this.messages,
      }
    }
    throw Error('unable to initialize game');
  }

  contextualizeBoardToPlayer(player?: P) {
    const prev = this.board._ctx.player;
    this.board._ctx.player = player;
    return prev;
  }

  inContextOfPlayer<T>(player: P, fn: () => T): T {
    const prev = this.contextualizeBoardToPlayer(player);
    const results = fn();
    this.contextualizeBoardToPlayer(prev);
    return results;
  }

  trackMovement(track=true) {
    this.board._ctx.trackMovement = track;
  }

  /**
   * action functions
   */
  action(name: string, player: P): Action<P, any> & {name: string} {
    if (this.godMode) {
      const godModeAction = this.godModeActions()[name];
      if (godModeAction) {
        godModeAction.name = name;
        return godModeAction as Action<P, any> & {name: string};
      }
    }
    return this.inContextOfPlayer(player, () => {
      const playerAction = this.actions(this.board, action, player)[name];
      if (!playerAction) throw Error(`No such action ${name}`);
      playerAction.name = name;
      return playerAction as Action<P, any> & {name: string};
    });
  }

  godModeActions(): Record<string, Action<P, any>> {
    if (this.phase !== 'started') throw Error('cannot call god mode actions until started');
    return {
      _godMove: action<P>({
        prompt: "Move",
      }).move({
        choosePiece: this.board.all(Piece<P>),
        chooseInto: this.board.all(GameElement<P>)
      }),
      _godEdit: action<P>({
        prompt: "Change",
      }).chooseOnBoard({
        choices: this.board.all(GameElement)
      }).chooseFrom({
        prompt: "Change property",
        choices: el => Object.keys(el).filter(a => !['_t', '_ctx', '_ui', '_eventHandlers', '_visible', 'mine', 'board', 'game', 'pile', 'mine'].includes(a))
      }).enterText({
        prompt: (_, prop) => `Change ${prop}`,
        initial: (el: GameElement<P>, attr: keyof GameElement<P>) => String(el[attr])
      }).do((el, attr: keyof GameElement<P>, value: any) => {
        if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (parseInt(value).toString() === value) {
          value = parseInt(value);
        }
        if (attr !== 'mine') el[attr] = value
      })
    };
  }

  play() {
    if (this.phase !== 'started') throw Error('cannot call play until started');
    this.flow.play();
  }

  // given a player's move (minimum a selected action), attempts to process
  // it. if not, returns next selection for that player, plus any implied partial
  // moves
  processMove({ player, action, args }: Move<P>): string | undefined {
    let error: string | undefined;
    this.messages = [];
    return this.inContextOfPlayer(player, () => {
      if (this.godMode && this.godModeActions()[action]) {
        const godModeAction = this.godModeActions()[action];
        error = godModeAction._process(...args);
      } else {
        error = this.flow.processMove({
          action,
          player: player.position,
          args
        });
      }
      if (error) return error;
      // successful move
    });
  }

  #allowedActions(player: P): {step?: string, prompt?: string, skipIfOnlyOne: boolean, expand: boolean, actions: string[]} {
    const allowedActions: string[] = this.godMode ? Object.keys(this.godModeActions()) : [];
    if (!player.isCurrent()) return {
      actions: allowedActions,
      skipIfOnlyOne: true,
      expand: true,
    };
    return this.inContextOfPlayer(player, () => {
      const actionStep = this.flow.actionNeeded(player);
      if (actionStep) {
        return {
          step: actionStep.step,
          prompt: actionStep.prompt,
          skipIfOnlyOne: actionStep.skipIfOnlyOne,
          expand: actionStep.expand,
          actions: allowedActions.concat(actionStep.actions?.filter(a => this.action(a, player).isPossible()) || [])
        }
      }
      return {
        skipIfOnlyOne: true,
        expand: true,
        actions: []
      };
    });
  }

  getResolvedSelections(player: P, action?: string, ...args: Argument<P>[]): {step?: string, prompt?: string, moves: PendingMove<P>[]} | undefined {
    const allowedActions = this.#allowedActions(player);
    if (!allowedActions.actions.length) return;
    const { step, prompt, actions, skipIfOnlyOne, expand } = allowedActions;
    if (!action) {
      let possibleActions: string[] = [];
      let resolvedSelections: PendingMove<P>[] = [];
      for (const action of actions) {
        const playerAction = this.action(action, player);
        let submoves = playerAction._getResolvedSelections();
        if (submoves !== undefined) {
          possibleActions.push(action);
          if (expand && submoves.length === 0) {
            submoves = [{
              action,
              args:  [],
              selection: new Selection<P>({ prompt: playerAction.prompt, value: action }).resolve()
            }];
          }
          resolvedSelections = resolvedSelections.concat(submoves);
        }
      }
      if (!possibleActions.length) return undefined;
      if (skipIfOnlyOne && possibleActions.length === 1) return { step, prompt, moves: resolvedSelections};
      if (expand && resolvedSelections.length) return { step, prompt, moves: resolvedSelections};
      return {
        step,
        prompt,
        moves: [{
          action: '/',
          args: [],
          selection: new Selection<P>({ prompt, selectFromChoices: { choices: actions }}).resolve()
        }]
      };

    } else {
      const moves = this.action(action, player)?._getResolvedSelections(...args)
      if (moves) return { step, prompt, moves };
    }
  }

  message(message: string, ...args: [...Argument<P>[], Record<string, Argument<P>>] | Argument<P>[]) {
    let replacements: Record<string, SerializedArg> = {};
    if (args.length) {
      const lastArg = args[args.length - 1]
      if (typeof lastArg === 'object' && !(lastArg instanceof Array) && !(lastArg instanceof Player) && !(lastArg instanceof GameElement)) {
        replacements = Object.fromEntries(Object.entries(lastArg).map(([k, v]) => (
          [k, escapeArgument(v)]
        )));;
        args = args.slice(0, -1) as Argument<P>[];
      }
    }
    for (let i = 0; i !== args.length; i++) {
      replacements[i + 1] = escapeArgument(args[i] as Argument<P>);
    }

    Object.entries(replacements).forEach(([k, v]) => {
      message = message.replace(new RegExp(`\\{\\{${k}\\}\\}`), v as string);
    })
    this.messages.push({body: message});
  }
}
