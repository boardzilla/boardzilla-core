import Selection from './selection.js';
import { GameElement, ElementCollection } from '../board/index.js';
import { n } from '../utils.js';

import type {
  ResolvedSelection,
  BoardQueryMulti,
} from './selection.js';
import { Piece } from '../board/index.js';
import type { Player } from '../player/index.js';
import type { default as GameManager, PendingMove } from '../game-manager.js';

/**
 * A single argument
 * @category Actions
 */
export type SingleArgument<P extends Player> = string | number | boolean | GameElement<P> | P;

/**
 * An argument that can be added to an {@link Action}. Each value is chosen by
 * player or in some cases passed from a previous action. Arguments can be:
 * - a number
 * - a string
 * - a boolean
 * - a {@link GameElement}
 * - a {@link Player}
 * - an array of one these in the case of a multi-choice selection
 * @category Actions
 */
export type Argument<P extends Player> = SingleArgument<P> | SingleArgument<P>[];

/**
 * A follow-up action
 * @category Actions
 */
export type ActionStub<P extends Player> = {
  /**
   * The name of the action, as defined in `{@link Game#defineactions}`.
   */
  name: string,
  /**
   * The player to take this action, if different than the current player
   */
  player?: P,
  /**
   * Action prompt. If specified, overrides the `action.prompt` in `{@link
   * Game#defineactions}`.
   */
  prompt?: string,
  /**
   * Description of taking the action from a 3rd person perspective,
   * e.g. "choosing a card". The string will be automatically prefixed with the
   * player name and appropriate verb ("is/are"). If specified, this will be
   * used to convey to non-acting players what actions are happening.
   */
  description?: string,
  /**
   * An object containing arguments to be passed to the follow-up action. This
   * is useful if there are multiple ways to trigger this follow-up that have
   * variations.
   */
  args?: Record<string, Argument<P>>
}

type Group<P extends Player> = Record<string,
  ['number', Parameters<Action<P, any>['chooseNumber']>[1]?] |
  ['select', Parameters<Action<P, any>['chooseFrom']>[1], Parameters<Action<P, any>['chooseFrom']>[2]?] |
  ['board', Parameters<Action<P, any>['chooseOnBoard']>[1], Parameters<Action<P, any>['chooseOnBoard']>[2]?] |
  ['text', Parameters<Action<P, any>['enterText']>[1]?]
>

type ExpandGroup<P extends Player, A extends Record<string, Argument<P>>, R extends Group<P>> = A & {[K in keyof R]:
  R[K][0] extends 'number' ? number :
  R[K][0] extends 'text' ? string :
  R[K][0] extends 'select' ? (R[K][1] extends Parameters<typeof Action.prototype.chooseFrom<any, infer E>>[1] ? E : never) :
  R[K][0] extends 'board' ? (R[K][1] extends (...args: any) => any ? ReturnType<R[K][1]> : R[K][1]) :
  never
}

/**
 * Actions represent discreet moves players can make. These contain the choices
 * needed to take this action and the results of the action. Create Actions
 * using the {@link Game#action} function. Actions are evaluated at the time the
 * player has the option to perform the action, so any expressions that involve
 * game state will reflect the state at the time the player is performing the
 * action.
 *
 * @privateRemarks
 * The Action object is responsible for:
 * - providing Selection objects to players to aid in supplying appropriate Arguments
 * - validating player Arguments and returning any Selections needed to complete
 * - accepting player Arguments and altering board state
 *
 * @category Actions
 */
export default class Action<P extends Player, A extends Record<string, Argument<P>> = NonNullable<unknown>> {
  name?: string;
  prompt?: string;
  description?: string;
  selections: Selection<P>[] = [];
  moves: ((args: Record<string, Argument<P>>) => any)[] = [];
  condition?: ((args: A) => boolean) | boolean;
  messages: {text: string, args?: Record<string, Argument<P>> | ((a: A) => Record<string, Argument<P>>)}[] = [];
  order: ('move' | 'message')[] = [];
  mutated = false;

  gameManager: GameManager;

  constructor({ prompt, description, condition }: {
    prompt?: string,
    description?: string,
    condition?: ((args: A) => boolean) | boolean,
  }) {
    this.prompt = prompt;
    this.description = description;
    this.condition = condition;
  }

  isPossible(args: A): boolean {
    return typeof this.condition === 'function' ? this.condition(args) : this.condition ?? true;
  }

