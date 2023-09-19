import { Player } from '../player/';
import { GameElement } from '../board/';
import type Selection from './selection';

export type SingleArgument = string | number | boolean | GameElement | Player;
export type Argument = SingleArgument | SingleArgument[];
export type SerializedSingleArg = string | number | boolean;
export type SerializedArg = SerializedSingleArg | SerializedSingleArg[];

export type BoardQuerySingle<T extends GameElement> = string | T | undefined | ((...a: Argument[]) => T | undefined)
export type BoardQueryMulti<T extends GameElement> = string | T[] | ((...a: Argument[]) => T[])
export type BoardQuery<T extends GameElement> = BoardQuerySingle<T> | BoardQueryMulti<T>

// a Move is a request from a particular Player to perform a certain Action with supplied args
export type Move<P> = {
  player: P,
  action: string,
  args: Argument[]
};

export type IncompleteMove<P> = {
  player: P,
  action?: string,
  args: Argument[]
};

export type SerializedMove = {
  action: string,
  args: SerializedArg[]
}

/**
 * Selection objects represent player choices. They either specify the options
 * or provide enough information for the client to contextually show options to
 * players at runtime
 */
export type BoardSelection<T extends GameElement> = {
  chooseFrom: BoardQueryMulti<T>;
  min?: number | ((...a: Argument[]) => number);
  max?: number | ((...a: Argument[]) => number);
  noChoice?: never;
}

export type ChoiceSelection = {
  choices: Argument[] | Record<string, Argument> | ((...a: Argument[]) => Argument[] | Record<string, Argument>);
}

export type NumberSelection = {
  min?: number | ((...a: Argument[]) => number);
  max?: number | ((...a: Argument[]) => number);
}

export type TextSelection = {
  regexp?: RegExp;
}

export type ButtonSelection = any;

export type SelectionDefinition = {
  prompt?: string | ((...a: Argument[]) => string);
  clientContext?: Record<any, any> // additional meta info that describes the context for this selection
} & ({
  selectOnBoard: BoardSelection<GameElement>;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText?: never;
  click?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices: ChoiceSelection;
  selectNumber?: never;
  enterText?: never;
  click?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices?: never;
  selectNumber: NumberSelection;
  enterText?: never;
  click?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText: TextSelection;
  click?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText?: never;
  click: ButtonSelection;
});

export type ResolvedSelection = Selection & {
  prompt?: string;
  choices?: Argument[] | Record<string, Argument>;
  boardChoices: GameElement[];
  min?: number;
  max?: number;
  regexp?: RegExp;
}

// move if altered, selection if invalid and more info required to become valid, error if message
export type MoveResponse<P> = {
  move: IncompleteMove<P>,
  selection?: ResolvedSelection,
  error?: string
};
