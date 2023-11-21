import Selection from './selection.js';

import type {
  ResolvedSelection,
  BoardQuery,
  BoardQueryMulti,
  BoardQuerySingle,
  BoardSelection,
} from './selection.js';
import type { GameElement, Piece } from '../board/index.js';
import type { Player } from '../player/index.js';
import type { PendingMove } from '../game.js';

export type SingleArgument<P extends Player> = string | number | boolean | GameElement<P> | P;
export type Argument<P extends Player> = SingleArgument<P> | SingleArgument<P>[];

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
 * Actions represent discreet moves players can make. Create Actions using the
 * {@link action} function. Actions are evaluated at the time the player has the
 * option to perform the action, so any methods that involve game state will
 * reflect the state at the time the action is performed.
 *
 * @privateRemarks
 * The Action object is responsible for:
 * - providing Selection objects to players to aid in supplying appropriate Arguments
 * - validating player Arguments and returning any Selections needed to complete
 * - accepting player Arguments and altering board state
 *
 * @category Actions
 */
export default class Action<P extends Player, A extends Record<string, Argument<P>> = Record<string, never>> {
  /** @internal */
  name?: string;
  /** @internal */
  prompt?: string;
  /** @internal */
  _cfg: {
    selections: Selection<P>[],
    moves: ((args: Record<string, Argument<P>>) => void)[];
    condition?: (() => boolean) | boolean;
    messages: (string | ((args: Record<string, Argument<P>>) => string))[];
  } = {
    selections: [],
    moves: [],
    messages: []
  }

  /** @internal */
  constructor({ prompt, condition }: {
    prompt?: string,
    condition?: (() => boolean) | boolean,
  }) {
    this.prompt = prompt;
    if (condition !== undefined) this._cfg.condition = condition;
  }

  /** @internal */
  isPossible(): boolean {
    return typeof this._cfg.condition === 'function' ? this._cfg.condition() : this._cfg.condition ?? true;
  }

  // given a set of args, return sub-selections possible trying each possible next arg
  // return undefined if these args are impossible
  // return 0-length if these args are submittable
  // return array of follow-up selections if incomplete
  // skipping/expanding is very complex
  // skippable options will still appear in order to present the choices to the user to select that tree. This will be the final selection
  /** @internal */
  _getResolvedSelections(args: Record<string, Argument<P>>): PendingMove<P>[] | undefined {
    let moves = this._getResolvedSelectionsInner(args);
    // resolve any combined selections now with only args up until first choice
    if (moves?.length) {
      for (const move of moves) {
        if (move.selections[0].clientContext?.combineWith) {
          let confirm: Selection<P>['confirm'] | undefined = undefined;
          let validation: Selection<P>['validation'] | undefined = undefined;
          for (const combine of move.selections[0].clientContext.combineWith) {
            const resolved = combine.resolve(args);
            confirm = resolved.confirm ?? confirm; // find latest confirm for the overall combination
            validation = resolved.validation ?? validation;
            if (!resolved.skipIf) {
              const arg = resolved.isForced();
              if (arg !== undefined) {
                move.args[resolved.name] = arg;
              } else {
                move.selections.push(resolved);
              }
            }
          }
          if (confirm) move.selections[0].confirm = confirm; // and put it on top
          if (validation) move.selections[move.selections.length - 1].validation = validation; // on bottom
        }
      }
    }
    return moves;
  }

