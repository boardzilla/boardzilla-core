import { range } from '../utils.js';
import { combinations } from './utils.js';
import { GameElement } from '../board/index.js';

import type { SingleArgument, Argument } from './action.js';
import type { Player } from '../player/index.js';

export type BoardQuerySingle<P extends Player, T extends GameElement<P>, A extends Record<string, Argument<P>> = Record<string, Argument<P>>> = string | T | undefined | ((args: A) => T | undefined)
export type BoardQueryMulti<P extends Player, T extends GameElement<P>, A extends Record<string, Argument<P>> = Record<string, Argument<P>>> = string | T[] | ((args: A) => T[])
export type BoardQuery<P extends Player, T extends GameElement<P>, A extends Record<string, Argument<P>> = Record<string, Argument<P>>> = BoardQuerySingle<P, T, A> | BoardQueryMulti<P, T, A>

export type BoardSelection<P extends Player, T extends GameElement<P>, A extends Record<string, Argument<P>> = Record<string, Argument<P>>> = {
  chooseFrom: BoardQueryMulti<P, T, A>;
  min?: number | ((args: A) => number);
  max?: number | ((args: A) => number);
  number?: number | ((args: A) => number);
}

export type ChoiceSelection<P extends Player, A extends Record<string, Argument<P>> = Record<string, Argument<P>>> = {
  choices: SingleArgument<P>[] | Record<string, SingleArgument<P>> | ((args: A) => SingleArgument<P>[] | Record<string, SingleArgument<P>>);
  initial?: Argument<P> | ((args: A) => Argument<P>);
  // min?: number | ((args: A) => number);
  // max?: number | ((args: A) => number);
  // number?: number | ((args: A) => number);
}

export type NumberSelection<P extends Player, A extends Record<string, Argument<P>> = Record<string, Argument<P>>> = {
  min?: number | ((args: A) => number);
  max?: number | ((args: A) => number);
  initial?: number | ((args: A) => number);
}

export type TextSelection<P extends Player, A extends Record<string, Argument<P>> = Record<string, Argument<P>>> = {
  regexp?: RegExp;
  initial?: string | ((args: A) => string);
}

export type ButtonSelection<P extends Player> = Argument<P>;

export type SelectionDefinition<P extends Player, A extends Record<string, Argument<P>> = Record<string, Argument<P>>> = {
  prompt?: string | ((args: A) => string);
  confirm?: string | ((args: A) => string);
  validation?: ((args: A) => string | boolean | undefined);
  clientContext?: Record<any, any>; // additional meta info that describes the context for this selection
} & ({
  skipIfOnlyOne?: boolean;
  skipIf?: boolean | ((args: A) => boolean);
  expand?: boolean;
  selectOnBoard: BoardSelection<P, GameElement<P>>;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText?: never;
  value?: never;
} | {
  skipIfOnlyOne?: boolean;
  skipIf?: boolean | ((args: A) => boolean);
  expand?: boolean;
  selectOnBoard?: never;
  selectFromChoices: ChoiceSelection<P>;
  selectNumber?: never;
  enterText?: never;
  value?: never;
} | {
  skipIfOnlyOne?: boolean;
  skipIf?: boolean | ((args: A) => boolean);
  expand?: boolean;
  selectOnBoard?: never;
  selectFromChoices?: never;
  selectNumber: NumberSelection<P>;
  enterText?: never;
  value?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText: TextSelection<P>;
  value?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText?: never;
  value: ButtonSelection<P>;
});

// any lambdas have been resolved to actual values
export type ResolvedSelection<P extends Player> = Omit<Selection<P>, 'prompt' | 'choices' | 'boardChoices' | 'min' | 'max' | 'initial' | 'regexp'> & {
  prompt?: string;
  choices?: SingleArgument<P>[] | Record<string, SingleArgument<P>>;
  boardChoices?: GameElement<P>[];
  min?: number;
  max?: number;
  initial?: Argument<P>;
  regexp?: RegExp;
}