  // given a set of args, return sub-selections possible trying each possible next arg
  // return undefined if these args are impossible
  // return 0-length if these args are submittable
  // return array of follow-up selections if incomplete
  // skipping/expanding is very complex and this method runs all the rules for what should/must be combined, either as additional selections or as forced args
  // skippable options will still appear in order to present the choices to the user to select that tree. This will be the final selection if no other selection turned skipping off
  _getPendingMoves(args: Record<string, Argument<P>>): PendingMove<P>[] | undefined {
    const moves = this._getPendingMovesInner(args);
    // resolve any combined selections now with only args up until first choice
    if (moves?.length) {
      for (const move of moves) {
        const combineWith = move.selections[0].clientContext?.combineWith; // guaranteed single selection
        let confirm: Selection<P>['confirm'] | undefined = move.selections[0].confirm;
        let validation: Selection<P>['validation'] | undefined = move.selections[0].validation;
        // look ahead for any selections that can/should be combined
        for (let i = this.selections.findIndex(s => s.name === move.selections[0].name) + 1; i !== this.selections.length; i++) {
          if (confirm) break; // do not skip an explicit confirm
          let selection: Selection<P> | ResolvedSelection<P> = this.selections[i];
          if (combineWith?.includes(selection.name)) selection = selection.resolve(move.args);
          if (!selection.isResolved()) break;
          const arg = selection.isForced();
          if (arg !== undefined) { // forced future args are added here to shorten the form and pre-prompt any confirmation
            move.args[selection.name] = arg;
          } else if (combineWith?.includes(selection.name)) { // future combined selections are added as well
            move.selections.push(selection);
          } else {
            break;
          }
          confirm = selection.confirm ?? confirm; // find latest confirm for the overall combination
          validation = selection.validation ?? validation;
        }
        if (confirm) move.selections[0].confirm = confirm; // and put it on top
        if (validation) move.selections[move.selections.length - 1].validation = validation; // on bottom
      }
    }
    return moves;
  }

  _getPendingMovesInner(args: Record<string, Argument<P>>): PendingMove<P>[] | undefined {
    let selection = this._nextSelection(args);
    if (!selection) return [];

    const move = {
      name: this.name!,
      prompt: this.prompt,
      description: this.description,
      args,
      selections: [selection]
    };

    if (!selection.isPossible()) return;
    if (!selection.isUnbounded()) {
      let possibleOptions: Argument<P>[] = [];
      let pruned = false;
      let pendingMoves: PendingMove<P>[] = [];
      let hasCompleteMove = false
      for (const option of selection.options()) {
        const allArgs = {...args, [selection.name]: option};
        if (selection.validation && !selection.isMulti()) {
          const error = this._withDecoratedArgs(allArgs as A, args => selection!.error(args))
          if (error) {
            pruned = true;
            selection.invalidOptions.push({ option, error })
            continue;
          }
        }
        const submoves = this._getPendingMovesInner(allArgs);
        if (submoves === undefined) {
          pruned = true;
        } else {
          possibleOptions.push(option);
          hasCompleteMove ||= submoves.length === 0;
          pendingMoves = pendingMoves.concat(submoves);
        }
      }
      if (!possibleOptions.length) return undefined;
      if (pruned && !selection.isMulti()) {
        selection.overrideOptions(possibleOptions as SingleArgument<P>[]);
      }

      // return the next selection(s) if skipIf, provided it exists for all possible choices
      // special case: do not skip "apparent" choices in group even if they are ultimately forced, in order to best present the limited options
      if (pendingMoves.length && (
        ((selection.skipIf === 'always' || selection.skipIf === true) && !hasCompleteMove) ||
          selection.skipIf === 'only-one' && possibleOptions.length === 1 && (!selection.clientContext?.combineWith || selection.options().length <= 1)
      )) {
        return pendingMoves;
      }
    }

    return [move];
  }

  /**
   * given a partial arg list, returns a selection object for continuation if one exists.
   * @internal
   */
  _nextSelection(args: Record<string, Argument<P>>): ResolvedSelection<P> | undefined {
    let nextSelection: ResolvedSelection<P> | undefined = undefined;
    for (const s of this.selections) {
      const selection = s.resolve(args);
      if (selection.skipIf === true) continue;
      if (!(s.name in args)) {
        nextSelection = selection;
        break;
      }
    }
    return nextSelection;
  }

  /**
   * process this action with supplied args. returns error if any
   * @internal
   */
  _process(player: P, args: Record<string, Argument<P>>): string | undefined {
    // truncate invalid args - is this needed?
    let error: string | undefined = undefined;
    if (!this.isPossible(args as A)) return `${this.name} action not possible`;
    for (const selection of this.selections) {
      if (args[selection.name] === undefined) {
        const arg = selection.resolve(args).isForced()
        if (arg) args[selection.name] = arg;
      }

      error = this._withDecoratedArgs(args as A, args => selection.error(args))
      if (error) {
        console.error(`Invalid choice for ${selection.name}. Got "${args[selection.name]}" ${error}`);
        break;
      }
    }
    if (error) return error;

    const pendingMoves = this._getPendingMoves(args);
    if (!pendingMoves) {
      console.error('attempted to process invalid args', this.name, args);
      return error || 'unknown error during action._process';
    }
    if (pendingMoves.length) {
      return error || 'incomplete action';
    }

    let moveIndex = 0;
    let messageIndex = 0;
    for (const seq of this.order) {
      if (seq === 'move') {
        this.moves[moveIndex++](args);
      } else {
        const message = this.messages[messageIndex++];
        const messageArgs = ((typeof message.args === 'function') ? message.args(args as A) : message.args);
        this.gameManager.game.message(message.text, {...args, player, ...messageArgs});
      }
    }
  }

