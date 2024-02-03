import { n } from './utils.js';
import {
  Board,
  Space,
  Piece,
  Die,
  GameElement
} from './board/index.js';
import { Action, Selection } from './action/index.js';
import { Player, PlayerCollection } from './player/index.js';
import Flow from './flow/flow.js';
import {
  ActionStep,
  WhileLoop,
  ForEach,
  ForLoop,
  EachPlayer,
  EveryPlayer,
  IfElse,
  SwitchCase,
} from './flow/index.js';

import random from 'random-seed';

import type { ElementClass } from './board/element.js';
import type { FlowStep } from './flow/flow.js';
import type { PlayerState, GameUpdate, GameState } from './interface.js';
import type { Serializable, SerializedArg } from './action/utils.js';
import type { Argument, ActionStub } from './action/action.js';
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

/**
 * Core class for Boardzilla. Each game will create a single instance of this
 * class which will orchestrate the different parts of the game, the {@link
 * Board}, the {@link Player}'s, the {@link Action}'s and the {@link Flow}.
 * @category Core
 */
export default class Game<P extends Player<P, B> = any, B extends Board<P, B> = any> {
  flow: Flow<P>;
  /**
   * The players in this game. See {@link Player}
   */
  players: PlayerCollection<P> = new PlayerCollection<P>;
  /**
   * The board for this game. See {@link Board}
   */
  board: B;
  settings: Record<string, any>;
  actions: Record<string, (player: P) => Action<P, Record<string, Argument<P>>>>;
  sequence: number = 0;
  /**
   * Current game phase
   */
  phase: 'new' | 'started' | 'finished' = 'new';
  rseed: string;
  random: () => number;
  messages: Message[] = [];
  announcements: string[] = [];
  intermediateUpdates: GameState<P>[][] = [];
  /**
   * If true, allows any piece to be moved or modified in any way. Used only
   * during development.
   */
  godMode = false;
  winner: P[] = [];
  followups: ActionStub<P>[] = [];

  flowGuard = (): true => {
    if (this.phase !== 'new') {
      throw Error('Cannot call playerActions once game has started. It is likely that this function is in the wrong place and must be called directly in defineFlow as a FlowDefinition');
    }
    return true;
  };
  /**
   * The flow commands available for this game. See:
   * - {@link playerActions}
   * - {@link loop}
   * - {@link whileLoop}
   * - {@link forEach}
   * - {@link forLoop}
   * - {@link eachPlayer}
   * - {@link everyPlayer}
   * - {@link ifElse}
   * - {@link switchCase}
   */
  flowCommands = {
    playerActions: (options: ConstructorParameters<typeof ActionStep<P>>[0]) => this.flowGuard() && new ActionStep<P>(options),
    loop: (...block: FlowStep<P>[]) => this.flowGuard() && new WhileLoop<P>({do: block, while: () => true}),
    whileLoop: (options: ConstructorParameters<typeof WhileLoop<P>>[0]) => this.flowGuard() && new WhileLoop<P>(options),
    forEach: <T extends Serializable<P>>(options: ConstructorParameters<typeof ForEach<P, T>>[0]) => this.flowGuard() && new ForEach<P, T>(options),
    forLoop: <T = Serializable<P>>(options: ConstructorParameters<typeof ForLoop<P, T>>[0]) => this.flowGuard() && new ForLoop<P, T>(options),
    eachPlayer: (options: ConstructorParameters<typeof EachPlayer<P>>[0]) => this.flowGuard() && new EachPlayer<P>(options),
    everyPlayer: (options: ConstructorParameters<typeof EveryPlayer<P>>[0]) => this.flowGuard() && new EveryPlayer<P>(options),
    ifElse: (options: ConstructorParameters<typeof IfElse<P>>[0]) => this.flowGuard() && new IfElse<P>(options),
    switchCase: <T extends Serializable<P>>(options: ConstructorParameters<typeof SwitchCase<P, T>>[0]) => this.flowGuard() && new SwitchCase<P, T>(options),
  };

  constructor(playerClass: {new(...a: any[]): P}, boardClass: ElementClass<B>, elementClasses: ElementClass[] = []) {
    this.board = new boardClass({ game: this, classRegistry: [GameElement, Space, Piece, Die, ...elementClasses]})
    this.players = new PlayerCollection<P>();
    this.players.className = playerClass;
    this.players.game = this;
  }

  /**
   * configuration functions
   */

  /**
   * Define your game's flow. May contain any of the following:
   * - {@link playerActions}
   * - {@link loop}
   * - {@link whileLoop}
   * - {@link forEach}
   * - {@link forLoop}
   * - {@link eachPlayer}
   * - {@link everyPlayer}
   * - {@link ifElse}
   * - {@link switchCase}
   */
  defineFlow(...flow: FlowStep<P>[]) {
    if (this.phase !== 'new') throw Error('cannot call defineFlow once started');
    this.flow = new Flow({ do: flow });
    this.flow.game = this;
  }

