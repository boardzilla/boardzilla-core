import { Player } from '../player/';
import { GameElement } from '../board/';
import type Selection from './selection';

export type SingleArgument<P extends Player> = string | number | boolean | GameElement<P> | P;
export type Argument<P extends Player> = SingleArgument<P> | SingleArgument<P>[];
export type SerializedSingleArg = string | number | boolean;
export type SerializedArg = SerializedSingleArg | SerializedSingleArg[];
export type Serializable<P extends Player> = SingleArgument<P> | null | undefined | Serializable<P>[] | { [key: string]: Serializable<P> };

export type BoardQuerySingle<P extends Player, T extends GameElement<P>> = string | T | undefined | ((...a: Argument<P>[]) => T | undefined)
export type BoardQueryMulti<P extends Player, T extends GameElement<P>> = string | T[] | ((...a: Argument<P>[]) => T[])
export type BoardQuery<P extends Player, T extends GameElement<P>> = BoardQuerySingle<P, T> | BoardQueryMulti<P, T>

// a Move is a request from a particular Player to perform a certain Action with supplied args
export type Move<P extends Player> = {
  player: P,
  action: string,
  args: Argument<P>[]
};

export type IncompleteMove<P extends Player> = {
  player: P,
  action?: string,
  args: Argument<P>[]
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
export type BoardSelection<P extends Player, T extends GameElement<P>> = {
  chooseFrom: BoardQueryMulti<P, T>;
  min?: number | ((...a: Argument<P>[]) => number);
  max?: number | ((...a: Argument<P>[]) => number);
}

export type ChoiceSelection<P extends Player> = {
  choices: Argument<P>[] | Record<string, Argument<P>> | ((...a: Argument<P>[]) => Argument<P>[] | Record<string, Argument<P>>);
  initial?: Argument<P> | ((...a: Argument<P>[]) => Argument<P>);
}

export type NumberSelection<P extends Player> = {
  min?: number | ((...a: Argument<P>[]) => number);
  max?: number | ((...a: Argument<P>[]) => number);
  initial?: number | ((...a: Argument<P>[]) => number);
}

export type TextSelection<P extends Player> = {
  regexp?: RegExp;
  initial?: string | ((...a: Argument<P>[]) => string);
}

export type ButtonSelection = any;

export type SelectionDefinition<P extends Player> = {
  prompt?: string | ((...a: Argument<P>[]) => string);
  clientContext?: Record<any, any> // additional meta info that describes the context for this selection
} & ({
  selectOnBoard: BoardSelection<P, GameElement<P>>;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText?: never;
  click?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices: ChoiceSelection<P>;
  selectNumber?: never;
  enterText?: never;
  click?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices?: never;
  selectNumber: NumberSelection<P>;
  enterText?: never;
  click?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText: TextSelection<P>;
  click?: never;
} | {
  selectOnBoard?: never;
  selectFromChoices?: never;
  selectNumber?: never;
  enterText?: never;
  click: ButtonSelection;
});

export type ResolvedSelection<P extends Player> = Selection<P> & {
  prompt?: string;
  choices?: Argument<P>[] | Record<string, Argument<P>>;
  boardChoices: GameElement<P>[];
  min?: number;
  max?: number;
  initial?: Argument<P>;
  regexp?: RegExp;
}

// move if altered, selection if invalid and more info required to become valid, error if message
export type MoveResponse<P extends Player> = {
  move: IncompleteMove<P>,
  selection?: ResolvedSelection<P>,
  error?: string
};