  _addSelection(selection: Selection<P>) {
    if (this.selections.find(s => s.name === selection.name)) throw Error(`Duplicate name for action ${this.name}: ${selection.name}`);
    if (this.mutated) throw Error(`Choices may not be added to the ${this.name} action after a do/move. This may need to be split into separate actions.`);
    this.selections.push(selection);
    return selection;
  }

  // fn must be idempotent
  _withDecoratedArgs(args: A, fn: (args: A) => any) {
    if (args['__placement__']) {
      const placementSelection = this.selections.find(s => s.name === '__placement__');
      if (placementSelection && args[placementSelection.placePiece!]) {
        args = {...args};
        // temporarily set piece to place to access position properties
        const placePiece = (args[placementSelection.placePiece!] as Piece);
        const { row, column, rotation } = placePiece;
        const [newColumn, newRow, newRotation] = args['__placement__'] as [number, number, number?];
        placePiece.column = newColumn;
        placePiece.row = newRow;
        placePiece.rotation = newRotation;
        const result = fn(args);
        placePiece.column = column;
        placePiece.row = row;
        placePiece.rotation = rotation;
        return result;
      }
    }
    return fn(args);
  }

  _getError(selection: ResolvedSelection<P>, args: A) {
    return this._withDecoratedArgs(args, args => selection.error(args));
  }

  _getConfirmation(selection: ResolvedSelection<P>, args: A) {
    if (!selection.confirm) return;
    const argList = selection.confirm[1];
    return n(
      selection.confirm[0],
      {...args, ...(typeof argList === 'function' ? this._withDecoratedArgs(args, argList) : argList)}
    );
  }

  /**
   * Add behaviour to this action to alter game state. After adding the choices
   * to an action, calling `do` causes Boardzilla to use the player choices to
   * actually do something with those choices. Call this method after all the
   * methods for player choices so that the choices are properly available to
   * the `do` function.
   *
   * @param move - The action to perform. This function accepts one argument
   * with key-value pairs for each choice added to the action using the provided
   * names.
   *
   * @example
   * player => action({
   *   prompt: 'Take resources',
   * }).chooseFrom({
   *   'resource', ['lumber', 'steel'],
   *   { prompt: 'Select resource' }
   * }).chooseNumber(
   *   'amount', {
   *     prompt: 'Select amount',
   *     max: 3
   * }).do(({ resource, amount }) => {
   *   // the choices are automatically passed in with their proper type
   *   game.firstN(amount, Resource, {resource}).putInto(
   *     player.my('stockPile')
   *   );
   * })
   * @category Behaviour
   */
  do(move: (args: A) => any): Action<P, A> {
    this.mutated = true;
    this.moves.push(move);
    this.order.push('move');
    return this;
  }

  /**
   * Add a message to this action that will be broadcast in the chat. Call this
   * method after all the methods for player choices so that the choices are
   * properly available to the `message` function. However the message should be
   * called before or after any `do` behaviour depending on whether you want the
   * message to reflect the game state before or after the move is performs. The
   * action's `message` and `do` functions can be intermixed in this way to
   * generate messages at different points int the execution of a move.
   *
   * @param text - The text of the message to send. This can contain interpolated
   * strings with double braces just as when calling {@link Game#message}
   * directly. However when using this method, the player performing the action,
   * plus any choices made in the action are automatically made available.
   *
   * @param args - If additional strings are needed in the message besides
   * 'player' and the player choices, these can be specified here. This can also
   * be specified as a function that accepts the player choices and returns
   * key-value pairs of strings for interpolation.
   *
   * @example
   * action({
   *   prompt: 'Say something',
   * }).enterText({
   *   'message',
   * }).message(
   *   '{{player}} said {{message}}' // no args needed
   * ).message(
   *   "I said, {{player}} said {{loudMessage}}",
   *   ({ message }) => ({ loudMessage: message.toUpperCase() })
   * )
   * @category Behaviour
   */
  message(text: string, args?: Record<string, Argument<P>> | ((a: A) => Record<string, Argument<P>>)) {
    this.messages.push({text, args});
    this.order.push('message');
    return this;
  }