  /**
   * Define your game's actions.
   * @param actions - An object consisting of actions where the key is the name
   * of the action and value is a function that accepts a player taking the
   * action and returns the result of calling {@link action} and chaining
   * choices, results and messages onto the result
   */
  defineActions(actions: Record<string, (player: P) => Action<P, Record<string, Argument<P>>>>) {
    if (this.phase !== 'new') throw Error('cannot call defineActions once started');
    this.actions = actions;
  }

  setSettings(settings: Record<string, any>) {
    this.settings = settings;
  }

  /**
   * Retrieve the selected setting value for a setting defined in {@link
   * render}.
   */
  setting(key: string) {
    return this.settings[key];
  }

  setRandomSeed(rseed: string) {
    this.rseed = rseed;
    this.random = random.create(rseed).random;
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
    this.flow.reset();
  }

  /**
   * End the game
   *
   * @param winner - a player or players that are the winners of the game. In a
   * solo game if no winner is provided, this is considered a loss.
   * @param announcement - an optional announcement from {@link render} to
   * replace the standard boardzilla announcement.
   */
  finish(winner?: P | P[], announcement?: string) {
    this.phase = 'finished';
    if (winner) this.winner = winner instanceof Array ? winner : [winner];
    this.announce(announcement ?? '__finish__');
  }

  /**
   * state functions
   * @internal
   */

