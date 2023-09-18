import { range } from '../utils';

import type { ResolvedSelection, BoardQueryMulti } from '../action/types';
import type { Argument, SelectionDefinition } from './types';
import type { GameElement } from '../board/';

export default class Selection {
  type: 'board' | 'choices' | 'text' | 'number' | 'button'
  prompt?: string | ((...a: Argument[]) => string);
  clientContext?: Record<any, any>; // additional meta info that describes the context for this selection
  choices: Argument[] | Record<string, Argument> | ((...a: Argument[]) => Argument[] | Record<string, Argument>);
  boardChoices: BoardQueryMulti<GameElement>;
  min?: number | ((...a: Argument[]) => number);
  max?: number | ((...a: Argument[]) => number);
  regexp?: RegExp;

  constructor(s: SelectionDefinition | Selection) {
    if (s instanceof Selection) {
      this.type = s.type;
      this.choices = s.choices;
      this.boardChoices = s.boardChoices;
      this.min = s.min;
      this.max = s.max;
      this.regexp = s.regexp;
    } else {
      if (s.selectFromChoices) {
        this.type = 'choices';
        this.choices = s.selectFromChoices.choices;
        //this.min = s.selectFromChoices.min;
        //this.max = s.selectFromChoices.max;
      } else if (s.selectOnBoard) {
        this.type = 'board';
        this.boardChoices = s.selectOnBoard.chooseFrom;
        this.min = s.selectOnBoard.min;
        this.max = s.selectOnBoard.max;
      } else if (s.selectNumber) {
        this.type = 'number';
        this.min = s.selectNumber.min;
        this.max = s.selectNumber.max;
      } else if (s.enterText) {
        this.type = 'text';
        this.regexp = s.enterText.regexp;
      } else {
        this.type = 'button';
      }
    }
    this.prompt = s.prompt;
    this.clientContext = s.clientContext;
  }

  /**
   * check specific selection with a given arg. evaluates within the context of
   * previous args, so any selection elements that have previous-arg-function
   * forms are here evaluated with the previous args. returns new selection and
   * error if any
   */
  validate(arg: Argument, previousArgs: Argument[]): string | undefined {
    const s = this.resolve(...previousArgs);

    if (s.type === 'choices' && s.choices) {
      return (
        s.choices instanceof Array ? s.choices : Object.keys(s.choices) as Argument[]
      ).includes(arg) ? undefined : "Not a valid choice";
    }

    if (s.type === 'board' && s.boardChoices) {
      const results = s.boardChoices;
      if (!results) console.warn('Attempted to validate an impossible move', s);
      if (s.min !== undefined || s.max !== undefined) {
        if (!(arg instanceof Array)) throw Error("Required multi select");
        if (results && arg.some(a => !results.includes(a as GameElement))) return "Selected elements are not valid";
        if (s.min !== undefined && arg.length < s.min) return "Below minimum";
        if (s.max !== undefined && arg.length > s.max) return "Above maximum";
      } else {
        return (results && results.includes(arg as GameElement)) ? undefined : "Selected element is not valid";
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
  options(): Argument[] {
    if (!this.isResolved() || this.isUnbounded()) return [];
    if (this.type === 'number') return range(this.min || 1, this.max!);
    if (this.type === 'choices') return this.choices instanceof Array ? this.choices : Object.keys(this.choices);
    if (this.type === 'board') return this.boardChoices;
    return [];
  }

  isUnbounded(): boolean {
    if (!this.isResolved()) return true;
    if (this.type === 'number') return this.max === undefined || this.max - (this.min || 1) > 100;
    return this.type === 'text' || this.type === 'button';
  }

  isResolved(): this is ResolvedSelection {
    return typeof this.prompt !== 'function' &&
      typeof this.min !== 'function' &&
      typeof this.max !== 'function' &&
      typeof this.choices !== 'function' &&
      typeof this.boardChoices !== 'function';
  }

  resolve(...args: Argument[]): ResolvedSelection {
    if (this.isResolved()) return this;
    const resolved = new Selection(this);
    if (typeof this.prompt === 'function') resolved.prompt = this.prompt(...args);
    if (typeof this.min === 'function') resolved.min = this.min(...args)
    if (typeof this.max === 'function') resolved.max = this.max(...args)
    if (typeof this.choices === 'function') resolved.choices = this.choices(...args)
    if (typeof this.boardChoices === 'string') throw Error("not impl");
    if (typeof this.boardChoices === 'function') resolved.boardChoices = this.boardChoices(...args)
    return resolved as ResolvedSelection;
  }

  isPossible(): boolean {
    if (!this.isResolved()) return this.resolve([]).isPossible();
    if (this.type === 'choices' && this.choices) return (
      this.choices instanceof Array ? this.choices : Object.keys(this.choices) as Argument[]
    ).length > 0

    const isInBounds = this.max !== undefined ? (this.min || 1) <= this.max : true;
    if (this.type === 'board' && this.boardChoices) return isInBounds && this.boardChoices.length >= (this.min || 1);
    if (this.type === 'number') return isInBounds;

    return true;
  }

  isForced(): Argument | undefined {
    if (!this.isResolved()) return this.resolve([]).isForced();
    if (this.boardChoices?.length === 1 &&
      this.min === undefined &&
      this.max === undefined) {
      return this.boardChoices[0];
    } else if (this.type === 'board' &&
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

  overrideOptions(options: Argument[]): ResolvedSelection {
    if (this.type === 'board') {
      this.boardChoices = options as GameElement[];
      return this as ResolvedSelection;
    }
    return new Selection({
      selectFromChoices: {
        choices: options,
        //min: selection.min,
        //max: selection.max
      }
    }) as ResolvedSelection;
  }
}
