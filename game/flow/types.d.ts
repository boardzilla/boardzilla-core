import type Flow from './flow';
import type { Argument } from '../action/types.d';

export type FlowDefinition = Flow | ((args: Record<any, any>) => any) | FlowDefinition[];

export type ActionStepPosition = {
  player: number,
  action: string,
  args: Argument[]
};
export type LoopPosition = any;
export type SequencePosition = number;
export type FlowBranchNode = {type: string, name?: string, position?: ActionStepPosition | LoopPosition | SequencePosition}

export type SwitchCaseCases<T> = {eq: T, flow: Flow}[] | {test: (a: T) => boolean, flow: Flow}[];

