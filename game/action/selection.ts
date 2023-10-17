import { range } from '../utils';

import type { ResolvedSelection, BoardQueryMulti } from '../action/types';
import type { Argument, SelectionDefinition } from './types';
import type { GameElement } from '../board/';
import type { Player } from '../player/';

export default class Selection<P extends Player> {
  type: 'board' | 'choices' | 'text' | 'number' | 'button'
  prompt?: string | ((...a: Argument<P>[]) => string);
  clientContext?: Record<any, any>; // additional meta info that describes the context for this selection
  skipIfOnlyOne: boolean = true;
  skipIf?: boolean | ((...a: Argument<P>[]) => boolean);
  expand: boolean = false;
  choices?: Argument<P>[] | Record<string, Argument<P>> | ((...a: Argument<P>[]) => Argument<P>[] | Record<string, Argument<P>>);
  boardChoices?: BoardQueryMulti<P, GameElement<P>>;
  min?: number | ((...a: Argument<P>[]) => number);
  max?: number | ((...a: Argument<P>[]) => number);
  initial?: Argument<P> | ((...a: Argument<P>[]) => Argument<P>);
  regexp?: RegExp;
  value?: Argument<P>;

  constructor(s: SelectionDefinition<P> | Selection<P>) {
    if (s instanceof Selection) {
      // copy everything that's not a function
      this.type = s.type;
      this.skipIfOnlyOne = s.skipIfOnlyOne;
      this.expand = s.expand;
      this.choices = s.choices;
      this.boardChoices = s.boardChoices;
      this.min = s.min;
      this.max = s.max;
      this.initial = s.initial;
      this.regexp = s.regexp;
      this.value = s.value;
      this.clientContext = s.clientContext;
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
        this.initial = s.selectNumber.min === undefined ? s.selectNumber.initial : s.selectNumber.min;
      } else if (s.enterText) {
        this.type = 'text';
        this.regexp = s.enterText.regexp;
        this.initial = s.enterText.initial;
      } else {
        this.type = 'button';
        this.value = s.value;
        this.skipIfOnlyOne = false;
      }
    }
    this.prompt = s.prompt;
    if ('skipIfOnlyOne' in s) this.skipIfOnlyOne = s.skipIfOnlyOne ?? true;
    if ('skipIf' in s) this.skipIf = s.skipIf;
    if ('expand' in s) this.expand = s.expand ?? false;
    this.clientContext = s.clientContext;
  }

  /**
   * check specific selection with a given arg. evaluates within the context of
   * previous args, so any selection elements that have previous-arg-function
   * forms are here evaluated with the previous args. returns new selection and
   * error if any
   */
  validate(arg: Argument<P>, previousArgs: Argument<P>[]): string | undefined {
    const s = this.resolve(...previousArgs);
    if (s.skipIf === true) return;

    if (s.type === 'choices' && s.choices) {
      return (
        s.choices instanceof Array ? s.choices : Object.keys(s.choices) as Argument<P>[]
      ).includes(arg) ? undefined : "Not a valid choice";
    }

    if (s.type === 'board' && s.boardChoices) {
      const results = s.boardChoices;
      if (!results) console.warn('Attempted to validate an impossible move', s);
      if (s.min !== undefined || s.max !== undefined) {
        if (!(arg instanceof Array)) throw Error("Required multi select");
        if (results && arg.some(a => !results.includes(a as GameElement<P>))) return "Selected elements are not valid";
        if (s.min !== undefined && arg.length < s.min) return "Below minimum";
        if (s.max !== undefined && arg.length > s.max) return "Above maximum";
      } else {
        return (results && results.includes(arg as GameElement<P>)) ? undefined : "Selected element is not valid";
      }
    }

    if (s.type === 'text') {
      return (typeof arg === 'string' && (!s.regexp || arg.match(s.regexp))) ? undefined : "Not a string";
    }

    if (s.type === 'number') {
      if (typeof arg !== 'number') return "Not a number";
      if (s.min !== undefined && arg < s.min) return "Below minimum";
      if (s.max !== undefined && arg > s.max) return "Above maximum";
      return undefined;
    }

    return undefined;
  }

  // have to make some assumptions here to tree shake possible moves
  options(this: ResolvedSelection<P>): Argument<P>[] {
    if (this.isUnbounded()) return [];
    if (this.type === 'number') return range(this.min ?? 1, this.max!);
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
      typeof this.boardChoices !== 'function';
  }

  resolve(...args: Argument<P>[]): ResolvedSelection<P> {
    if (this.isResolved()) return this;
    const resolved = new Selection(this);
    if (typeof this.prompt === 'function') resolved.prompt = this.prompt(...args);
    if (typeof this.min === 'function') resolved.min = this.min(...args)
    if (typeof this.max === 'function') resolved.max = this.max(...args)
    if (typeof this.initial === 'function') resolved.initial = this.initial(...args)
    if (typeof this.skipIf === 'function') resolved.skipIf = this.skipIf(...args)
    if (typeof this.choices === 'function') resolved.choices = this.choices(...args)
    if (typeof this.boardChoices === 'string') throw Error("not impl");
    if (typeof this.boardChoices === 'function') resolved.boardChoices = this.boardChoices(...args)
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
    if (this.boardChoices?.length === 1 &&
      this.min === undefined &&
      this.max === undefined) {
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

  overrideOptions(options: Argument<P>[]): ResolvedSelection<P> {
    if (this.type === 'board') {
      this.boardChoices = options as GameElement<P>[];
      return this as ResolvedSelection<P>;
    }
    return new Selection({
      selectFromChoices: {
        choices: options,
        //min: selection.min, TODO
        //max: selection.max
      }
    }) as ResolvedSelection<P>;
  }
}
