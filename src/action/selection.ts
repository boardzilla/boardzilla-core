import { range } from '../utils.js';
import { combinations } from './utils.js';
import GameElement from '../board/element.js';
import Player from '../player/player.js';

import type { SingleArgument, Argument } from './action.js';

export type BoardQuerySingle<T extends GameElement, A extends Record<string, Argument> = Record<string, Argument>> = T | undefined | ((args: A) => T | undefined)
export type BoardQueryMulti<T extends GameElement, A extends Record<string, Argument> = Record<string, Argument>> = T[] | ((args: A) => T[])
export type BoardQuery<T extends GameElement, A extends Record<string, Argument> = Record<string, Argument>> = BoardQuerySingle<T, A> | BoardQueryMulti<T, A>

export type BoardSelection<T extends GameElement, A extends Record<string, Argument> = Record<string, Argument>> = {
  chooseFrom: BoardQueryMulti<T, A>;
  min?: number | ((args: A) => number);
  max?: number | ((args: A) => number);
  number?: number | ((args: A) => number);
  initial?: T[] | ((args: A) => T[]);
}

export type ChoiceSelection<A extends Record<string, Argument> = Record<string, Argument>> = {
  choices: SingleArgument[] | { label: string, choice: SingleArgument }[] | ((args: A) => SingleArgument[] | { label: string, choice: SingleArgument }[]);
  initial?: Argument | ((args: A) => Argument);
  // min?: number | ((args: A) => number);
  // max?: number | ((args: A) => number);
  // number?: number | ((args: A) => number);
}

export type NumberSelection<A extends Record<string, Argument> = Record<string, Argument>> = {
  min?: number | ((args: A) => number);
  max?: number | ((args: A) => number);
  initial?: number | ((args: A) => number);
}

export type TextSelection<A extends Record<string, Argument> = Record<string, Argument>> = {
  regexp?: RegExp;
  initial?: string | ((args: A) => string);
}

export type ButtonSelection = Argument;

export type SelectionDefinition<A extends Record<string, Argument> = Record<string, Argument>> = {
  prompt?: string | ((args: A) => string);
  confirm?: string | [string, Record<string, Argument> | ((args: A) => Record<string, Argument>) | undefined]
  validation?: ((args: A) => string | boolean | undefined);
  clientContext?: Record<any, any>; // additional meta info that describes the context for this selection
} & ({
  skipIf?: 'never' | 'always' | 'only-one' | ((args: A) => boolean);
  selectOnBoard: BoardSelection<GameElement>;
  selectPlaceOnBoard?: never;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText?: never;
  value?: never;
} | {
  skipIf?: 'never' | 'always' | 'only-one' | ((args: A) => boolean);
  selectOnBoard?: never;
  selectPlaceOnBoard?: never;
  selectFromChoices: ChoiceSelection;
  selectNumber?: never;
  enterText?: never;
  value?: never;
} | {
  skipIf?: 'never' | 'always' | 'only-one' | ((args: A) => boolean);
  selectOnBoard?: never;
  selectPlaceOnBoard?: never;
  selectFromChoices?: never;
  selectNumber: NumberSelection;
  enterText?: never;
  value?: never;
} | {
  selectOnBoard?: never;
  selectPlaceOnBoard?: never;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText: TextSelection;
  value?: never;
} | {
  selectOnBoard?: never;
  selectPlaceOnBoard?: never;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText?: never;
  value: ButtonSelection;
} | {
  selectOnBoard?: never;
  selectPlaceOnBoard: {piece: string, rotationChoices?: number[]};
  selectFromChoices?: never;
  selectNumber?: never;
  enterText?: never;
  value?: never;
});

// any lambdas have been resolved to actual values
export type ResolvedSelection = Omit<Selection, 'prompt' | 'min' | 'max' | 'initial' | 'skipIf'> & {
  prompt?: string;
  resolvedChoices?: { label?: string, choice: SingleArgument, error?: string }[]; // selection.choices or selection.boardChoices resolve to this array
  min?: number;
  max?: number;
  initial?: Argument;
  skipIf?: 'never' | 'always' | 'only-one' | boolean;
}

/**
 * Selection objects represent player choices. They either specify the options
 * or provide enough information for the client to contextually show options to
 * players at runtime
 * @internal
 */
