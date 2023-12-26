import { action } from './action/index.js';
import { humanizeArg } from './action/utils.js';
import { n } from './utils.js';
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

import type { ElementClass } from './board/element.js';
import type { FlowDefinition } from './flow/flow.js';
import type { PlayerState, GameUpdate, GameState } from './interface.js';
import type { SerializedArg } from './action/utils.js';
import type { Argument, FollowUp } from './action/action.js';
import type { ResolvedSelection } from './action/selection.js';

// find all non-method non-internal attr's
export type PlayerAttributes<T extends Player> = {
  [
    K in keyof InstanceType<{new(...args: any[]): T}>
      as InstanceType<{new(...args: any[]): T}>[K] extends (...args: unknown[]) => unknown ? never : (K extends '_players' | 'board' | 'game' ? never : K)
  ]: InstanceType<{new(...args: any[]): T}>[K]
}

// a Move is a request from a particular Player to perform a certain Action with supplied args
export type Move<P extends Player> = {
  player: P,
  name: string,
  args: Record<string, Argument<P>>
};

export type PendingMove<P extends Player> = {
  name: string,
  prompt?: string,
  args: Record<string, Argument<P>>,
  selections: ResolvedSelection<P>[],
};

export type SerializedMove = {
  name: string,
  args: Record<string, SerializedArg>
}

export type Message = {
  position?: number
  body: string
}

export default class Game<P extends Player<P, B> = any, B extends Board<P, B> = any> {
  flow: Flow<P>;
  players: PlayerCollection<P> = new PlayerCollection<P>;
  board: B;
  settings: Record<string, any>;
  actions: Record<string, (player: P) => Action<P, Record<string, Argument<P>>>>;
  sequence: number = 0;
  phase: 'new' | 'started' | 'finished' = 'new';
  rseed: string;
  random: () => number;
  messages: Message[] = [];
  intermediateUpdates: GameState<P>[][] = [];
  godMode = false;
  winner: P[] = [];

  constructor(playerClass: {new(...a: any[]): P}, boardClass: ElementClass<B>, elementClasses: ElementClass[] = []) {
    this.board = new boardClass({ game: this, classRegistry: [GameElement, Space, Piece, ...elementClasses]})
    this.players = new PlayerCollection<P>();
    this.players.className = playerClass;
    this.players.game = this;
  }

  /**
   * configuration functions
   */
  defineFlow(flow: FlowDefinition<P>) {
    if (this.phase !== 'new') throw Error('cannot call defineFlow once started');
    this.flow = new Flow({ do: flow });
    this.flow.game = this;
  }

  defineActions(actions: Record<string, (player: P) => Action<P, Record<string, Argument<P>>>>) {
    if (this.phase !== 'new') throw Error('cannot call defineActions once started');
    this.actions = actions;
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
    this.flow.reset();
  }

  finish(winner?: P | P[]) {
    this.phase = 'finished';
    if (winner) this.winner = winner instanceof Array ? winner : [winner];
  }

  /**
   * state functions
   */
  getState(player?: P): GameState<P> {
    return {
      players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub for player
      settings: this.settings,
      position: this.flow.branchJSON(!!player),
      board: this.board.allJSON(player?.position),
      sequence: this.sequence,
      rseed: this.rseed,
    }
  }

  getPlayerStates(): PlayerState<P>[] {
    return this.players.map((p, i) => ({
      position: p.position,
      state: this.intermediateUpdates.length ?
        this.intermediateUpdates.map(state => state[i]).concat([this.getState(p)]) :
        this.getState(p)
    }));
  }

  getUpdate(): GameUpdate<P> {
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
    if (track) this.intermediateUpdates = [];
  }

  addDelay() {
    if (!this.board._ctx.trackMovement) return;
    this.sequence += 1;
    this.intermediateUpdates.push(this.players.map(p => this.getState(p)));
    this.board.resetMovementTracking();
  }

  /**
   * action functions
   */