  /**
   * Add a choice to this action from a list of options. These choices will be
   * displayed as buttons in the UI.
   *
   * @param name - The name of this choice. This name will be used in all
   * functions that accept the player's choices
   *
   * @param choices - An array of choices. This may be an array of simple values
   * or an array of objects in the form: `{ label: string, choice: value }`
   * where value is the actual choice that will be passed to the rest of the
   * action, but label is the text presented to the player that they will be
   * prompted to click. Use the object style when you want player text to
   * contain additional logic or differ in some way from the choice, similiar to
   * `<option value="key">Some text</option>` in HTML. This can also be a
   * function that returns the choice array. This function will accept arguments
   * for each choice the player has made up to this point in the action.
   *
   * @param {Object} options
   * @param options.prompt - Prompt displayed to the user for this choice.
   * @param options.skipIf - One of 'always', 'never' or 'only-one' or a
   * function returning a boolean. (Default 'only-one').
   *
   * <ul>
   * <li>only-one: If there is only valid choice in the choices given, the game
   * will skip this choice, prompting the player for subsequent choices, if any,
   * or completing the action otherwise.
   * <li>always: Rather than present this choice directly, the player will be
   * prompted with choices from the *next choice* in the action for each
   * possible choice here, essentially expanding the choices ahead of time to
   * save the player a step. This option only has relevance if there are
   * subsequent choices in the action.
   * <li>never: Always present this choice, even if the choice is forced
   * <li>function: A function that accepts all player choices up to this point
   * and returns a boolean. If returning true, this choice will be skipped.
   * This form is useful in the rare situations where the choice at the time may
   * be meaningless, e.g. selecting from a set of identical tokens. In this case
   * the game will make the choice for the player using the first viable option.
   * </ul>
   *
   * @param options.validate - A function that takes an object of key-value
   * pairs for all player choices and returns a boolean. If false, the game will
   * not allow the player to submit this choice. If a string is returned, this
   * will display as the reason for disallowing these selections.
   *
   * @param options.confirm - A confirmation message that the player will always
   * see before commiting this choice. This can be useful to present additional
   * information about the consequences of this choice, or simply to force the
   * player to hit a button with a clear message. This can be a simple string,
   * or a 2-celled array in the same form as {@link message} with a string
   * message and a set of key-value pairs for string interpolation, optionally
   * being a function that takes an object of key-value pairs for all player
   * choices, and returns the interpolation object.
   *
   * @example
   * action({
   *   prompt: 'Choose color',
   * }).chooseFrom(
   *   'color', ['white', 'blue', 'red'],
   * ).do(
   *   ({ color }) => ... color will be equal to the player-selected color ...
   * )
   *
   * // a more complex example:
   * action({
   *   prompt: 'Take resources',
   * }).chooseFrom(
   *   'resource', ['lumber', 'steel', 'oil'],
   *   { prompt: 'Select resource' }
   * ).chooseFrom(
   *   // Use the functional style to include the resource choice in the text
   *   // Also use object style to have the value simply be "high" or "low"
   *   'grade', resource => ({
   *     high: `High grade ${resource}`,
   *     low: `Low grade ${resource}`
   *   }),
   *   {
   *     // A follow-up choice that doesn't apply to "oil"
   *     skipIf: ({ resource }) => resource === 'oil',
   *     // Add an 'are you sure?' message
   *     confirm: ['Buy {{grade}} grade {{resource}}?', ({ grade }) = ({ grade: grade.toUpperCase() })]
   *   }
   * ).do (
   *   ({ resource, grade }) => {
   *     // resource will equal 'lumber', 'steel' or 'oil'
   *     // grade will equal 'high' or 'low'
   *   }
   * )
   * @category Choices
   */
  chooseFrom<N extends string, T extends SingleArgument<P>>(
    name: N,
    choices: (T & (string | number | boolean))[] | { label: string, choice: T }[] | ((args: A) => (T & (string | number | boolean))[] | { label: string, choice: T }[]),
    options?: {
      prompt?: string | ((args: A) => string)
      confirm?: string | [string, Record<string, Argument<P>> | ((args: A & {[key in N]: T}) => Record<string, Argument<P>>) | undefined]
      validate?: ((args: A & {[key in N]: T}) => string | boolean | undefined)
      // initial?: T | ((...arg: A) => T), // needed for select-boxes?
      skipIf?: 'never' | 'always' | 'only-one' | ((args: A) => boolean);
    }
  ): Action<P, A & {[key in N]: T}> {
    this._addSelection(new Selection<P>(name, {
      prompt: options?.prompt,
      validation: options?.validate,
      confirm: options?.confirm,
      skipIf: options?.skipIf,
      selectFromChoices: { choices }
    }));
    return this as unknown as Action<P, A & {[key in N]: T}>;
  }

  /**
   * Prompt the user for text entry. Use this in games where players submit
   * text, like word-guessing games.
   *
   * @param name - The name of this text input. This name will be used in all
   * functions that accept the player's choices
   *
   * @param {Object} options
   * @param options.initial - Default text that can appear initially before a
   * user types.
   * @param options.prompt - Prompt displayed to the user for entering this
   * text.
   *
   * @param options.validate - A function that takes an object of key-value
   * pairs for all player choices and returns a boolean. If false, the game will
   * not allow the player to submit this text. If a string is returned, this
   * will display as the reason for disallowing this text.
   *
   * @example
   * action({
   *   prompt: 'Guess a word',
   * }).enterText({
   *   'guess',
   *   { prompt: 'Your guess', }
   * }).message(
   *   guess => `{{player}} guessed ${guess}`
   * })
   * @category Choices
   */
  enterText<N extends string>(name: N, options?: {
    prompt?: string | ((args: A) => string),
    validate?: ((args: A & {[key in N]: string}) => string | boolean | undefined),
    regexp?: RegExp,
    initial?: string | ((args: A) => string)
  }): Action<P, A & {[key in N]: string}> {
    const { prompt, validate, regexp, initial } = options || {}
    this._addSelection(new Selection<P>(name, { prompt, validation: validate, enterText: { regexp, initial }}));
    return this as unknown as Action<P, A & {[key in N]: string}>;
  }

