import Selection from './selection';

import type {
  Argument,
  ResolvedSelection,
  BoardQueryMulti,
  BoardQuerySingle,
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
  prompt: string;
  selections: Selection<P>[] = [];
  moves: ((...args: Argument<P>[]) => void)[] = [];
  condition?: (() => boolean) | boolean;
  message?: string | ((...args: Argument<P>[]) => string);

  constructor({ prompt, condition, message }: {
    prompt: string,
    condition?: (() => boolean) | boolean,
    message?: string | ((...args: Argument<P>[]) => string);
  }) {
    this.prompt = prompt;
    this.condition = condition;
    this.message = message;
  }

  isPossible(): boolean {
    if ((typeof this.condition === 'function' ? this.condition() : this.condition) === false) return false;
    const selections = this.selections;
    if (selections.length === 0) return true;

    // easy shortcircuit if any selection is already resolved to an impossibility
    if (selections.some(s => s.isResolved() && !s.isPossible())) return false;
    const selection = selections[0].resolve();
    if (selection.isUnbounded()) return true;
    return selections[0].resolve().options().some(o => this.nextSelection(o));
  }

  /**
   * given a partial arg list, returns a selection object for continuation.
   * returns false if no continuation. returns true if no further
   * selection required.
   */
  nextSelection(...args: Argument<P>[]): ResolvedSelection<P> | boolean {
    const selections = this.selections.slice(args.length);
    if (selections.length === 0) return true;
    const selection = selections[0].resolve(...args);

    if (selection.isUnbounded()) return selection;
    if (!selection.isPossible()) return false;
    const lastUnresolved = [...selections].reverse().find(s => !s.isResolved());
    if (!lastUnresolved) return selection;
    const depth = selections.indexOf(lastUnresolved);
    if (depth <= 0) return selection;

    const options = selection.options();
    const viableOptions = options.filter(o => this.nextSelection(...args, o));
    if (viableOptions.length < (selection.min || 1)) return false;
    if (viableOptions.length === options.length) return selection;
    return selection.overrideOptions(viableOptions);
  }

  // validate args and truncate if invalid, append any add'l args that are
  // forced and return next selection. return error if args fail validation. no
  // selection and no error means args are validated and processable
  forceArgs(...args: Argument<P>[]): [ResolvedSelection<P>?, Argument<P>[]?, string?] {
    let error: string | undefined = undefined;

    // truncate invalid args
    for (let i = 0; i !== args.length; i++) {
      if (!this.selections[i] || this.selections[i].validate(args[i], args.slice(0, i) as Argument<P>[])) {
        args = args.slice(0, i) as A;
        break;
      }
    }

    // check next selection for viable options. append any forced args
    let forcedArg: Argument<P> | undefined = undefined;
    let nextSelection: ResolvedSelection<P> | undefined = undefined;
    do {
      const selection = this.nextSelection(...args);
      if (selection === false) return [undefined, [] as unknown as A, error || "Action invalid. How did you get here?"];
      if (selection === true) return [undefined, args, error];
      forcedArg = selection.isForced();
      if (forcedArg !== undefined) {
        args.push(forcedArg);
      } else {
        nextSelection = selection;
      }
    } while (forcedArg);
    return [nextSelection, args, error];
  }

  process(...args: Argument<P>[]): [ResolvedSelection<P>?, Argument<P>[]?, string?] {
    const [resolvedSelection, forcedArgs, error] = this.forceArgs(...args);
    if (resolvedSelection) return [resolvedSelection, forcedArgs, error];
    if (forcedArgs) args = forcedArgs;

    try {
      for (const move of this.moves) move(...args);
    } catch(e) {
      console.error(e.message, e.stack);
      return [this.selections[0].resolve(), [] as unknown as A, e.message];
    }
    return [];
  }

  do(move: (...args: A) => void) {
    this.moves.push(move);
    return this;
  }

  chooseFrom<T extends Argument<P>>({ choices, prompt, initial }: {
    choices: T[] | Record<string, T> | ((...arg: A) => T[] | Record<string, T>),
    initial?: T | ((...arg: A) => Argument<P>),
    prompt?: string | ((...arg: A) => string)
  }): Action<P, [...A, T]> {
    this.selections.push(new Selection<P>({ prompt, selectFromChoices: { choices, initial } }));
    return this as unknown as Action<P, [...A, T]>;
  }

  enterText({ prompt, regexp, initial }: {
    prompt: string | ((...arg: A) => string),
    regexp?: RegExp,
    initial?: string | ((...a: Argument<P>[]) => string)
  }): Action<P, [...A, string]> {
    this.selections.push(new Selection<P>({ prompt, enterText: { regexp, initial }}));
    return this as unknown as Action<P, [...A, string]>;
  }

  confirm(prompt: string | ((...arg: A) => string)): Action<P, [...A, 'confirm']> {
    this.selections.push(new Selection<P>({ prompt, click: true }));
    return this as unknown as Action<P, [...A, 'confirm']>;
  }

  chooseNumber({ min, max, prompt, initial }: {
    min?: number | ((...arg: A) => number),
    max?: number | ((...arg: A) => number),
    prompt?: string | ((...arg: A) => string),
    initial?: number | ((...arg: A) => number),
  }): Action<P, [...A, number]> {
    this.selections.push(new Selection<P>({ prompt, selectNumber: { min, max, initial } }));
    return this as unknown as Action<P, [...A, number]>;
  }

  chooseOnBoard<T extends GameElement<P>>({ choices, prompt }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
  }): Action<P, [...A, T]>;
  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, min, max }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    min?: number | ((...arg: A) => number);
    max?: number | ((...arg: A) => number);
  }): Action<P, [...A, [T]]>;
  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, min, max }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    min?: number | ((...arg: A) => number);
    max?: number | ((...arg: A) => number);
  }): Action<P, [...A, T | [T]]> {
    this.selections.push(new Selection<P>({ prompt, selectOnBoard: { chooseFrom: choices, min, max } }));
    if (min !== undefined || max !== undefined) {
      return this as unknown as Action<P, [...A, [T]]>;
    }
    return this as unknown as Action<P, [...A, T]>;
  }

  move<E extends Piece<P>, I extends GameElement<P>>({ piece, into, prompt }: {
    piece: BoardQuerySingle<P, E>,
    into: BoardQuerySingle<P, I>,
    prompt?: string
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
    const numberOfPriorSelections = this.selections.length;
    if (choosePiece) {
      this.selections.push(new Selection<P>({ prompt, selectOnBoard: { chooseFrom: choosePiece } }));
    }
    if (chooseInto) {
      this.selections.push(new Selection<P>({ prompt: promptInto || prompt, selectOnBoard: { chooseFrom: chooseInto } }));
    }
    if (!choosePiece && !chooseInto) {
      this.moves.push(() => (resolve(piece))!.putInto(resolve(into)!));
    }
    if (choosePiece && !chooseInto) {
      this.moves.push((...args: Argument<P>[]) => (args[numberOfPriorSelections] as E)!.putInto(resolve(into)!));
    }
    if (!choosePiece && chooseInto) {
      this.moves.push((...args: Argument<P>[]) => resolve(piece)!.putInto(args[numberOfPriorSelections] as I));
    }
    if (choosePiece && chooseInto) {
      this.moves.push((...args: Argument<P>[]) => (args[numberOfPriorSelections] as E)!.putInto(args[numberOfPriorSelections + 1] as I));
    }
    return this;
  }
}

const resolve = <P extends Player, T extends GameElement<P>>(q: BoardQuerySingle<P, T>, ...args: Argument<P>[]) => {
  if (typeof q === 'string') throw Error("not impl");
  return (typeof q === 'function') ? q(...args) : q;
}
