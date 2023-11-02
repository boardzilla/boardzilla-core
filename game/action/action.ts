import Selection from './selection';

import type {
  SingleArgument,
  Argument,
  ResolvedSelection,
  BoardQueryMulti,
  BoardQuerySingle,
  PendingMove,
} from './types';
import type { GameElement, Piece } from '../board/';
import type { Player } from '../player';

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
export default class Action<P extends Player, A extends Argument<P>[]> {
  /** @internal */
  name?: string;
  /** @internal */
  prompt: string;
  /** @internal */
  _cfg: {
    selections: Selection<P>[],
    moves: ((...args: Argument<P>[]) => void)[];
    condition?: (() => boolean) | boolean;
    messages: (string | ((...args: Argument<P>[]) => string))[];
  } = {
    selections: [],
    moves: [],
    messages: []
  }

  /** @internal */
  constructor({ prompt, condition }: {
    prompt: string,
    condition?: (() => boolean) | boolean,
  }) {
    this.prompt = prompt;
    this._cfg.condition = condition;
  }

  /** @internal */
  isPossible(): boolean {
    return typeof this._cfg.condition === 'function' ? this._cfg.condition() : this._cfg.condition ?? true;
  }

  // given a set of args, return sub-selections possible trying each possible next arg
  // return undefined if these args are impossible
  // skipping/expanding is very complex
  // skippable options will still appear in order to present the choices to the user to select that tree. This will be the final selection or the first board choice
  /** @internal */
  _getResolvedSelections(...args: Argument<P>[]): PendingMove<P>[] | undefined {
    const selection = this._nextSelection(...args);
    if (!selection) return [];

    const move = {
      action: this.name!,
      args,
      selection
    };

    if (!selection.isPossible()) return;
    if (selection.isUnbounded()) return [move];

    let possibleOptions: Argument<P>[] = [];
    let pruned = false;
    let resolvedSelections: PendingMove<P>[] = [];
    let mayExpand = selection.expand;
    for (const option of selection.options()) {
      const submoves = this._getResolvedSelections(...args, option);
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
    if (!resolvedSelections.length || move.selection.type === 'board') return [move]; // return board or final choice for a selection prompt, receiver may choose to skip anyways
    if (mayExpand) return resolvedSelections;
    if (selection.skipIfOnlyOne && possibleOptions.length === 1) return resolvedSelections;
    return [move];
  }

  /**
   * given a partial arg list, returns a selection object for continuation if one exists.
   * @internal
   */
  _nextSelection(...args: Argument<P>[]): ResolvedSelection<P> | undefined {
    let argsLeft = args.length;
    let i = 0;
    if (!this._cfg.selections.length) return;
    do {
      const selection = this._cfg.selections[i].resolve(...args);
      if (selection.skipIf !== true) argsLeft--;
      if (argsLeft >= 0) i++;
    } while (argsLeft >= 0 && i < this._cfg.selections.length);

    const selection = this._cfg.selections[i];
    if (selection) {
      // use the last defined prompt in the action
      selection.prompt ??= [...this._cfg.selections.slice(0, args.length)].reverse().find(s => s.prompt)?.prompt || this.prompt;
      return selection.resolve(...args);
    }
  }

  /**
   * process this action with supplied args. returns error if any
   * @internal
   */
  _process(...args: Argument<P>[]): string | undefined {
    // truncate invalid args - is this needed?
    let error: string | undefined = undefined;
    for (let i = 0; i !== this._cfg.selections.length && i !== args.length; i++) {
      error = this._cfg.selections[i].validate(args[i], args.slice(0, i) as Argument<P>[]);
      if (error) {
        console.error('invalid arg', args[i], i, error);
        args = args.slice(0, i) as A;
        break;
      }
    }

    const resolvedSelections = this._getResolvedSelections(...args);
    if (!resolvedSelections) {
      console.error('could not resolve this args', this.name, args);
      return error || 'unknown error during action._process';
    }
    if (resolvedSelections.length) {
      return error || 'incomplete action';
    }

    try {
      for (const move of this._cfg.moves) move(...args);
    } catch(e) {
      console.error(e);
      return e.message;
    }
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
  do(move: (...args: A) => void) {
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
  message(message: string | ((...args: A) => string)) {
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
   * @param options.skipIf - If set to true, this choice will be skipped. You
   * may use this if you determine at the time that the choice is meaningless,
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
  chooseFrom<T extends SingleArgument<P>>({ choices, prompt, /* initial, */ skipIfOnlyOne, skipIf, expand }: {
    choices: T[] | Record<string, T> | ((...arg: A) => T[] | Record<string, T>),
    prompt?: string | ((...arg: A) => string)
    // initial?: T | ((...arg: A) => T), // needed for select-boxes?
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((...a: Argument<P>[]) => boolean);
    expand?: boolean,
  }): Action<P, [...A, T]> {
    this._cfg.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, skipIf, expand, selectFromChoices: { choices } }));
    return this as unknown as Action<P, [...A, T]>;
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
  enterText({ prompt, regexp, initial }: {
    prompt: string | ((...arg: A) => string),
    regexp?: RegExp,
    initial?: string | ((...a: Argument<P>[]) => string)
  }): Action<P, [...A, string]> {
    this._cfg.selections.push(new Selection<P>({ prompt, enterText: { regexp, initial }}));
    return this as unknown as Action<P, [...A, string]>;
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
  confirm(prompt: string | ((...arg: A) => string)): Action<P, [...A, 'confirm']> {
    this._cfg.selections.push(new Selection<P>({ prompt, skipIfOnlyOne: false, value: true }));
    return this as unknown as Action<P, [...A, 'confirm']>;
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
  chooseNumber({ min, max, prompt, initial, skipIfOnlyOne, skipIf, expand }: {
    min?: number | ((...arg: A) => number),
    max?: number | ((...arg: A) => number),
    prompt?: string | ((...arg: A) => string),
    initial?: number | ((...arg: A) => number),
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((...a: Argument<P>[]) => boolean);
    expand?: boolean,
  }): Action<P, [...A, number]> {
    this._cfg.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, skipIf, expand, selectNumber: { min, max, initial } }));
    return this as unknown as Action<P, [...A, number]>;
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
  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, skipIfOnlyOne, skipIf, expand }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((...a: Argument<P>[]) => boolean);
    expand?: boolean,
  }): Action<P, [...A, T]>;
  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, min, max, number, skipIfOnlyOne, skipIf, expand }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    min?: number | ((...arg: A) => number);
    max?: number | ((...arg: A) => number);
    number?: number | ((...arg: A) => number);
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((...a: Argument<P>[]) => boolean);
    expand?: boolean,
  }): Action<P, [...A, T[]]>;
  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, min, max, number, skipIfOnlyOne, skipIf, expand }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    min?: number | ((...arg: A) => number);
    max?: number | ((...arg: A) => number);
    number?: number | ((...arg: A) => number);
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((...a: Argument<P>[]) => boolean);
    expand?: boolean,
  }): Action<P, [...A, T | T[]]> {
    this._cfg.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, skipIf, expand, selectOnBoard: { chooseFrom: choices, min, max, number } }));
    if (min !== undefined || max !== undefined || number !== undefined) {
      return this as unknown as Action<P, [...A, T[]]>;
    }
    return this as unknown as Action<P, [...A, T]>;
  }

  move<E extends Piece<P>, I extends GameElement<P>>({ piece, into, prompt }: {
    piece: BoardQuerySingle<P, E>,
    into: BoardQuerySingle<P, I>,
    prompt?: string,
  }): Action<P, A>;
  move<E extends Piece<P>, I extends GameElement<P>>({ choosePiece, into, prompt }: {
    choosePiece: BoardQueryMulti<P, E>,
    into: BoardQuerySingle<P, I>,
    prompt?: string
  }): Action<P, [...A, E]>;
  move<E extends Piece<P>, I extends GameElement<P>>({ piece, chooseInto, prompt, promptInto }: {
    piece: BoardQuerySingle<P, E>,
    chooseInto: BoardQueryMulti<P, I>,
    prompt?: string
    promptInto?: string
  }): Action<P, [...A, I]>;
  move<E extends Piece<P>, I extends GameElement<P>>({ choosePiece, chooseInto, prompt, promptInto }: {
    choosePiece: BoardQueryMulti<P, E>,
    chooseInto: BoardQueryMulti<P, I>,
    prompt?: string
    promptInto?: string
  }): Action<P, [...A, E, I]>;
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
  move<E extends Piece<P>, I extends GameElement<P>>({ piece, into, choosePiece, chooseInto, prompt, promptInto }: {
    piece?: BoardQuerySingle<P, E>,
    into?: BoardQuerySingle<P, I>,
    choosePiece?: BoardQueryMulti<P, E>,
    chooseInto?: BoardQueryMulti<P, I>,
    prompt?: string
    promptInto?: string
  }): any {
    const numberOfPriorSelections = this._cfg.selections.length;
    if (choosePiece) {
      this._cfg.selections.push(new Selection<P>({
        prompt,
        skipIfOnlyOne: false,
        selectOnBoard: { chooseFrom: choosePiece },
        clientContext: { dragInto: chooseInto || into }
      }));
    }
    if (chooseInto) {
      this._cfg.selections.push(new Selection<P>({
        prompt: promptInto || prompt,
        selectOnBoard: { chooseFrom: chooseInto },
        clientContext: { dragFrom: choosePiece || piece }
      }));
    }
    if (!choosePiece && !chooseInto) {
      this._cfg.moves.push(() => (resolve(piece))!.putInto(resolve(into)!));
    }
    if (choosePiece && !chooseInto) {
      this._cfg.moves.push((...args: Argument<P>[]) => (args[numberOfPriorSelections] as E)!.putInto(resolve(into)!));
    }
    if (!choosePiece && chooseInto) {
      this._cfg.moves.push((...args: Argument<P>[]) => resolve(piece)!.putInto(args[numberOfPriorSelections] as I));
    }
    if (choosePiece && chooseInto) {
      this._cfg.moves.push((...args: Argument<P>[]) => (args[numberOfPriorSelections] as E)!.putInto(args[numberOfPriorSelections + 1] as I));
    }
    return this;
  }
}

const resolve = <P extends Player, T extends GameElement<P>>(q: BoardQuerySingle<P, T>, ...args: Argument<P>[]) => {
  if (typeof q === 'string') throw Error("not impl");
  return (typeof q === 'function') ? q(...args) : q;
}