  /**
   * Add a numerical choice for this action. This will be presented with a
   * number picker.
   *
   * @param name - The name of this choice. This name will be used in all
   * functions that accept the player's choices
   *
   * @param {Object} options
   *
   * @param options.prompt - Prompt displayed to the user for entering this
   * number.
   *
   * @param options.min - Minimum allowed. Default 1.
   *
   * @param options.max - Maximum allowed. Default Infinity
   *
   * @param options.initial - Initial value to display in the picker
   *
   * @param options.skipIf - One of 'always', 'never' or 'only-one' or a
   * function returning a boolean. (Default 'only-one').
   *
   * <ul>
   * <li>only-one: If there is only valid choice in the choices given, the game
   * will skip this choice, prompting the player for subsequent choices, if any,
   * or completing the action otherwise.
   * <li>always: Rather than present this choice directly, the player will be
   * prompted with choices from the *next choice* in the action for each
   * possible choice here, essentially expanding the choices ahead of time to
   * save the player a step. This option only has relevance if there are
   * subsequent choices in the action.
   * <li>never: Always present this choice, even if the choice is forced
   * <li>function: A function that accepts all player choices up to this point
   * and returns a boolean. If returning true, this choice will be skipped.
   * This form is useful in the rare situations where the choice at the time may
   * be meaningless, e.g. selecting from a set of identical tokens. In this case
   * the game will make the choice for the player using the first viable option.
   * </ul>
   *
   * @param options.validate - A function that takes an object of key-value
   * pairs for all player choices and returns a boolean. If false, the game will
   * not allow the player to submit this choice. If a string is returned, this
   * will display as the reason for disallowing these selections.
   *
   * @param options.confirm - A confirmation message that the player will always
   * see before commiting this choice. This can be useful to present additional
   * information about the consequences of this choice, or simply to force the
   * player to hit a button with a clear message. This can be a simple string,
   * or a 2-celled array in the same form as {@link message} with a string
   * message and a set of key-value pairs for string interpolation, optionally
   * being a function that takes an object of key-value pairs for all player
   * choices, and returns the interpolation object.
   *
   * @example
   * player => action({
   *   prompt: 'Buy resources',
   * }).chooseNumber(
   *   'amount', {
   *     min: 5,
   *     max: 10 // select from 5 - 10
   * }).do(
   *   ({ amount }) => player.resource += amount
   * );
   * @category Choices
   */
  chooseNumber<N extends string>(name: N, options: {
    min?: number | ((args: A) => number),
    max?: number | ((args: A) => number),
    prompt?: string | ((args: A) => string),
    confirm?: string | [string, Record<string, Argument<P>> | ((args: A & {[key in N]: number}) => Record<string, Argument<P>>) | undefined]
    validate?: ((args: A & {[key in N]: number}) => string | boolean | undefined),
    initial?: number | ((args: A) => number),
    skipIf?: 'never' | 'always' | 'only-one' | ((args: A) => boolean);
  } = {}): Action<P, A & {[key in N]: number}> {
    const { min, max, prompt, confirm, validate, initial, skipIf } = options;
    this._addSelection(new Selection<P>(name, { prompt, confirm, validation: validate, skipIf, selectNumber: { min, max, initial } }));
    return this as unknown as Action<P, A & {[key in N]: number}>;
  }