/**
 * Selection objects represent player choices. They either specify the options
 * or provide enough information for the client to contextually show options to
 * players at runtime
 * @internal
 */
export default class Selection<P extends Player> {
  type: 'board' | 'choices' | 'text' | 'number' | 'button';
  name: string;
  prompt?: string | ((args: Record<string, Argument<P>>) => string);
  confirm?: string | ((args: Record<string, Argument<P>>) => string);
  validation?: ((args: Record<string, Argument<P>>) => string | boolean | undefined);
  clientContext: Record<any, any> = {}; // additional meta info that describes the context for this selection
  skipIfOnlyOne: boolean = true;
  skipIf?: boolean | ((args: Record<string, Argument<P>>) => boolean);
  expand: boolean = false;
  choices?: SingleArgument<P>[] | Record<string, SingleArgument<P>> | ((args: Record<string, Argument<P>>) => SingleArgument<P>[] | Record<string, SingleArgument<P>>);
  boardChoices?: BoardQueryMulti<P, GameElement<P>>;
  min?: number | ((args: Record<string, Argument<P>>) => number);
  max?: number | ((args: Record<string, Argument<P>>) => number);
  initial?: Argument<P> | ((args: Record<string, Argument<P>>) => Argument<P>);
  regexp?: RegExp;
  value?: Argument<P>;