export default class Selection {
  type: 'board' | 'choices' | 'text' | 'number' | 'button' | 'place';
  name: string;
  prompt?: string | ((args: Record<string, Argument>) => string);
  confirm?: [string, Record<string, Argument> | ((args: Record<string, Argument>) => Record<string, Argument>) | undefined]
  validation?: ((args: Record<string, Argument>) => string | boolean | undefined);
  clientContext: Record<any, any> = {}; // additional meta info that describes the context for this selection
  skipIf?: 'never' | 'always' | 'only-one' | ((args: Record<string, Argument>) => boolean);
  choices?: SingleArgument[] | { label: string, choice: SingleArgument }[] | ((args: Record<string, Argument>) => SingleArgument[] | { label: string, choice: SingleArgument }[]);
  boardChoices?: BoardQueryMulti<GameElement>
  min?: number | ((args: Record<string, Argument>) => number);
  max?: number | ((args: Record<string, Argument>) => number);
  initial?: Argument | ((args: Record<string, Argument>) => Argument);
  regexp?: RegExp;
  placePiece?: string;
  rotationChoices?: number[];
  value?: Argument;

  constructor(name: string, s: SelectionDefinition | Selection) {
    this.name = name;
    if (s instanceof Selection) {
      Object.assign(this, s);
    } else {
      if (s.selectFromChoices) {
        this.type = 'choices';
        this.choices = s.selectFromChoices.choices;
        //this.min = s.selectFromChoices.min;
        //this.max = s.selectFromChoices.max;
        this.initial = s.selectFromChoices.initial;
      } else if (s.selectOnBoard) {
        this.type = 'board';
        this.boardChoices = s.selectOnBoard.chooseFrom;
        if (s.selectOnBoard.number !== undefined) {
          this.min = s.selectOnBoard.number;
          this.max = s.selectOnBoard.number;
        }
        this.min ??= s.selectOnBoard.min;
        this.max ??= s.selectOnBoard.max;
        this.initial ??= s.selectOnBoard.initial;
      } else if (s.selectNumber) {
        this.type = 'number';
        this.min = s.selectNumber.min;
        this.max = s.selectNumber.max;
        this.initial = s.selectNumber.initial ?? s.selectNumber.min ?? 1;
      } else if (s.enterText) {
        this.type = 'text';
        this.regexp = s.enterText.regexp;
        this.initial = s.enterText.initial;
      } else if (s.selectPlaceOnBoard) {
        this.type = 'place';
        this.placePiece = s.selectPlaceOnBoard.piece;
        this.rotationChoices = s.selectPlaceOnBoard.rotationChoices;
      } else {
        this.type = 'button';
        this.value = s.value;
        this.skipIf ??= 'only-one';
      }
    }
    this.prompt = s.prompt;
    this.confirm = typeof s.confirm === 'string' ? [s.confirm, undefined] : s.confirm;
    this.validation = s.validation;
    this.skipIf = ('skipIf' in s && s.skipIf) || 'only-one';
    this.clientContext = s.clientContext ?? {};
  }

  /**
   * check specific selection with a given arg. evaluates within the context of
   * previous args, so any selection elements that have previous-arg-function
   * forms are here evaluated with the previous args. returns new selection and
   * error if any
   */
  error(args: Record<string, Argument>): string | undefined {
    const arg = args[this.name];
    const s = this.resolve(args);

    if (s.validation) {
      const error = s.validation(args);
      if (error !== undefined && error !== true) return error || 'Invalid selection';
    }

    if (s.type === 'choices' && s.resolvedChoices) {
      if (arg instanceof Array) return "multi-choice stil unsupported"; // TODO
      return s.resolvedChoices.find(c => c.choice === arg) ? undefined : "Not a valid choice";
    }

    if (s.type === 'board' && s.resolvedChoices) {
      const results = s.resolvedChoices.map(c => c.choice);
      if (!results) console.warn('Attempted to validate an impossible move', s);
      if (this.isMulti()) {
        if (!(arg instanceof Array)) throw Error("Required multi select");
        if (results && arg.some(a => !results.includes(a as GameElement))) return "Selected elements are not valid";
        if (s.min !== undefined && arg.length < s.min) return "Below minimum";
        if (s.max !== undefined && arg.length > s.max) return "Above maximum";
      } else {
        return (results && results.includes(arg as GameElement)) ? undefined : "Selected element is not valid";
      }
    }

    if (s.type === 'text') {
      return (typeof arg === 'string' && (!s.regexp || arg.match(s.regexp))) ? undefined : "Invalid text entered";
    }

    if (s.type === 'number') {
      if (typeof arg !== 'number') return "Not a number";
      if (s.min !== undefined && arg < s.min) return "Below minimum";
      if (s.max !== undefined && arg > s.max) return "Above maximum";
      return undefined;
    }

    return undefined;
  }