  /**
   * Add a choice of game elements to this action. Users will click on the
   * playing area to make their choice.
   *
   * @param {Object} options

   * @param name - The name of this choice. This name will be used in all
   * functions that accept the player's choices

   * @param choices - Elements that may be chosen. This can either be an array
   * of elements or a function returning an array, if the choices depend on
   * previous choices. If using a function, it will accept arguments for each
   * choice the player has made up to this point in the action.
   *
   * @param options.prompt - Prompt displayed to the user for this choice.
   *
   * @param options.number - If supplied, the choice is for a *set* of exactly
   * `number` elements. For example, if the player is being asked to pass 3
   * cards from their hand, the `choices` should be to the cards in their hand
   * and the `number` to 3.
   *
   * @param options.min - If supplied, the choice is for a *set* of
   * elements and the minimum required is `min`.
   *
   * @param options.max - If supplied, the choice is for a *set* of
   * elements and the maximum allowed is `max`.
   *
   * @param options.initial - Optional list of game elements to be preselected
   *
   * @param options.skipIf - One of 'always', 'never' or 'only-one' or a
   * function returning a boolean. (Default 'only-one').
   *
   * <ul>
   * <li>only-one: If there is only valid choice in the choices given, the game
   * will skip this choice, prompting the player for subsequent choices, if any,
   * or completing the action otherwise.
   * <li>always: Rather than present this choice directly, the player will be
   * prompted with choices from the *next choice* in the action for each
   * possible choice here, essentially expanding the choices ahead of time to
   * save the player a step. This option only has relevance if there are
   * subsequent choices in the action.
   * <li>never: Always present this choice, even if the choice is forced
   * <li>function: A function that accepts all player choices up to this point
   * and returns a boolean. If returning true, this choice will be skipped.
   * This form is useful in the rare situations where the choice at the time may
   * be meaningless, e.g. selecting from a set of identical tokens. In this case
   * the game will make the choice for the player using the first viable option.
   * </ul>
   *
   * @param options.validate - A function that takes an object of key-value
   * pairs for all player choices and returns a boolean. If false, the game will
   * not allow the player to submit this choice. If a string is returned, this
   * will display as the reason for disallowing these selections.
   *
   * @param options.confirm - A confirmation message that the player will always
   * see before commiting this choice. This can be useful to present additional
   * information about the consequences of this choice, or simply to force the
   * player to hit a button with a clear message. This can be a simple string,
   * or a 2-celled array in the same form as {@link message} with a string
   * message and a set of key-value pairs for string interpolation, optionally
   * being a function that takes an object of key-value pairs for all player
   * choices up to this point, including this one, and returns the interpolation
   * object.
   *
   * @example
   * player => action({
   *   prompt: 'Mulligan',
   * }).chooseOnBoard(
   *   'cards', player.allMy(Card), {
   *     prompt: 'Mulligan 1-3 cards',
   *     // select 1-3 cards from hand
   *     min: 1,
   *     max: 3
   * ).do(
   *   ({ cards }) => {
   *     // `cards` is an ElementCollection of the cards selected
   *     cards.putInto($.discard);
   *     $.deck.firstN(cards.length, Card).putInto(player.my('hand')!);
   *   }
   * )
   * @category Choices
   */
  chooseOnBoard<T extends GameElement<P>, N extends string>(name: N, choices: BoardQueryMulti<P, T, A>, options?: {
    prompt?: string | ((args: A) => string);
    confirm?: string | [string, Record<string, Argument<P>> | ((args: A & {[key in N]: T}) => Record<string, Argument<P>>) | undefined]
    validate?: ((args: A & {[key in N]: T}) => string | boolean | undefined);
    initial?: never;
    min?: never;
    max?: never;
    number?: never;
    skipIf?: 'never' | 'always' | 'only-one' | ((args: A) => boolean);
  }): Action<P, A & {[key in N]: T}>;
  chooseOnBoard<T extends GameElement<P>, N extends string>(name: N, choices: BoardQueryMulti<P, T, A>, options?: {
    prompt?: string | ((args: A) => string);
    confirm?: string | [string, Record<string, Argument<P>> | ((args: A & {[key in N]: T[]}) => Record<string, Argument<P>>) | undefined]
    validate?: ((args: A & {[key in N]: T[]}) => string | boolean | undefined);
    initial?: T[] | ((args: A) => T[]);
    min?: number | ((args: A) => number);
    max?: number | ((args: A) => number);
    number?: number | ((args: A) => number);
    skipIf?: 'never' | 'always' | 'only-one' | ((args: A) => boolean);
  }): Action<P, A & {[key in N]: T[]}>;
  chooseOnBoard<T extends GameElement<P>, N extends string>(name: N, choices: BoardQueryMulti<P, T, A>, options?: {
    prompt?: string | ((args: A) => string);
    confirm?: string | [string, Record<string, Argument<P>> | ((args: A & {[key in N]: T | T[]}) => Record<string, Argument<P>>) | undefined]
    validate?: ((args: A & {[key in N]: T | T[]}) => string | boolean | undefined);
    initial?: T[] | ((args: A) => T[]);
    min?: number | ((args: A) => number);
    max?: number | ((args: A) => number);
    number?: number | ((args: A) => number);
    skipIf?: 'never' | 'always' | 'only-one' | ((args: A) => boolean);
  }): Action<P, A & {[key in N]: T | T[]}> {
    const { prompt, confirm, validate, initial, min, max, number, skipIf } = options || {};
    this._addSelection(new Selection<P>(
      name, { prompt, confirm, validation: validate, skipIf, selectOnBoard: { chooseFrom: choices, min, max, number, initial } }
    ));
    if (min !== undefined || max !== undefined || number !== undefined) {
      return this as unknown as Action<P, A & {[key in N]: T[]}>;
    }
    return this as unknown as Action<P, A & {[key in N]: T}>;
  }

