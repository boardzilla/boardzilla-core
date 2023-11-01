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
 * Actions represent discreet moves players can make. The Action object is responsible for:
 * - providing Selection objects to players to aid in supplying appropriate Arguments
 * - validating player Arguments and returning any Selections needed to complete
 * - accepting player Arguments and altering board state
 */
export default class Action<P extends Player, A extends Argument<P>[]> {
  name?: string;
  prompt: string;
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

  constructor({ prompt, condition }: {
    prompt: string,
    condition?: (() => boolean) | boolean,
  }) {
    this.prompt = prompt;
    this._cfg.condition = condition;
  }

  isPossible(): boolean {
    return typeof this._cfg.condition === 'function' ? this._cfg.condition() : this._cfg.condition ?? true;
  }

  // given a set of args, return sub-selections possible trying each possible next arg
  // return undefined if these args are impossible
  // skipping/expanding is very complex
  // skippable options will still appear in order to present the choices to the user to select that tree. This will be the final selection or the first board choice
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

  do(move: (...args: A) => void) {
    this._cfg.moves.push(move);
    return this;
  }

  message(message: string | ((...args: A) => string)) {
    this._cfg.messages.push(message);
    return this;
  }

  chooseFrom<T extends SingleArgument<P>>({ choices, prompt, initial, skipIfOnlyOne, skipIf, expand }: {
    choices: T[] | Record<string, T> | ((...arg: A) => T[] | Record<string, T>),
    initial?: T | ((...arg: A) => T),
    prompt?: string | ((...arg: A) => string)
    skipIfOnlyOne?: boolean,
    skipIf?: boolean | ((...a: Argument<P>[]) => boolean);
    expand?: boolean,
  }): Action<P, [...A, T]> {
    this._cfg.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, skipIf, expand, selectFromChoices: { choices, initial } }));
    return this as unknown as Action<P, [...A, T]>;
  }

  enterText({ prompt, regexp, initial }: {
    prompt: string | ((...arg: A) => string),
    regexp?: RegExp,
    initial?: string | ((...a: Argument<P>[]) => string)
  }): Action<P, [...A, string]> {
    this._cfg.selections.push(new Selection<P>({ prompt, enterText: { regexp, initial }}));
    return this as unknown as Action<P, [...A, string]>;
  }

  confirm(prompt: string | ((...arg: A) => string)): Action<P, [...A, 'confirm']> {
    this._cfg.selections.push(new Selection<P>({ prompt, skipIfOnlyOne: false, value: true }));
    return this as unknown as Action<P, [...A, 'confirm']>;
  }

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