  /**
   * Create an {@link Action}. An action is a single move that a player can
   * take. Some actions require choices, sometimes several, before they can be
   * executed. Some don't have any choices, like if a player can simply
   * 'pass'. What defines where one actions ends and another begins is how much
   * you as a player can decide before you "commit". For example, in chess you
   * select a piece to move and then a place to put it. These are a single move,
   * not separate. (Unless playing touch-move, which is rarely done in digital
   * chess.) In hearts, you pass 3 cards to another players. These are a single
   * move, not 3. You can change your mind as you select the cards, rather than
   * have to commit to each one. Similarly, other players do not see any
   * information about your choices until you actually commit the enture move.
   *
   * This function is called for each action in the game `actions` you define in
   * {@link createGame}. The actions is initially declared with only a name,
   * prompt and condition. Further information is added to the action by chaining
   * methods that add choices and behaviour. See (@link Action) for more.
   *
   * @param definition.prompt - The prompt that will appear for the player to
   * explain what the action does. Further prompts can be defined for each choice
   * they subsequently make to complete the action.
   *
   * @param definition.condition - A function returning a boolean that determines
   * whether the action is currently allowed. Note that the choices you define for
   * your action will further determine if the action is allowed. E.g. if you have
   * a play card action and you add a choice for cards in your hand, Boardzilla
   * will automatically disallow this action if there are no cards in your hand
   * based on the face that there are no valid choices to complete the action. YOu
   * do not need to specify a `condition` for these types of limitations.
   *
   * @example
   * action({
   *   prompt: 'Flip one of your cards'
   * }).chooseOnBoard({
   *   choices: board.find(Card, {mine: true})
   * }).do(
   *   card => card.hideFromAll()
   * )
   *
   * @category Actions
   */
  action<A extends Record<string, Argument<P>> = Record<string, never>>(definition: {
    prompt?: string,
    condition?: Action<P, A>['condition'],
  }) {
    return action<P, A>(definition);
  }

  /** @internal */
  getAction(name: string, player: P) {
    if (this.godMode) {
      const godModeAction = this.godModeActions()[name];
      if (godModeAction) {
        godModeAction.name = name;
        return godModeAction as Action<P, any> & {name: string};
      }
    }

    if (!this.actions[name]) throw Error(`No action found: "${name}". All actions must be specified in defineActions()`);

    return this.inContextOfPlayer(player, () => {
      const action = this.actions[name](player);
      action.game = this;
      action.name = name;
      return action as Action<P, any> & {name: string};
    });
  }

  /** @internal */
  godModeActions(): Record<string, Action<P, any>> {
    if (this.phase !== 'started') throw Error('cannot call god mode actions until started');
    return {
      _godMove: action<P>({
        prompt: "Move",
      }).move(
        'piece', this.board.all(Piece<P, B>),
        'into', this.board.all(GameElement<P, B>)
      ),
      _godEdit: action<P>({
        prompt: "Change",
      })
        .chooseOnBoard('element', this.board.all(GameElement<P, B>))
        .chooseFrom<'property', string>(
          'property',
          ({ element }) => Object.keys(element).filter(a => !['_t', '_ctx', '_ui', '_eventHandlers', '_visible', 'mine', 'owner', 'board', 'game', 'pile'].includes(a)),
          { prompt: "Change property" }
        ).enterText('value', {
          prompt: ({ property }) => `Change ${property}`,
          initial: ({ element, property }) => String(element[property as keyof GameElement<P>])
        }).do(({ element, property, value }) => {
          let v: any = value
          if (value === 'true') {
            v = true;
          } else if (value === 'false') {
            v = false;
          } else if (parseInt(value).toString() === value) {
            v = parseInt(value);
          }
          const prop = property as keyof GameElement<P>;
          if (prop !== 'mine' && prop !== 'owner') element[prop] = v
      })
    };
  }

  /** @internal */
  play() {
    if (this.phase === 'finished') return;
    if (this.phase !== 'started') throw Error('cannot call play until started');
    this.flow.play();
  }