  choose<N extends string, S extends 'number'>(
    name: N,
    type: S,
    options?: Parameters<this['chooseNumber']>[1]
  ): Action<P, A & {[key in N]: number}>;
  choose<N extends string, S extends 'text'>(
    name: N,
    type: S,
    options?: Parameters<this['enterText']>[1]
  ): Action<P, A & {[key in N]: string}>;
  choose<N extends string, S extends 'select', T extends SingleArgument<P>>(
    name: N,
    type: S,
    choices: T[] | Record<string, T> | ((args: A) => T[] | Record<string, T>),
    options?: Parameters<this['chooseFrom']>[2]
  ): Action<P, A & {[key in N]: T}>;
  choose<N extends string, S extends 'board', T extends GameElement<P>>(
    name: N,
    type: S,
    choices: BoardQueryMulti<P, T, A>,
    options?: Parameters<this['chooseOnBoard']>[2] & { min: never, max: never, number: never }
  ): Action<P, A & {[key in N]: T}>;
  choose<N extends string, S extends 'board', T extends GameElement<P>>(
    name: N,
    type: S,
    choices: BoardQueryMulti<P, T, A>,
    options?: Parameters<this['chooseOnBoard']>[2]
  ): Action<P, A & {[key in N]: T[]}>;
  choose<N extends string, S extends 'select' | 'number' | 'text' | 'board'>(
    name: N,
    type: S,
    choices?: any,
    options?: Record<string, any>
  ): Action<P, A & {[key in N]: Argument<P>}> {
    if (type === 'number') return this.chooseNumber(name, choices as Parameters<this['chooseNumber']>[1]);
    if (type === 'text') return this.enterText(name, choices as Parameters<this['enterText']>[1]);
    if (type === 'select') return this.chooseFrom(name, choices as Parameters<this['chooseFrom']>[1], options as Parameters<this['chooseFrom']>[2]);
    return this.chooseOnBoard(name, choices as Parameters<this['chooseOnBoard']>[1], options as Parameters<this['chooseOnBoard']>[2]);
  }

  /**
   * Create a multi-selection choice. These selections will be presented all at
   * once as a form.
   *
   * @param choices - An object containing the selections. This is a set of
   * key-value pairs where each key is the name of the selection and each value
   * is an array of options where the first array element is a string indicating
   * the type of choice ('number', 'select', 'board', 'text') and subsequent
   * elements contain the options for the appropriate choice function
   * (`chooseNumber`, `chooseFrom`, `chooseOnBoard` or `enterText`).
   *
   * @param options.validate - A function that takes an object of key-value
   * pairs for all player choices and returns a boolean. If false, the game will
   * not allow the player to submit these choices. If a string is returned, this
   * will display as the reason for disallowing these selections.
   *
   * @param options.confirm - A confirmation message that the player will always
   * see before commiting this choice. This can be useful to present additional
   * information about the consequences of this choice, or simply to force the
   * player to hit a button with a clear message. This can be a simple string,
   * or a 2-celled array in the same form as {@link message} with a string
   * message and a set of key-value pairs for string interpolation, optionally
   * being a function that takes an object of key-value pairs for all player
   * choices, and returns the interpolation object.
   *
   * @example
   * action({
   *   prompt: 'purchase'
   * }).chooseGroup({
   *   lumber: ['number', { min: 2 }],
   *   steel: ['number', { min: 2 }]
   * }, {
   *   // may not purchase more than 10 total resources
   *   validate: ({ lumber, steel }) => lumber + steel <= 10
   * });
   * @category Choices
   */
  chooseGroup<R extends Group<P>>(
    choices: R,
    options?: {
      validate?: (args: ExpandGroup<P, A, R>) => string | boolean | undefined,
      confirm?: string | [string, Record<string, Argument<P>> | ((args: ExpandGroup<P, A, R>) => Record<string, Argument<P>>) | undefined]
    }
  ): Action<P, ExpandGroup<P, A, R>> {
    let hasBoardSelection = false;
    for (const [name, choice] of Object.entries(choices)) {
      if (choice[0] === 'board') {
        if (hasBoardSelection) throw Error(`May not use chooseGroup with multiple board selections in ${this.name}`);
        hasBoardSelection = true;
      }

      if (choice[0] === 'number') this.chooseNumber(name, choice[1]);
      if (choice[0] === 'select') this.chooseFrom(name, choice[1], choice[2]);
      if (choice[0] === 'board') this.chooseOnBoard(name, choice[1], choice[2]);
      if (choice[0] === 'text') this.enterText(name, choice[1]);
    }
    if (options?.confirm) this.selections[this.selections.length - 1].confirm = typeof options.confirm === 'string' ? [options.confirm, undefined] : options.confirm;
    if (options?.validate) this.selections[this.selections.length - 1].validation = options.validate
    for (let i = 1; i < Object.values(choices).length; i++) {
      this.selections[this.selections.length - 1 - i].clientContext = {combineWith: this.selections.slice(-i).map(s => s.name)};
    }
    return this as unknown as Action<P, ExpandGroup<P, A, R>>;
  }