  getState(player?: P): GameState<P> {
    return {
      players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub for player
      settings: this.settings,
      position: this.flow.branchJSON(!!player),
      board: this.board.allJSON(player?.position),
      sequence: this.sequence,
      messages: this.messages.filter(m => player && (!m.position || m.position === player?.position)),
      announcements: this.announcements,
      rseed: player ? '' : this.rseed,
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

  /**
   * Add a delay in the animation of the state change at this point for player
   * as they receive game updates.
   */
  addDelay() {
    if (this.board._ctx.trackMovement) {
      this.sequence += 1;
    } else if (this.intermediateUpdates.length) {
      return; // even if not tracking, record one intermediate to allow UI to extract proper state to animate towards
    }
    this.intermediateUpdates.push(this.players.map(
      p => this.getState(p) // TODO unnecessary for all players if in context of player
    ));
    this.board.resetMovementTracking();
  }

  /**
   * action functions
   */

  /**
   * Create an {@link Action}. An action is a single move that a player can
   * take. Some actions require choices, sometimes several, before they can be
   * executed. Some don't have any choices, like if a player can simply
   * 'pass'. What defines where one action ends and another begins is how much
   * you as a player can decide before you "commit". For example, in chess you
   * select a piece to move and then a place to put it. These are a single move,
   * not separate. (Unless playing touch-move, which is rarely done in digital
   * chess.) In hearts, you pass 3 cards to another players. These are a single
   * move, not 3. You can change your mind as you select the cards, rather than
   * have to commit to each one. Similarly, other players do not see any
   * information about your choices until you actually commit the entire move.
   *
   * This function is called for each action in the game `actions` you define in
   * {@link defineActions}. These actions are initially declared with an optional
   * prompt and condition. Further information is added to the action by chaining
   * methods that add choices and behaviour. See {@link Action}.
   *
   * If this action accepts prior arguments besides the ones chosen by the
   * player during the execution of this action (especially common for {@link
   * followUp} actions) then a generic can be added for these arguments to help
   * Typescript type these parameters, e.g.:
   * `player => action<{ cards: number}>(...)`
   *
   * @param definition.prompt - The prompt that will appear for the player to
   * explain what the action does. Further prompts can be defined for each choice
   * they subsequently make to complete the action.
   *
   * @param definition.condition - A boolean or a function returning a boolean
   * that determines whether the action is currently allowed. Note that the
   * choices you define for your action will further determine if the action is
   * allowed. E.g. if you have a play card action and you add a choice for cards
   * in your hand, Boardzilla will automatically disallow this action if there
   * are no cards in your hand based on the face that there are no valid choices
   * to complete the action. You do not need to specify a `condition` for these
   * types of limitations. If using the function form, the function will receive
   * an object with any arguments passed to this action, e.g. from {@link
   * followUp}.
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
  action<A extends Record<string, Argument<P>> = NonNullable<unknown>>(definition: {
    prompt?: string,
    description?: string,
    condition?: Action<P, A>['condition'],
  } = {}) {
    return new Action<P, A>(definition);
  }

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

  /**
   * Queue up a follow-up action while processing an action. If called during
   * the processing of a game action, the follow-up action given will be added
   * as a new action immediately following the current one, before the game's
   * flow can resume normally. This is common for card games where the play of a
   * certain card may require more actions be taken.
   *
   * @param {Object} action - The action added to the follow-up queue.
   *
   * @example
   * defineAction({
   *   ...
   *   playCard: player => action()
   *     .chooseOnBoard('card', cards)
   *     .do(
   *       ({ card }) => {
   *         if (card.damage) {
   *           // this card allows another action to do damage to another Card
   *           game.followUp({
   *             name: 'doDamage',
   *             args: { amount: card.damage }
   *           });
   *         }
   *       }
   *     )
   */
  followUp(action: ActionStub<P>) {
    this.followups.push(action);
  }

  godModeActions(): Record<string, Action<P, any>> {
    if (this.phase !== 'started') throw Error('cannot call god mode actions until started');
    return {
      _godMove: this.action({
        prompt: "Move",
      }).chooseOnBoard(
        'piece', this.board.all(Piece<P, B>),
      ).chooseOnBoard(
        'into', this.board.all(GameElement<P, B>)
      ).move(
        'piece', 'into'
      ),
      _godEdit: this.action({
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
          if (prop !== 'mine' && prop !== 'owner' && prop !== 'row' && prop !== 'column') element[prop] = v
      })
    };
  }

  play() {
    if (this.phase === 'finished') return;
    if (this.phase !== 'started') throw Error('cannot call play until started');
    this.flow.play();
  }

  // given a player's move (minimum a selected action), attempts to process
  // it. if not, returns next selection for that player, plus any implied partial
  // moves
  processMove({ player, name, args }: Move<P>): string | undefined {
    if (this.phase === 'finished') return 'Game is finished';
    let error: string | undefined;
    return this.inContextOfPlayer(player, () => {
      if (this.godMode && this.godModeActions()[name]) {
        const godModeAction = this.godModeActions()[name];
        error = godModeAction._process(player, args);
      } else {
        error = this.flow.processMove({
          name,
          player: player.position,
          args
        });
      }
      console.debug(`Received move from player #${player.position} ${name}({${Object.entries(args).map(([k, v]) => `${k}: ${v}`).join(', ')}}) ${error ? '❌ ' + error : ( this.followups ? this.followups.map(f => `⮕ ${f.name}({${Object.entries(f.args || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}})`) : '✅')}`);
      return error;
    });
  }

  allowedActions(player: P): {step?: string, prompt?: string, description?: string, skipIf: 'always' | 'never' | 'only-one', actions: ActionStub<P>[]} {
    const actions: ActionStub<P>[] = this.godMode ? Object.keys(this.godModeActions()).map(name => ({ name })) : [];
    if (!player.isCurrent()) return {
      actions,
      skipIf: 'always',
    };

    const actionStep = this.flow.actionNeeded(player);
    if (actionStep?.actions) {
      for (const allowedAction of actionStep.actions) {
        if (allowedAction.name === '__pass__') {
          actions.push(allowedAction);
        } else {
          const gameAction = this.getAction(allowedAction.name, player);
          if (gameAction.isPossible(allowedAction.args)) {
            // step action config take priority over action config
            actions.push({ ...gameAction, ...allowedAction, player });
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

  getPendingMoves(player: P, name?: string, args?: Record<string, Argument<P>>): {step?: string, prompt?: string, moves: PendingMove<P>[]} | undefined {
    if (this.phase === 'finished') return;
    const allowedActions = this.allowedActions(player);
    if (!allowedActions.actions.length) return;
    const { step, prompt, actions, skipIf } = allowedActions;

    if (!name) {
      let possibleActions: string[] = [];
      let pendingMoves: PendingMove<P>[] = [];
      for (const action of actions) {
        if (action.name === '__pass__') {
          possibleActions.push('__pass__');
          pendingMoves.push({
            name: '__pass__',
            args: {},
            selections: [
              new Selection<P>('__action__', { prompt: action.prompt, value: '__pass__' }).resolve({})
            ]
          });
        } else {
          const playerAction = this.getAction(action.name, player)
          const args = action.args || {}
          let submoves = playerAction._getPendingMoves(args);
          if (submoves !== undefined) {
            possibleActions.push(action.name);
            // no sub-selections to show so just create a prompt selection of this action
            if (submoves.length === 0) {
              submoves = [{
                name: action.name,
                prompt,
                args,
                selections: [
                  new Selection<P>('__action__', {
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

      if (!possibleActions.length) return undefined;
      return { step, prompt, moves: pendingMoves};

    } else {
      if (name === '__pass__') return { step, prompt, moves: [] };
      const moves = this.getAction(name, player)?._getPendingMoves(args || {});
      if (moves) return { step, prompt, moves };
    }
  }

  /**
   * Add a message that will be broadcast in the chat at the next game update,
   * based on the current state of the game.
   *
   * @param message - The message to send. This can contain interpolated strings
   * with double braces, i.e. {{player}} that are defined in args. Of course,
   * strings can be interpolated normally using template literals. However game
   * objects (e.g. players or pieces) passed in as args will be displayed
   * specially by Boardzilla.
   *
   * @param args - AN object of key-value pairs of strings for interpolation in
   * the message.
   *
   * @example
   * game.message(
   *   '{{player}} has a score of {{score}}',
   *   { player, score: player.score() }
   * );
   */
  message(message: string, args?: Record<string, Argument<P>>) {
    this.messages.push({body: n(message, args, true)});
  }

  announce(modal: string) {
    this.announcements.push(modal);
  }
}
