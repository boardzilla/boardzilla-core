import type Flow from './flow';
import type { Argument } from '../action/types.d';
import type { Player } from '../player';

export type FlowDefinition<P extends Player> = Flow<P> | ((args: Record<any, any>) => any) | FlowDefinition<P>[];

export type ActionStepPosition<P extends Player> = {
  player: number,
  action: string,
  args: Argument<P>[]
};
export type LoopPosition = any;
export type SequencePosition = number;
export type FlowBranchNode<P extends Player> = {type: string, name?: string, position?: ActionStepPosition<P> | LoopPosition | SequencePosition}
export type FlowBranchJSON = {type: string, name?: string, position?: any}

export type SwitchCaseCases<P extends Player, T> = {eq: T, flow: Flow<P>}[] | {test: (a: T) => boolean, flow: Flow<P>}[];

