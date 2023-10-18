export {default as Flow} from './flow';

import {default as ActionStep} from './action-step';
import {default as WhileLoop} from './while-loop';
import {default as ForLoop} from './for-loop';
import {default as ForEach} from './foreach';
import {default as EachPlayer} from './each-player';
import {default as SwitchCase} from './switch-case';
import {default as IfElse} from './if-else';

import {
  FlowInterruptAndSkip,
  FlowInterruptAndRepeat
} from './flow';

import type { Player } from '../player';
import type { Serializable } from '../action/types';

export const playerActions = <P extends Player>(playerActionsConfig: ConstructorParameters<typeof ActionStep<P>>[0]) => new ActionStep<P>(playerActionsConfig);
export const whileLoop = <P extends Player>(whileLoopConfig: ConstructorParameters<typeof WhileLoop<P>>[0]) => new WhileLoop<P>(whileLoopConfig);
export const forLoop = <P extends Player, T = Serializable<P>>(forLoopConfig: ConstructorParameters<typeof ForLoop<P, T>>[0]) => new ForLoop<P, T>(forLoopConfig);
export const forEach = <P extends Player, T extends Serializable<P>>(forEachConfig: ConstructorParameters<typeof ForEach<P, T>>[0]) => new ForEach<P, T>(forEachConfig);
export const eachPlayer = <P extends Player>(eachPlayerConfig: ConstructorParameters<typeof EachPlayer<P>>[0]) => new EachPlayer<P>(eachPlayerConfig);
export const ifElse = <P extends Player>(ifElseConfig: ConstructorParameters<typeof IfElse<P>>[0]) => new IfElse<P>(ifElseConfig);
export const switchCase = <P extends Player, T extends Serializable<P>>(switchCaseConfig: ConstructorParameters<typeof SwitchCase<P, T>>[0]) => new SwitchCase<P, T>(switchCaseConfig);

export const repeat = () => { throw new FlowInterruptAndRepeat(); }
export const skip = () => { throw new FlowInterruptAndSkip() }

forLoop({
  name: 'loop',
  initial: 0,
  next: loop => loop + 1,
  while: loop => loop < 3,
  do: []
})