  /** @internal */
  _getResolvedSelectionsInner(args: Record<string, Argument<P>>): PendingMove<P>[] | undefined {
    const selection = this._nextSelection(args);
    if (!selection) return [];

    const move = {
      action: this.name!,
      prompt: this.prompt,
      args,
      selections: [selection]
    };

    if (!selection.isPossible()) return;
    if (!selection.isUnbounded()) {
      let possibleOptions: Argument<P>[] = [];
      let pruned = false;
      let resolvedSelections: PendingMove<P>[] = [];
      let mayExpand = selection.expand;
      for (const option of selection.options()) {
        const allArgs = {...args, [selection.name]: option};
        if (selection.validation && selection.error(allArgs)) continue;
        const submoves = this._getResolvedSelectionsInner(allArgs);
        if (submoves === undefined) {
          pruned = true;
        } else {
          possibleOptions.push(option);
          if (selection.expand && submoves.length === 0) mayExpand = false; // TODO smarter expansion needed when triggered/optional selections are added
          resolvedSelections = resolvedSelections.concat(submoves);
        }
      }
      if (!possibleOptions.length) return undefined;
      if (pruned && !selection.isMulti()) selection.overrideOptions(possibleOptions as SingleArgument<P>[]);

      // return the expanded selection if mayExpand, or if there's a single, skippable choice
      if (resolvedSelections.length && (mayExpand || selection.skipIfOnlyOne && possibleOptions.length === 1)) return resolvedSelections;
    }

    // return board or final choice for a selection prompt, UI may choose to skip anyways
    return [move];
  }