  // given a player's move (minimum a selected action), attempts to process
  // it. if not, returns next selection for that player, plus any implied partial
  // moves
  /** @internal */
  processMove({ player, name, args }: Move<P>): string | undefined {
    if (this.phase === 'finished') return 'Game is finished';
    let errorOrFollowups: string | undefined | FollowUp<P>[];
    return this.inContextOfPlayer(player, () => {
      if (this.godMode && this.godModeActions()[name]) {
        const godModeAction = this.godModeActions()[name];
        errorOrFollowups = godModeAction._process(player, args);
      } else {
        errorOrFollowups = this.flow.processMove({
          name,
          player: player.position,
          args
        });
      }
      console.debug(`Move by player #${player.position} ${name}({${Object.entries(args).map(([k, v]) => k +': ' + humanizeArg(v)).join(', ')}}) ${typeof errorOrFollowups === 'string' ? '❌ ' + errorOrFollowups : ( errorOrFollowups ? errorOrFollowups.map(f => `⮕ ${f.name}({${Object.entries(f.args || {}).map(([k, v]) => k +': ' + humanizeArg(v)).join(', ')}})`) : '✅')}`);
      if (typeof errorOrFollowups === 'string') return errorOrFollowups;
      // successful move
    });
  }

  allowedActions(player: P): {step?: string, prompt?: string, skipIf: 'always' | 'never' | 'only-one', actions: {
    name: string,
    player?: P,
    args?: Record<string, Argument<P>>
  }[]} {
    const allowedActions: {
      name: string,
      player?: P,
      args?: Record<string, Argument<P>>
    }[] = this.godMode ? Object.keys(this.godModeActions()).map(name => ({ name })) : [];
    if (!player.isCurrent()) return {
      actions: allowedActions,
      skipIf: 'always',
    };
    const actionStep = this.flow.actionNeeded(player);

    if (actionStep) {
      const actions = allowedActions.concat(
        actionStep.actions?.filter(
          a => this.getAction(a.name, player).isPossible(a.args)
        ).map(a => ({ ...a, player })) || []
      )
      //if (actions.length === 0) check any other current players, if no action possible, warn and skip somehow
      return {
        step: actionStep.step,
        prompt: actionStep.prompt,
        skipIf: actionStep.skipIf,
        actions
      }
    }
    return {
      skipIf: 'always',
      actions: []
    };
  }

  getPendingMoves(player: P, name?: string, args?: Record<string, Argument<P>>): {step?: string, prompt?: string, moves: PendingMove<P>[]} | undefined {
    if (this.phase === 'finished') return;
    const allowedActions = this.allowedActions(player);
    if (!allowedActions.actions.length) return;
    const { step, prompt, actions, skipIf } = allowedActions;
    if (!name) {
      let possibleActions: string[] = [];
      let pendingMoves: PendingMove<P>[] = [];
      for (const action of actions) {
        const playerAction = this.getAction(action.name, player);
        const args = action.args || {}
        let submoves = playerAction._getPendingMoves(args);
        if (submoves !== undefined) {
          possibleActions.push(action.name);
          // no sub-selections to show so just create a prompt selection of this action
          if (skipIf === 'always' && submoves.length === 0) {
            submoves = [{
              name: action.name,
              prompt,
              args,
              selections: [
                new Selection<P>('__action__', { prompt: playerAction.prompt, value: action.name }).resolve({})
              ]
            }];
          }
          pendingMoves = pendingMoves.concat(submoves);
        } else {
          console.debug(`Action ${action.name} not allowed because no valid selections exist`);
        }
      }

      if (!possibleActions.length) return undefined;
      return { step, prompt, moves: pendingMoves};

    } else {
      const moves = this.getAction(name, player)?._getPendingMoves(args || {});
      if (moves) return { step, prompt, moves };
    }
  }

  message(message: string, args?: Record<string, Argument<P>>) {
    this.messages.push({body: n(message, args, true)});
  }
}
