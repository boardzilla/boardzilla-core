import Selection from './selection';

import type {
  Argument,
  ResolvedSelection,
  BoardQueryMulti,
  BoardQuerySingle,
  MoveTree,
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
    return typeof this.condition === 'function' ? this.condition() : this.condition ?? true;
    // const selections = this.selections;
    // if (selections.length === 0) return true;

    // // easy shortcircuit if any selection is already resolved to an impossibility
    // if (selections.some(s => s.isResolved() && !s.isPossible())) return false;
    // const selection = selections[0].resolve();
    // if (selection.isUnbounded()) return true;
    // return selections[0].resolve().options().some(o => this.nextSelection(o));
  }

  // given a set of args, return sub-selections possible trying each possible next arg
  // return true if no more selections required, false if these args are impossible
  getMoveTree(...args: Argument<P>[]): MoveTree<P> | boolean {
    const selection = this.nextSelection(...args);
    if (!selection) return true;

    const tree: MoveTree<P> = {
      move: {
        action: this.name!,
        args,
        selection
      },
      submoves: []
    }

    if (!selection.isPossible()) return false;
    if (selection.isUnbounded()) return tree;

    let possibleOptions: Argument<P>[] = [];
    let pruned = false;
    for (const option of selection.options()) {
      const tree = this.getMoveTree(...args, option);
      if (tree === true) {
        possibleOptions.push(option);
      } else if (tree === false) {
        pruned = true;
      } else {
        tree.submoves.push(tree);
      }
    }
    if (!possibleOptions.length) return false;
    if (pruned) selection.overrideOptions(possibleOptions);
    return tree;
  }

  /**
   * given a partial arg list, returns a selection object for continuation if one exists.
   */
  nextSelection(...args: Argument<P>[]): ResolvedSelection<P> | undefined {
    return this.selections[args.length]?.resolve(...args);

    // if (selection.isUnbounded()) return selection;
    // if (!selection.isPossible()) return false;
    // const lastUnresolved = [...selections].reverse().find(s => !s.isResolved());
    // if (!lastUnresolved) return selection;
    // const depth = selections.indexOf(lastUnresolved);
    // if (depth <= 0) return selection;

    // const options = selection.options();
    // const viableOptions = options.filter(o => this.nextSelection(...args, o));
    // if (viableOptions.length < (selection.min ?? 1)) return false;
    // if (viableOptions.length === options.length) return selection;
    // return selection.overrideOptions(viableOptions);
  }

  // validate args and truncate if invalid, append any add'l args that are
  // forced and return next selection. return error if args fail validation. no
  // selection and no error means args are validated and processable
  // forceArgs(...argList: Argument<P>[]): [ResolvedSelection<P>?, Argument<P>[]?, string?] {
  //   let error: string | undefined = undefined;
  //   let args = [...argList];
  //   let prompt = this.prompt;

  //   // truncate invalid args
  //   for (let i = 0; i !== this.selections.length && i !== args.length; i++) {
  //     if (this.selections[i].validate(args[i], args.slice(0, i) as Argument<P>[])) {
  //       args = args.slice(0, i) as A;
  //       break;
  //     }
  //   }

  //   // check next selection for viable options. append any forced args
  //   let forcedArg: Argument<P> | undefined = undefined;
  //   let nextSelection: ResolvedSelection<P> | undefined = undefined;
  //   let selection = this.nextSelection(...args);
  //   do {
  //     forcedArg = undefined;
  //     if (selection === false) return [undefined, [] as unknown as A, error || "Action invalid. How did you get here?"];
  //     if (selection === true) {
  //       if (args.length) return [undefined, args, error]; // valid and processable
  //       // otherwise add a minimal confirmation step for a valid action with no args
  //       selection = new Selection<P>({ prompt, click: true }).resolve(...args);
  //     }
  //     forcedArg = selection.isForced();
  //     // carry the prompt forward if no more specific prompt provided
  //     if (!selection.prompt) {
  //       selection.prompt = prompt;
  //     } else {
  //       prompt = (selection as ResolvedSelection<P>).prompt!;
  //     }
  //     if (forcedArg !== undefined) {
  //       if (forcedArg) args.push(forcedArg);
  //       selection = this.nextSelection(...args);
  //       // no more selections required as last selection is forced, but if no args were entered, turn this selection into a minimal confirmation
  //       if (selection === true && argList.length === 0) {
  //         nextSelection = new Selection<P>({ prompt, click: forcedArg }).resolve(...args);
  //         forcedArg = undefined;
  //       }
  //     } else {
  //       nextSelection = selection;
  //     }
  //   } while (forcedArg);
  //   return [nextSelection, args, error];
  // }

  process(...args: Argument<P>[]): [ResolvedSelection<P>?, Argument<P>[]?, string?] {
    // const [resolvedSelection, forcedArgs, error] = this.forceArgs(...args);
    // if (resolvedSelection) return [resolvedSelection, forcedArgs, error];
    // if (forcedArgs) args = forcedArgs;

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

  chooseFrom<T extends Argument<P>>({ choices, prompt, initial, skipIfOnlyOne, expand }: {
    choices: T[] | Record<string, T> | ((...arg: A) => T[] | Record<string, T>),
    initial?: T | ((...arg: A) => Argument<P>),
    prompt?: string | ((...arg: A) => string)
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, T]> {
    this.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, expand, selectFromChoices: { choices, initial } }));
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

  chooseNumber({ min, max, prompt, initial, skipIfOnlyOne, expand }: {
    min?: number | ((...arg: A) => number),
    max?: number | ((...arg: A) => number),
    prompt?: string | ((...arg: A) => string),
    initial?: number | ((...arg: A) => number),
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, number]> {
    this.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, expand, selectNumber: { min, max, initial } }));
    return this as unknown as Action<P, [...A, number]>;
  }

  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, skipIfOnlyOne, expand }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, T]>;
  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, min, max, skipIfOnlyOne, expand }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    min?: number | ((...arg: A) => number);
    max?: number | ((...arg: A) => number);
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, [T]]>;
  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, min, max, skipIfOnlyOne, expand }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    min?: number | ((...arg: A) => number);
    max?: number | ((...arg: A) => number);
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, T | [T]]> {
    this.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, expand, selectOnBoard: { chooseFrom: choices, min, max } }));
    if (min !== undefined || max !== undefined) {
      return this as unknown as Action<P, [...A, [T]]>;
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