  /**
   * given a partial arg list, returns a selection object for continuation if one exists.
   * @internal
   */
  _nextSelection(args: Record<string, Argument<P>>): ResolvedSelection<P> | undefined {
    let nextSelection: ResolvedSelection<P> | undefined = undefined;
    for (const s of this._cfg.selections) {
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
  _process(args: Record<string, Argument<P>>): string | undefined {
    // truncate invalid args - is this needed?
    let error: string | undefined = undefined;
    for (const selection of this._cfg.selections) {
      error = selection.error(args);
      if (error) {
        console.error('invalid arg', selection.name, args[selection.name], error);
        break;
      }
    }

    const resolvedSelections = this._getResolvedSelections(args);
    if (!resolvedSelections) {
      console.error('attempted to process invalid args', this.name, args);
      return error || 'unknown error during action._process';
    }
    if (resolvedSelections.length) {
      return error || 'incomplete action';
    }

    try {
      for (const move of this._cfg.moves) move(args);
    } catch(e) {
      console.error(e);
      return e.message;
    }
  }

  _addSelection(selection: Selection<P>) {
    if (this._cfg.selections.find(s => s.name === selection.name)) throw Error(`Duplicate name for action ${this.name}: ${selection.name}`);
    this._cfg.selections.push(selection);
  }

  /**
   * Add behavior to this action. After adding the choices to an action, calling
   * `do` causes Boardzilla to use the player choices to actually do something
   * with those choices. Call this method after all the methods for player
   * choices so that the choices are properly available to the `do` function.
   *
   * @param move - The action to perform. This function accepts one argument for
   * each choice added to the action, in the order they were added.
   *
   * @example
   * action({
   *   prompt: "Take resources",
   * }).chooseFrom({
   *   prompt: "Select resource",
   *   choices: ['lumber', 'steel'],
   * }).chooseNumber({
   *   prompt: "Select amount",
   *   max: 3
   * }).do((resource, amount) => {
   *   // the choices are automatically passed in with their proper type
   *   board.firstN(amount, Resource, {resource}).putInto(
   *     board.first('stockPile', {mine: true})
   *   );
   * })
   */
  do(move: (args: A) => void): Action<P, A> {
    this._cfg.moves.push(move);
    return this;
  }

  /**
   * Add a message to this action that will be broadcast in the chat. Call this
   * method after all the methods for player choices so that the choices are
   * properly available to the `message` function.
   *
   * @param message - The message to send. This can be a string or or a
   * function. If using the function, this accepts one argument for each choice
   * added to the action, in the order they were added. The function form can be
   * used when you want to additional logic in the message. In either case, the
   * string follows the same rules as {@link Board#message} with the following
   * additions:
   * - The player taking the move can be interpolated into the message with
   *   `{{player}}`. This allows boardzilla to display the player name with
   *   their color.
   * - Each choice the player made is automatically added as an argument to the
   *   message and can be interpolated with `{{n}}` where n is the number
   *   corresponding to the order of choices, starting with zero.
   *
   * @example
   * action({
   *   prompt: "Say something",
   * }).enterText({
   *   prompt: "Message",
   * }).message(
   *   "{{player}} said {{0}}" // string form
   * ).message(
   *   text => `I said, {{player}} said ${text.toUpperCase()}!` // function form
   * )
   */
  message(message: string | ((args: A) => string)) {
    this._cfg.messages.push(message);
    return this;
  }

  /**
   * Add a choice to this action from a list of options. These choices will be
   * displayed as buttons in the UI.
   *
   * @param {Object} options
   * @param options.choices - Either an array of choices or a object with a
   * key-value pair of choices. Use the object style when you want player
   * text to contain additional logic that you don't want to reference in the
   * game logic, similiar to `<option value="key">Some text</option>` in
   * HTML. This can also be a function that returns the choice
   * array/object. This function will accept arguments for each choice the
   * player has made up to this point in the action.
   * @param options.prompt - Prompt displayed to the user for this choice.
   * @param options.skipIfOnlyOne - If set to true, if there is only valid
   * choice in the choices given, the game will skip this choice, prompting the
   * player for subsequent choices, if any, or completing the action
   * otherwise. Default true.
   * @param options.expand - If set to true, rather than present this choice
   * directly, the player will be prompted with choices from the *next choice*
   * in the action for each possible choice here, essentially expanding the
   * choices ahead of time to save the player a step. Default false.
   * @param options.skipIf - If set to true, this choice will be skipped. Use
   * this in the rare situations where the choice at the time is meaningless,
   * e.g. selecting from a set of identical tokens. If you want to skip actions
   * that have only one choice, simply use `skipIfOnlyOne` instead.
   *
   * @example
   * action({
   *   prompt: "Take resources",
   * }).chooseFrom({
   *   prompt: "Select resource",
   *   choices: ['lumber', 'steel', 'oil'],
   * }).chooseFrom({
   *   // A follow-up choice that doesn't apply to "oil"
   *   skipIf: resource => resource === 'oil'
   *   // Use the functional style to include the resource choice in the text
   *   // Also use object style to have the value simply be "high" or "low"
   *   choices: resource => ({
   *     high: `High grade ${resource}`,
   *     low: `Low grade ${resource}`
   *   }),
   * })
   */
  chooseFrom<N extends string, T extends SingleArgument<P>>(
    name: N,
    choices: T[] | Record<string, T> | ((args: A) => T[] | Record<string, T>),
    options?: {
      prompt?: string | ((args: A) => string)
      confirm?: string | ((args: A & {[key in N]: T}) => string)
      validate?: ((args: A & {[key in N]: T}) => string | boolean | undefined)
      // initial?: T | ((...arg: A) => T), // needed for select-boxes?
      skipIfOnlyOne?: boolean,
      skipIf?: boolean | ((args: A) => boolean);
      expand?: boolean
    }
  ): Action<P, A & {[key in N]: T}> {
    this._addSelection(new Selection<P>(name, { ...(options || {}), selectFromChoices: { choices } }));
    return this as unknown as Action<P, A & {[key in N]: T}>;
  }

  /**
   * Prompt the user for text entry. Use this in games where players submit
   * text, like word-guessing games.
   *
   * @param {Object} options
   * @param options.initial - Default text that can appear initially before a
   * user types.
   * @param options.prompt - Prompt displayed to the user for entering this
   * text.
   * @param options.regexp - If supplied, text must match this regexp to be
   * valid.
   *
   * @example
   * action({
   *   prompt: "Guess a word",
   * }).enterText({
   *   prompt: "Your guess",
   * }).message(
   *   guess => `{{player}} guessed ${guess}`
   * })
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
   * Add a confirmtation step to this action. This can be useful if you want to
   * present additional information to the player related to the consequences of
   * their choice, like a cost incurred. Or this can simply be used to force the
   * user to click an additional button on a particular important choice.
   *
   * @param prompt - Button text for the confirmation step. This can be a
   * function returning the text which accepts each choice the player has made
   * up till now as an argument.
   *
   * @example
   * action({
   *   prompt: "Buy resources",
   * }).chooseNumber({
   *   prompt: "Amount",
   *   max: Math.floor(player.coins / 5)
   * }).confirm(
   *   amount => `Spend ${amount * 5} coins`
   * }).do(amount => {
   *   player.resource += amount;
   *   player.coins -= amount * 5;
   * });
   */
  // may get rid of:
  confirm(prompt: string | ((args: A) => string)): Action<P, A> {
    this._addSelection(new Selection<P>('__confirm__', { prompt, skipIfOnlyOne: false, value: true }));
    return this;
  }

  /**
   * Add a numerical selection to this action. This will be presented with a
   * number picker.
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
   * @param options.skipIfOnlyOne - If set to true, if there is only valid
   * number selectable, the game will skip this choice, prompting the
   * player for subsequent choices, if any, or completing the action
   * otherwise. Default true.
   *
   * @param options.expand - If set to true, rather than present this choice
   * directly, the player will be prompted with choices from the *next choice*
   * in the action for each number selectable, essentially expanding the
   * choices ahead of time to save the player a step. Default false.
   * @param options.skipIf - If set to true, this choice will be skipped. You
   * may use this if you determine at the time that the choice is meaningless,
   * e.g. selecting from a set of identical tokens. If you want to skip actions
   * that have only one choice, simply use `skipIfOnlyOne` instead.
   *
   * @example
   * action({
   *   prompt: "Buy resources",
   * }).chooseNumber({
   *   prompt: "Amount",
   *   min: 5,
   *   max: 10 // select from 5 - 10
   * }).do(amount => {
   *   player.resource += amount;
   * });
   */
  chooseNumber<N extends string>(name: N, options: {
    min?: number | ((args: A) => number),
    max?: number | ((args: A) => number),
    prompt?: string | ((args: A) => string),
    confirm?: string | ((args: A & {[key in N]: number}) => string),
    validate?: ((args: A & {[key in N]: number}) => string | boolean | undefined),
    initial?: number | ((args: A) => number),
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((args: A) => boolean);
    expand?: boolean,
  } = {}): Action<P, A & {[key in N]: number}> {
    const { min, max, prompt, confirm, validate, initial, skipIfOnlyOne, skipIf, expand } = options;
    this._addSelection(new Selection<P>(name, { prompt, confirm, validation: validate, skipIfOnlyOne, skipIf, expand, selectNumber: { min, max, initial } }));
    return this as unknown as Action<P, A & {[key in N]: number}>;
  }


  /**
   * Add a choice to this action using the board. Users will click on the board
   * to make their choice.
   *
   * @param {Object} options

   * @param options.choices - Elements that may be chosen. This can either be an
   * array of elements or a function returning an array, if the choices depend
   * on previous choices. If using a function, it will accept arguments for each
   * choice the player has made up to this point in the action.
   *
   * @param options.prompt - Prompt displayed to the user for this choice.
   *
   * @param options.skipIfOnlyOne - If set to true, if there is only valid
   * choice in the choices given, the game will skip this choice, prompting the
   * player for subsequent choices, if any, or completing the action
   * otherwise. Default true.
   *
   * @param options.expand - If set to true, rather than present this choice
   * directly, the player will be prompted with choices from the *next choice*
   * in the action for each possible choice here, essentially expanding the
   * choices ahead of time to save the player a step. Default false.
   *
   * @param options.skipIf - If set to true, this choice will be skipped. You
   * may use this if you determine at the time that the choice is meaningless,
   * e.g. selecting from a set of identical tokens. If you want to skip actions
   * that have only one choice, simply use `skipIfOnlyOne` instead.
   *
   * @param options.number - If supplied, the choice is for a *set* of exactly
   * `number` elements. For example, if the player is being asked to pass 3
   * cards from their hand, the `choices` should be to the cards in their hand
   * and the `number` to 3.
   *
   * @param options.min - If supplied, the choice is for a *set* of
   * elements and the minimum required is `min`.
   *
   * @param options.min - If supplied, the choice is for a *set* of
   * elements and the maximum allowed is `max`.
   *
   * @example
   * action({
   *   prompt: "Mulligan",
   * }).chooseOnBoard({
   *   // select 1-3 cards from hand
   *   prompt: "Mulligan 1-3 cards",
   *   choices: board.all(Card, {mine: true}),
   *   min: 1,
   *   max: 3
   * }).do(cards => {
   *   // `cards` is an ElementCollection of the cards selected
   *   cards.putInto(board.first('discard'));
   *   board.first('deck').firstN(cards.length, Card).putInto(board.first('hand', {mine: true}));
   * })
   */
  chooseOnBoard<T extends GameElement<P>, N extends string>(name: N, choices: BoardQueryMulti<P, T, A>, options?: {
    prompt?: string | ((args: A) => string);
    confirm?: string | ((args: A & {[key in N]: T}) => string);
    validate?: ((args: A & {[key in N]: T | T[]}) => string | boolean | undefined);
    min?: never;
    max?: never;
    number?: never;
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((args: A) => boolean);
    expand?: boolean,
  }): Action<P, A & {[key in N]: T}>;
  chooseOnBoard<T extends GameElement<P>, N extends string>(name: N, choices: BoardQueryMulti<P, T, A>, options?: {
    prompt?: string | ((args: A) => string);
    confirm?: string | ((args: A & {[key in N]: T[]}) => string);
    validate?: ((args: A & {[key in N]: T | T[]}) => string | boolean | undefined);
    min?: number | ((args: A) => number);
    max?: number | ((args: A) => number);
    number?: number | ((args: A) => number);
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((args: A) => boolean);
    expand?: boolean,
  }): Action<P, A & {[key in N]: T[]}>;
  chooseOnBoard<T extends GameElement<P>, N extends string>(name: N, choices: BoardQueryMulti<P, T, A>, options?: {
    prompt?: string | ((args: A) => string);
    confirm?: string | ((args: A & {[key in N]: T | T[]}) => string);
    validate?: ((args: A & {[key in N]: T | T[]}) => string | boolean | undefined);
    min?: number | ((args: A) => number);
    max?: number | ((args: A) => number);
    number?: number | ((args: A) => number);
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((args: A) => boolean);
    expand?: boolean,
  }): Action<P, A & {[key in N]: T | T[]}> {
    const { prompt, confirm, validate, min, max, number, skipIfOnlyOne, skipIf, expand } = options || {};
    this._addSelection(new Selection<P>(
      name, { prompt, confirm, validation: validate, skipIfOnlyOne, skipIf, expand,
        selectOnBoard: { chooseFrom: choices, min, max, number }
      })
    );
    if (min !== undefined || max !== undefined || number !== undefined) {
      return this as unknown as Action<P, A & {[key in N]: T[]}>;
    }
    return this as unknown as Action<P, A & {[key in N]: T}>;
  }

  move<E extends Piece<P>, I extends GameElement<P>, N1 extends string, N2 extends string>(
    pieceName: N1,
    piece: BoardQuerySingle<P, E, A>,
    intoName: N2,
    into: BoardQuerySingle<P, I, A & {[key in N1]: E}>,
    options?: {
      prompt?: string | ((args: A) => string);
      confirm?: string | ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string);
      validate?: ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string | boolean | undefined);
    }
  ): Action<P, A & {[key in N1]: E} & {[key in N2]: I}>;
  move<E extends Piece<P>, I extends GameElement<P>, N1 extends string, N2 extends string>(
    pieceName: N1,
    choosePiece: BoardQueryMulti<P, E, A>,
    intoName: N2,
    into: BoardQuerySingle<P, I, A & {[key in N1]: E}>,
    options?: {
      prompt?: string | ((args: A) => string);
      confirm?: string | ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string);
      validate?: ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string | boolean | undefined);
    }
  ): Action<P, A & {[key in N1]: E} & {[key in N2]: I}>;
  move<E extends Piece<P>, I extends GameElement<P>, N1 extends string, N2 extends string>(
    pieceName: N1,
    piece: BoardQuerySingle<P, E, A>,
    intoName: N2,
    chooseInto: BoardQueryMulti<P, I, A & {[key in N1]: E}>,
    options?: {
      prompt?: string | ((args: A) => string);
      promptInto?: string | ((args: A & {[key in N1]: E}) => string);
      confirm?: string | ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string);
      validate?: ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string | boolean | undefined);
    }
  ): Action<P, A & {[key in N1]: E} & {[key in N2]: I}>;
  move<E extends Piece<P>, I extends GameElement<P>, N1 extends string, N2 extends string>(
    pieceName: N1,
    choosePiece: BoardQueryMulti<P, E, A>,
    intoName: N2,
    chooseInto: BoardQueryMulti<P, I, A & {[key in N1]: E}>,
    options?: {
      prompt?: string | ((args: A) => string);
      promptInto?: string | ((args: A & {[key in N1]: E}) => string);
      confirm?: string | ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string);
      validate?: ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string | boolean | undefined);
    }
  ): Action<P, A & {[key in N1]: E} & {[key in N2]: I}>;
  /**
   * Add a board move to the action. Moves may involve making between zero and
   * two choices depending on the type of move. After the player makes their
   * selections, the move will happen as part of resolving the action. If `do`
   * is called on this action, the behaviour will happen after the move.
   *
   * @param {Object} options
   *
   * @param options.prompt - Prompt displayed to the user for this choice.
   *
   * @param options.promptInto - If there should be a separate prompt for
   * choosing the move to move and where to place it, specify this for the
   * placement choice.
   *
   * @param options.piece - The piece to move. Specify this if there is only
   * ever one choice, e.g. drawing the top card of the deck.
   *
   * @param options.choosePiece - The pieces allowed to move. Specify this if
   * there are potentially multiple choices, e.g. playing a card from hand.
   *
   * @param options.into - Where to move the piece(s) into. Specify this if
   * there is only ever one choice, e.g. discarding a card into the discard pile
   *
   * @param options.chooseInto - The places allowed to move the piece(s)
   * into. Specify this if there are potentially multiple choices, e.g. playing
   * a card from hand into your tableau or into discard.
   *
   * @example
   * action({
   *   prompt: "Discard",
   * }).move({
   *   // choose any of my cards to discard
   *   choosePiece: board.all(Card, {mine: true})
   *   // it can only go one place, the discard
   *   into: board.first('discard')
   * })
   */
  move<E extends Piece<P>, I extends GameElement<P>, N1 extends string, N2 extends string>(
    pieceName: N1,
    piece: BoardQuery<P, E, A & {[key in N1]: E}>,
    intoName: N2,
    into: BoardQuery<P, I, A & {[key in N1]: E} & {[key in N2]: I}>,
    options?: {
      prompt?: string | ((args: A) => string);
      promptInto?: string | ((args: A & {[key in N1]: E}) => string);
      confirm?: string | ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string);
      validate?: ((args: A & {[key in N1]: E} & {[key in N2]: I}) => string | boolean | undefined);
    }
  ): Action<P, A & {[key in N1]: E} & {[key in N2]: I}> {
    this._addSelection(new Selection<P>(pieceName, {
      prompt: options?.prompt,
      skipIfOnlyOne: false,
      selectOnBoard: { chooseFrom: piece } as BoardSelection<P, E>,
      clientContext: { dragInto: into }
    }));
    this._addSelection(new Selection<P>(intoName, {
      prompt: options?.promptInto || options?.prompt,
      confirm: options?.confirm,
      validation: options?.validate,
      selectOnBoard: { chooseFrom: into } as BoardSelection<P, I>,
      clientContext: { dragFrom: piece }
    }));
    this._cfg.moves.push((args: A & {[key in N1]: E} & {[key in N2]: I}) => (args[pieceName] as Piece<P>).putInto(args[intoName] as GameElement<P>));
    return this as unknown as Action<P, A & {[key in N1]: E} & {[key in N2]: I}>;
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

  chooseGroup<R extends Group<P>>(
    choices: R,
    options?: {
      validate?: (args: ExpandGroup<P, A, R>) => string | boolean | undefined,
      confirm?: string | ((args: ExpandGroup<P, A, R>) => string)
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
    if (options?.confirm) this._cfg.selections[this._cfg.selections.length - 1].confirm = options.confirm
    if (options?.validate) this._cfg.selections[this._cfg.selections.length - 1].validation = options.validate
    for (let i = 1; i < Object.values(choices).length; i++) {
      this._cfg.selections[this._cfg.selections.length - 1 - i].clientContext = {combineWith: this._cfg.selections.slice(-i)};
    }
    return this as unknown as Action<P, ExpandGroup<P, A, R>>;
  }
}