  /**
   * Indicates that this action does a move with the selected elements. This is
   * almost the equivalent of calling Action#do and adding a putInto command,
   * except that the game will also permit the UI to allow a mouse drag for the
   * move.
   *
   * @param piece - A {@link Piece} to move or the name of the piece selection in this action
   * @param into - A {@link GameElement} to move into or the name of the
   * destination selection in this action.
   *
   * player => action({
   *   prompt: 'Discard a card from hand'
   * }).chooseOnBoard(
   *   'card', player.my(Card)
   * ).move(
   *   'card', $.discard
   * )
   * @category Behaviour
   */
  move(piece: keyof A | Piece, into: keyof A | GameElement) {
    this.do((args: A) => {
      const selectedPiece = piece instanceof Piece ? piece : args[piece] as Piece | Piece[];
      const selectedInto = into instanceof GameElement ? into : args[into] as GameElement;
      if (selectedPiece instanceof Array) {
        new ElementCollection(...selectedPiece).putInto(selectedInto);
      } else {
        selectedPiece.putInto(selectedInto);
      }
    });
    const pieceSelection = typeof piece === 'string' ? this.selections.find(s => s.name === piece) : undefined;
    const intoSelection = typeof into === 'string' ? this.selections.find(s => s.name === into) : undefined;
    if (intoSelection?.isMulti()) throw Error("May not move into a multiple choice selection");
    if (pieceSelection && !pieceSelection.isMulti()) pieceSelection.clientContext = { dragInto: intoSelection ?? into };
    if (intoSelection) intoSelection.clientContext = { dragFrom: pieceSelection ?? piece };
    return this;
  }

  /**
   * Add a placement selection to this action. This will be presented as a piece
   * that players can move into the desired location, snapping to the grid of
   * the destination as the player moves.
   *
   * @param piece - The name of the piece selection in this action from a
   * `chooseOnBoard` prior to this
   * @param into - A {@link GameElement} to move into
   *
   * @param options.validate - A function that takes an object of key-value
   * pairs for all player choices and returns a boolean. The position selected
   * during the piece placement can be checked by reading the 'column', 'row'
   * and `rotation` properties of the `piece` as provided in the first
   * argument. If false, the game will not allow the player to submit these
   * choices. If a string is returned, this will display as the reason for
   * disallowing these selections.
   *
   * @param options.confirm - A confirmation message that the player will always
   * see before commiting this choice. This can be useful to present additional
   * information about the consequences of this choice, or simply to force the
   * player to hit a button with a clear message. This can be a simple string,
   * or a 2-celled array in the same form as {@link message} with a string
   * message and a set of key-value pairs for string interpolation, optionally
   * being a function that takes an object of key-value pairs for all player
   * choices, and returns the interpolation object.
   *
   * @param options.rotationChoices = An array of valid rotations in
   * degrees. These choices must be normalized to numbers between 0-359°. If
   * supplied the piece will be given rotation handles for the player to set the
   * rotation and position together.
   *
   * player => action({
   *   prompt: 'Place your tile'
   * }).chooseOnBoard(
   *   'tile', player.my(Tile)
   * ).placePiece(
   *   'tile', $.map, {
   *     confirm: ({ tile }) => [
   *       'Place tile into row {{row}} and column {{column}}?',
   *       tile
   *     ]
   * })
   * @category Choices
   */
  placePiece<T extends keyof A & string>(piece: T, into: GameElement, options?: {
    prompt?: string | ((args: A) => string),
    confirm?: string | [string, Record<string, Argument<P>> | ((args: A & {[key in T]: { column: number, row: number }}) => Record<string, Argument<P>>) | undefined]
    validate?: ((args: A & {[key in T]: { column: number, row: number }}) => string | boolean | undefined),
    rotationChoices?: number[],
  }) {
    const { prompt, confirm, validate } = options || {};
    if (this.selections.some(s => s.name === '__placement__')) throw Error("An action may only place one piece");
    const pieceSelection = this.selections.find(s => s.name === piece);
    if (!pieceSelection) throw (`No selection named ${String(piece)} for placePiece`)
    const positionSelection = this._addSelection(new Selection<P>(
      '__placement__', { prompt, confirm, validation: validate, selectPlaceOnBoard: {piece, rotationChoices: options?.rotationChoices} }
    ));
    positionSelection.clientContext = { placement: { piece, into } };
    this.moves.push((args: A & {__placement__: number[]}) => {
      const selectedPiece = args[piece];
      if (!(selectedPiece instanceof Piece)) throw Error(`Cannot place piece selection named ${String(piece)}. Returned ${selectedPiece} instead of a piece`);
      selectedPiece.putInto(into);
      selectedPiece.column = args['__placement__'][0];
      selectedPiece.row = args['__placement__'][1];
      selectedPiece.rotation = args['__placement__'][2];
    });
    this.order.push('move');
    if (pieceSelection) pieceSelection.clientContext = { dragInto: into };
    return this as unknown as Action<P, A & {__placement__: number[]} & {[key in T]: { column: number, row: number }}>;
  }
}
