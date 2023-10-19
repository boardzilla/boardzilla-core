import { action } from './action/';
import { escapeArgument } from './action/utils';
import {
  Board,
  Space,
  Piece,
  GameElement
} from './board/';
import {
  GameState,
  PlayerPositionState,
  Message
} from '../types';
import { Action, Selection } from './action';
import { ElementClass } from './board/types';
import { Player, PlayerCollection } from './player/';

import random from 'random-seed';

import type Flow from './flow/flow';
import type {
  Move,
  Argument,
  SerializedArg,
  PendingMove,
} from './action/types';
import type { PlayerAttributes } from './player/types';

export default class Game<P extends Player, B extends Board<P>> {
  flow: Flow<P>;
  flowDefinition: (game: typeof this, board: B) => Flow<P>;
  players: PlayerCollection<P> = new PlayerCollection<P>;
  board: B;
  settings: Record<string, any>;
  actions: (game: Game<P, B>, board: B) => Record<string, (p: P) => Action<P, Argument<P>[]>>;
  phase: 'define' | 'new' | 'started' | 'finished' = 'define';
  rseed: string;
  random: () => number;
  messages: Message[] = [];
  godMode = false;
  setupLayout?: (board: B, aspectRatio: number) => void;
  winner?: P | P[];

  /**
   * configuration functions
   */
  defineFlow(flowDefinition: typeof this.flowDefinition) {
    if (this.phase !== 'define') throw Error('cannot call defineFlow once started');
    this.flowDefinition = flowDefinition;
  }

  defineActions(actions: (game: Game<P, B>, board: B) => Record<string, (p: P) => Action<P, Argument<P>[]>>) {
    if (this.phase !== 'define') throw Error('cannot call defineActions once started');
    this.actions = actions;
  }

  defineBoard(
    className: {
      new(...classes: ElementClass<P, GameElement<P>>[]): B;
      isGameElement: boolean;
    },
    classRegistry: ElementClass<P, GameElement<P>>[]
  ): B {
    if (this.phase !== 'define') throw Error('cannot call defineBoard once started');
    this.board = new className(GameElement, Space, Piece, ...classRegistry)
    this.board.game = this;
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
    this.winner = winner;
  }

  buildFlow() {
    this.flow = this.flowDefinition(this, this.board);
    this.flow.game = this;
  }

  /**
   * state management functions
   */
  setState(state: GameState<P>) {
    this.players.fromJSON(state.players);
    this.players.currentPosition = state.currentPlayerPosition;
    this.setSettings(state.settings);
    this.board.fromJSON(state.board);
    this.buildFlow();
    this.phase = state.phase || 'started'; // TODO temp
    this.flow.setBranchFromJSON(state.position);
    this.setRandomSeed(state.rseed);
  }

  getState(forPlayer?: number): GameState<P> {
    return {
      players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub
      currentPlayerPosition: this.players.currentPosition,
      settings: this.settings,
      position: this.flow.branchJSON(!!forPlayer),
      board: this.board.allJSON(forPlayer),
      phase: this.phase,
      rseed: this.rseed,
    };
  }

  getPlayerStates(): PlayerPositionState<P>[] {
    return this.players.map(p => ({
      position: p.position,
      state: this.getState(p.position)
    }));
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

  /**
   * action functions
   */
  action(name: string, player: P): Action<P, any> & {name: string} {
    if (this.godMode) {
      const action = this.godModeActions()[name];
      if (action) {
        action.name = name;
        return action as Action<P, any> & {name: string};
      }
    }
    return this.inContextOfPlayer(player, () => {
      const action = this.actions(this, this.board)[name];
      if (!action) throw Error(`No such action ${name}`);
      const playerAction = action(player);
      playerAction.name = name;
      return playerAction as Action<P, any> & {name: string};
    });
  }

  godModeActions(): Record<string, Action<P, any>> {
    if (this.phase !== 'started') throw Error('cannot call god mode actions until started');
    return {
      _godMove: action<P>({
        prompt: "Move anything",
      }).move({
        prompt: "To anywhere",
        choosePiece: this.board.all(Piece<P>),
        chooseInto: this.board.all(GameElement<P>)
      }),
      _godEdit: action<P>({
        prompt: "Change anything",
      }).chooseOnBoard({
        prompt: "Select element",
        choices: this.board.all(GameElement)
      }).chooseFrom({
        prompt: "Change what?",
        choices: el => Object.keys(el).filter(a => !['_t', '_ctx', '_eventHandlers', 'mine', 'board', 'game', 'pile', 'mine'].includes(a))
      }).enterText({
        prompt: "Change to",
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
    return this.flow.play();
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
        error = godModeAction.process(...args);
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

  allowedActions(player: P): {step?: string, prompt?: string, skipIfOnlyOne: boolean, expand: boolean, actions: string[]} {
    const allowedActions: string[] = this.godMode ? Object.keys(this.godModeActions()) : [];
    if (this.players.currentPosition && player !== this.players.current()) return {
      actions: allowedActions,
      skipIfOnlyOne: true,
      expand: true,
    };
    return this.inContextOfPlayer(player, () => {
      const actionStep = this.flow.actionNeeded();
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
    const allowedActions = this.allowedActions(player);
    if (!allowedActions.actions.length) return;
    const { step, prompt, actions, skipIfOnlyOne, expand } = allowedActions;
    if (!action) {
      let possibleActions: string[] = [];
      let resolvedSelections: PendingMove<P>[] = [];
      for (const action of actions) {
        const playerAction = this.action(action, player);
        let submoves = playerAction.getResolvedSelections();
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
      const moves = this.action(action, player)?.getResolvedSelections(...args)
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
      message = message.replace(new RegExp(`\\$${k}\\b`), v as string);
    })
    this.messages.push({body: message});
  }
}
