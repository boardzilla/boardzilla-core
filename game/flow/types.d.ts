import type Flow from './flow';
import type { Do } from './enums';
import type { Argument } from '../action/types.d';
import type { Player } from '../player';

export type FlowArguments = Record<string, any>;

export type FlowStep<P extends Player> = Flow<P> | ((args: FlowArguments) => Do | void) | Do | null;

/**
 * A FlowDefinition is provided to the game and to all flow function to provide
 * further flow logic inside the given flow. Any of the follow qualifies:
 - a plain function that accepts {@link FlowArguments}
 - returning a {@link whileLoop} call
 - returning a {@link forEach} call
 - returning a {@link forLoop} call
 - returning a {@link eachPlayer} call
 - returning a {@link ifElse} call
 - returning a {@link switchCase} call
 - returning a {@link playerActions} call
 - providing an array containing any number of the above
 */
export type FlowDefinition<P extends Player> = FlowStep<P> | FlowStep<P>[]

export type ActionStepPosition<P extends Player> = {
  player?: number,
  action?: string,
  args?: Argument<P>[]
};
export type WhileLoopPosition = { index: number };
export type ForLoopPosition<T> = { index: number, value: T };
export type ForEachPosition<T> = ForLoopPosition<T> & { collection: T[] };
export type SwitchCasePostion<T> = { index?: number, value?: T, default?: boolean }
export type Position<P extends Player> = (
  ActionStepPosition<P> | ForLoopPosition<any> | WhileLoopPosition | ForEachPosition<any> | SwitchCasePostion<any>
)

export type FlowBranchNode<P extends Player> = ({
  type: 'sequence',
} | {
  type: 'action',
  position: ActionStepPosition<P>
} | {
  type: 'loop',
  position: WhileLoopPosition | ForLoopPosition<any>
} | {
  type: 'foreach',
  position: ForEachPosition<any>
} | {
  type: 'switch-case',
  position: SwitchCasePostion<any>
}) & {
  name?: string,
  sequence?: number,
}

export type FlowBranchJSON = Omit<FlowBranchNode<Player>, 'position'> & { position?: any }

export type SwitchCaseCases<P extends Player, T> = {eq: T, do: FlowDefinition<P>}[] | {test: (a: T) => boolean, do: FlowDefinition<P>}[];