  constructor(name: string, s: SelectionDefinition<P> | Selection<P>) {
    this.name = name;
    if (s instanceof Selection) {
      this.type = s.type;
      this.choices = s.choices;
      this.boardChoices = s.boardChoices;
      this.min = s.min;
      this.max = s.max;
      this.initial = s.initial;
      this.regexp = s.regexp;
      this.value = s.value;
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
      } else if (s.selectNumber) {
        this.type = 'number';
        this.min = s.selectNumber.min;
        this.max = s.selectNumber.max;
        this.initial = s.selectNumber.initial ?? s.selectNumber.min ?? 1;
      } else if (s.enterText) {
        this.type = 'text';
        this.regexp = s.enterText.regexp;
        this.initial = s.enterText.initial;
      } else {
        this.type = 'button';
        this.value = s.value;
        this.skipIfOnlyOne ??= true;
      }
    }
    this.prompt = s.prompt;
    this.confirm = s.confirm;
    this.validation = s.validation;
    if ('skipIfOnlyOne' in s) this.skipIfOnlyOne = s.skipIfOnlyOne ?? true;
    if ('skipIf' in s) this.skipIf = s.skipIf;
    if ('expand' in s) this.expand = s.expand ?? false;
    this.clientContext = s.clientContext ?? {};
  }

  /**
   * check specific selection with a given arg. evaluates within the context of
   * previous args, so any selection elements that have previous-arg-function
   * forms are here evaluated with the previous args. returns new selection and
   * error if any
   */
  validate(args: Record<string, Argument<P>>): string | undefined {
    const arg = args[this.name];
    const s = this.resolve(args);
    if (s.skipIf === true) return;

    if (s.validation) {
      const error = s.validation(args);
      if (error !== undefined && error !== true) return error || 'Invalid selection';
    }

    if (s.type === 'choices' && s.choices) {
      if (arg instanceof Array) return "multi-choice stil unsupported";
      return (
        s.choices instanceof Array ? s.choices : Object.keys(s.choices) as SingleArgument<P>[]
      ).includes(arg) ? undefined : "Not a valid choice";
    }

    if (s.type === 'board' && s.boardChoices) {
      const results = s.boardChoices;
      if (!results) console.warn('Attempted to validate an impossible move', s);
      if (this.isMulti()) {
        if (!(arg instanceof Array)) throw Error("Required multi select");
        if (results && arg.some(a => !results.includes(a as GameElement<P>))) return "Selected elements are not valid";
        if (s.min !== undefined && arg.length < s.min) return "Below minimum";
        if (s.max !== undefined && arg.length > s.max) return "Above maximum";
      } else {
        return (results && results.includes(arg as GameElement<P>)) ? undefined : "Selected element is not valid";
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
  options(this: ResolvedSelection<P>): Argument<P>[] {
    if (this.isUnbounded()) return [];
    if (this.type === 'number') return range(this.min ?? 1, this.max!);
    const choices = this.choices && (this.choices instanceof Array ? this.choices : Object.keys(this.choices));
    if (this.isMulti()) return combinations(this.boardChoices || choices || [], this.min ?? 1, this.max ?? Infinity);
    if (this.boardChoices) return this.boardChoices;
    if (this.choices) return this.choices instanceof Array ? this.choices : Object.keys(this.choices);
    return [];
  }

  isUnbounded(this: ResolvedSelection<P>): boolean {
    if (this.type === 'number') return this.max === undefined || this.max - (this.min ?? 1) > 100;
    return this.type === 'text' || this.type === 'button';
  }

  isResolved(): this is ResolvedSelection<P> {
    return typeof this.prompt !== 'function' &&
      typeof this.min !== 'function' &&
      typeof this.max !== 'function' &&
      typeof this.initial !== 'function' &&
      typeof this.skipIf !== 'function' &&
      typeof this.choices !== 'function' &&
      typeof this.boardChoices !== 'function' &&
      !(this.boardChoices instanceof GameElement);
  }

  isMulti() {
    return this.min !== undefined || this.max !== undefined;
  }

  resolve(args: Record<string, Argument<P>>): ResolvedSelection<P> {
    if (this.isResolved()) return this;
    const resolved = new Selection(this.name, this);
    if (typeof this.prompt === 'function') resolved.prompt = this.prompt(args);
    if (typeof this.min === 'function') resolved.min = this.min(args)
    if (typeof this.max === 'function') resolved.max = this.max(args)
    if (typeof this.initial === 'function') resolved.initial = this.initial(args)
    if (typeof this.skipIf === 'function') resolved.skipIf = this.skipIf(args)
    if (typeof this.choices === 'function') resolved.choices = this.choices(args)
    if (typeof this.boardChoices === 'string') throw Error("not impl");
    if (typeof this.boardChoices === 'function') resolved.boardChoices = this.boardChoices(args);
    if (resolved.boardChoices instanceof GameElement) {
      resolved.boardChoices = [resolved.boardChoices];
      resolved.skipIfOnlyOne = true;
    }
    return resolved as ResolvedSelection<P>;
  }

  isPossible(this: ResolvedSelection<P>): boolean {
    if (this.type === 'choices' && this.choices) return (
      this.choices instanceof Array ? this.choices : Object.keys(this.choices) as Argument<P>[]
    ).length > 0

    const isInBounds = this.max !== undefined ? (this.min ?? 1) <= this.max : true;
    if (this.type === 'board' && this.boardChoices) return isInBounds && this.boardChoices.length >= (this.min ?? 1);
    if (this.type === 'number') return isInBounds;

    return true;
  }

  isForced(this: ResolvedSelection<P>): Argument<P> | undefined {
    if (this.skipIfOnlyOne !== true) return;
    if (this.type === 'button') {
      return this.value;
    } else if (this.boardChoices?.length === 1 && !this.isMulti()) {
      return this.boardChoices[0];
    } else if (this.boardChoices &&
      this.boardChoices.length === this.min &&
      this.min === this.max) {
      return this.boardChoices;
    } else if (this.type === 'number' &&
      this.min !== undefined &&
      this.min === this.max) {
      return this.min;
    } else if (this.type === 'choices' && this.choices) {
      const choices = this.choices instanceof Array ? this.choices : Object.keys(this.choices);
      if (choices.length === 1) return choices[0];
    }
  }

  overrideOptions(options: SingleArgument<P>[]): ResolvedSelection<P> {
    if (this.type === 'board') {
      this.boardChoices = options as GameElement<P>[];
      return this as ResolvedSelection<P>;
    }
    return new Selection(this.name, {
      selectFromChoices: {
        choices: options,
        //min: selection.min, TODO
        //max: selection.max
      }
    }) as ResolvedSelection<P>;
  }
}
