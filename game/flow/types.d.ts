import type Flow from './flow';
import type { Argument } from '../action/types.d';
import type { Player } from '../player';

/**
 * Several flow methods accept an argument of this type. This is an object
 * containing keys for every flow function that the game is in the middle of
 * which recorded a value to the current scope. Functions that can add these
 * values are {@link forLoop}, {@link forEach}, {@link switchCase}. The name
 * given to these functions will be the key in the FlowArguments and its value
 * will be the value of the current loop for loops, or the test value for
 * switchCase
 *
 * @example
 * forLoop({
 *   name: 'x', // x is declared here
 *   initial: 0,
 *   next: x => x + 1,
 *   while: x => x < 3,
 *   do: forLoop({
 *     name: 'y',
 *     initial: 0,
 *     next: y => y + 1,
 *     while: y => y < 2,
 *     do: ({ x, y }) => {
 *       // x is available here as the value of the outer loop
 *       // and y will be the value of the inner loop
 *     }
 *   })
 * })
 */
export type FlowArguments = Record<string, any>;

export type FlowStep<P extends Player> = Flow<P> | ((args: FlowArguments) => void) | null;

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