  // All possible valid Arguments to this selection. Have to make some assumptions here to tree shake possible moves
  // Argument to handle array of combo selections arrays
  options(this: ResolvedSelection): {choice: Argument, error?: string, label?: string}[] {
    if (this.isUnbounded()) return [];
    if (this.type === 'number') return range(this.min ?? 1, this.max!).map(choice => ({ choice }));
    if (this.isMulti() && this.resolvedChoices) {
      return combinations(this.resolvedChoices.map(c => c.choice), this.min ?? 1, this.max ?? Infinity).map(choice => ({ choice }));
    }
    if (this.resolvedChoices) return this.resolvedChoices;
    return [];
  }

  isUnbounded(this: ResolvedSelection): boolean {
    if (this.type === 'number') return this.max === undefined || this.max - (this.min ?? 1) > 100;
    return this.type === 'text' || this.type === 'button' || this.type === 'place';
  }

  isResolved(): this is ResolvedSelection {
    return typeof this.prompt !== 'function' &&
      typeof this.min !== 'function' &&
      typeof this.max !== 'function' &&
      typeof this.initial !== 'function' &&
      typeof this.skipIf !== 'function' &&
      typeof this.choices !== 'function' &&
      typeof this.boardChoices !== 'function' &&
      (!this.choices && !this.boardChoices || 'resolvedChoices' in this);
  }

  isMulti() {
    return (this.type === 'choices' || this.type === 'board') && (this.min !== undefined || this.max !== undefined);
  }

  isBoardChoice() {
    return this.type === 'board' || this.type ==='place';
  }

  resolve(args: Record<string, Argument>): ResolvedSelection {
    const resolved = new Selection(this.name, this) as ResolvedSelection;
    if (this.choices) {
      const choices = typeof this.choices === 'function' ? this.choices(args) : this.choices;
      if (choices instanceof Array && typeof choices[0] === 'object' && !(choices[0] instanceof GameElement) && !(choices[0] instanceof Player)) {
        resolved.resolvedChoices = choices as { label: string, choice: SingleArgument }[];
      } else {
        resolved.resolvedChoices = (choices as SingleArgument[]).map(choice => ({ choice }));
      }
    }
    if (typeof this.prompt === 'function') resolved.prompt = this.prompt(args);
    if (typeof this.min === 'function') resolved.min = this.min(args)
    if (typeof this.max === 'function') resolved.max = this.max(args)
    if (typeof this.initial === 'function') resolved.initial = this.initial(args)
    if (typeof this.skipIf === 'function') resolved.skipIf = this.skipIf(args)
    if (this.boardChoices) {
      const choices = typeof this.boardChoices === 'function' ? this.boardChoices(args) : this.boardChoices;
      resolved.resolvedChoices = choices.map(choice => ({ choice }));
    }
    return resolved;
  }

  isPossible(this: ResolvedSelection): boolean {
    if (this.type === 'choices' && this.resolvedChoices) return this.resolvedChoices.length > 0

    const isInBounds = this.max !== undefined ? (this.min ?? 1) <= this.max : true;
    if (this.type === 'board' && this.resolvedChoices) return isInBounds && this.resolvedChoices.length >= (this.min ?? 1);
    if (this.type === 'number') return isInBounds;

    return true;
  }

  isForced(this: ResolvedSelection): Argument | undefined {
    if (this.skipIf === 'never') return;
    if (this.type === 'button') {
      return this.value;
    } else if (this.type === 'board') {
      if (this.resolvedChoices && (this.skipIf === true || this.resolvedChoices?.length === 1) && !this.isMulti()) {
        return this.resolvedChoices[0].choice;
      } else if (this.resolvedChoices && this.isMulti() && (this.skipIf === true || (this.resolvedChoices.length === (this.min ?? 1)) || this.max === 0)) {
        return this.resolvedChoices.slice(0, this.min).map(c => c.choice);
      }
    } else if (this.type === 'number' && this.min !== undefined && this.min === this.max) {
      return this.min;
    } else if (this.type === 'choices' && this.resolvedChoices) {
      if (this.resolvedChoices.length === 1 || this.skipIf === true) return this.resolvedChoices[0].choice
    }
  }

  toString(): string {
    if (!this.isResolved()) return `unresolved selection ${this.type}`;
    return `${this.type === 'board' ? `click ${this.resolvedChoices![0]?.choice.constructor.name || 'board element'}` : `pick ${this.type}`}${(this.choices || this.boardChoices) ? ` (${(this.choices || this.boardChoices)!.length} choices)` : ''}`;
  }
}
