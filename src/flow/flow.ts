import { Player } from '../index.js';
import { Board } from '../board/index.js';
import { Do, FlowControl } from './enums.js';

import type Game from '../game.js';
import type { WhileLoopPosition } from './while-loop.js';
import type { ForLoopPosition } from './for-loop.js';
import type { ForEachPosition } from './for-each.js';
import type { SwitchCasePostion } from './switch-case.js';
import type { ActionStepPosition } from './action-step.js';
import { Argument, FollowUp } from '../action/action.js';
import ActionStep from './action-step.js';

export type FlowArguments = Record<string, any>;
export type FlowStep<P extends Player> = Flow<P> | ((args: FlowArguments) => Do | void) | Do;

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

export type FlowBranchNode<P extends Player> = ({
  type: 'sequence',
} | {
  type: 'action',
  position: ActionStepPosition<P>
} | {
  type: 'parallel',
  position: FlowBranchJSON[][],
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

export type FlowBranchJSON = ({
  type: 'sequence'
  position?: any,
} | {
  type: 'action' | 'loop' | 'foreach' | 'switch-case' | 'parallel'
  position: any,
}) & {
  name?: string,
  sequence?: number,
}

export type Position<P extends Player> = (
  ActionStepPosition<P> | ForLoopPosition<any> | WhileLoopPosition | ForEachPosition<any> | SwitchCasePostion<any> | FlowBranchJSON[][]
)

/** internal */
export default class Flow<P extends Player> {
  name?: string;
  position?: Position<P>;
  sequence?: number; // if block is an array, indicates the index of execution
  type: FlowBranchNode<P>['type'] = 'sequence';
  step?: FlowStep<P>; // cached by setPositionFromJSON
  block?: FlowDefinition<P>;
  top: Flow<P>;
  parent?: Flow<P>;
  game: Game<P, Board<P>>;

  constructor({ name, do: block }: { name?: string, do?: FlowDefinition<P> }) {
    this.name = name;
    this.block = block;
    // each subflow can set itself as top because they will be copied later by each parent as it loads its subflows
    this.top = this;
  }

  validateNoDuplicate() {
    const name = this.name;
    this.name = undefined;
    if (name && this.getStep(name)) throw Error(`Duplicate flow name: ${name}`);
    this.name = name;
  }

  flowStepArgs(): FlowArguments {
    const args: FlowArguments = {};
    let flow: FlowStep<P> | undefined = this.top;
    while (flow instanceof Flow) {
      if ('position' in flow && flow.position) {
        // want to remove
        if (flow.type === 'action' && 'name' in flow.position) {
          const position = flow.position as {
            player: number,
            name: string,
            args: Record<string, Argument<P>>,
            followups?: FollowUp<P>[]
          };
          args[position!.name] = position!.args;
        }
        if ('value' in flow.position && flow.name) {
          args[flow.name] = flow.position.value;
        }
      }
      flow = flow.step;
    }
    return args;
  }

  branchJSON(forPlayer=true): FlowBranchJSON[] {
    if (this.position === undefined && this.sequence === undefined) return []; // probably invalid
    let branch: Record<string, any> = {
      type: this.type,
    };
    if (this.name) branch.name = this.name;
    if (this.position !== undefined) branch.position = this.toJSON(forPlayer);
    if (this.sequence !== undefined && this.currentBlock() instanceof Array) branch.sequence = this.sequence;
    const thisBranch = branch as FlowBranchJSON;
    if (this.step instanceof Flow) return [thisBranch].concat(this.step.branchJSON(forPlayer));
    return [thisBranch];
  }

  setBranchFromJSON(branch: FlowBranchJSON[]) {
    const node = branch[0];
    if (node === undefined) throw Error(`Insufficient position elements sent to flow for ${this.name}`);
    if (node.type !== this.type || node.name !== this.name) {
      throw Error(`Flow mismatch. Trying to set ${node.type}:${node.name} on ${this.type}:${this.name}`);
    }
    this.setPositionFromJSON(node.position, node.sequence);
    if (this.step instanceof Flow) {
      this.step.setBranchFromJSON(branch.slice(1)); // continue down the hierarchy
    }
  }

  setPosition(position: any, sequence?: number, reset=true) {
    this.position = position;
    const block = this.currentBlock();
    if (!block) {
      this.step = undefined; // awaiting action or unreachable step
    } else if (block instanceof Array) {
      if (sequence === undefined) sequence = 0;
      this.sequence = sequence;
      if (!block[sequence]) throw Error(`Invalid sequence for ${this.type}:${this.name} ${sequence}/${block.length}`);
      this.step = block[sequence];
    } else {
      this.step = block;
    }

    if (this.step instanceof Flow) {
      this.step.game = this.game;
      this.step.top = this.top;
      this.step.parent = this;
      if (reset) this.step.reset();
    }
  }

  setPositionFromJSON(positionJSON: any, sequence?: number) {
    this.setPosition(this.fromJSON(positionJSON), sequence, false);
  }

  currentProcessor(): Flow<P> | undefined {
    if (this.step instanceof Flow) return this.step.currentProcessor();
    if (this.type === 'action' || this.type === 'parallel') return this;
  }

  actionNeeded(player?: Player): {
    step?: string,
    prompt?: string,
    actions: FollowUp<P>[],
    skipIf: 'always' | 'never' | 'only-one';
  } | undefined {
    return this.currentProcessor()?.actionNeeded(player);
  }

  processMove(move: Exclude<ActionStepPosition<P>, undefined>): string | undefined {
    const step = this.currentProcessor();
    if (!step) throw Error(`Cannot process action currently ${JSON.stringify(this.branchJSON())}`);
    return step.processMove(move);
  }

  getStep(name: string): Flow<P> | undefined {
    if (this.name === name) {
      this.validateNoDuplicate();
      return this;
    }
    const steps = this.allSteps();
    if (!steps) return;
    for (const step of steps instanceof Array ? steps : [steps]) {
      if (step instanceof Flow) {
        const found = step.getStep(name);
        if (found) return found;
      }
    }
  }

  /**
   * Advance flow one step and return FlowControl.complete if complete,
   * FlowControl.ok if can continue, Do to interupted the current
   * loop. Returns undefined if now waiting for player input. override
   * for self-contained flows that do not have subflows.
   */
  playOneStep(): Do | FlowControl | undefined {
    const step = this.step;
    let result: Do | FlowControl | undefined = FlowControl.complete;
    if (step instanceof Function) {
      const stepResult = step(this.flowStepArgs());
      result = Do.break === stepResult || Do.continue === stepResult || Do.repeat === stepResult ? stepResult : FlowControl.complete;
    } else if (typeof step === 'string') {
      result = step;
    } else if (step instanceof Flow) {
      if ('awaitingAction' in step && (step as ActionStep<P>).awaitingAction()) return; // awaiting action
      result = step.playOneStep();
    }
    if (result === FlowControl.ok || !result) return result;
    if (result !== FlowControl.complete) {
      if ('advance' in this && typeof this.advance === 'function' && result === Do.continue) return this.advance();
      if ('repeat' in this && typeof this.repeat === 'function' && result === Do.repeat) return this.repeat();
      if ('exit' in this && typeof this.exit === 'function' && result === Do.break) return this.exit();
      return result;
    }

    // completed step, advance this block if able
    const block = this.currentBlock();
    if (block instanceof Array) {
      if (this.sequence !== undefined) {
        if (this.sequence + 1 !== block.length) {
          this.setPosition(this.position, this.sequence + 1);
          return FlowControl.ok;
        }
      }
    }

    // completed block, advance self
    return this.advance();
  }

  // play until action required (returns list) or game over
  play() {
    let step;
    do {
      if (this.game.phase !== 'finished') step = this.playOneStep();
      if (step) console.debug(`Advancing flow:\n ${this.stacktrace()}`);
    } while (step === FlowControl.ok && this.game.phase !== 'finished')
    //console.debug("Game Flow:\n" + this.stacktrace());
    if (step === Do.continue || step === Do.repeat || step === Do.break) throw Error("Cannot skip/repeat/break when not in a loop");
    if (step === FlowControl.complete) this.game.finish();
  }

  // must override. reset runs any logic needed and call setPosition. Must not modify own state.
  reset() {
    this.game.players.setCurrent(this.game.players);
    this.setPosition(null);
  }

  // must override. must rely solely on this.position
  currentBlock(): FlowDefinition<P> | undefined {
    return this.block;
  }

  // override if position contains objects that need serialization
  toJSON(forPlayer=true): any {
    return this.position;
  }

  // override if position contains objects that need deserialization
  fromJSON(json: any): typeof this.position {
    return json;
  }

  // override for steps that advance through their subflows. call setPosition if needed. return ok/complete
  advance(): FlowControl {
    return FlowControl.complete;
  }

  // override return all subflows
  allSteps(): FlowDefinition<P> | undefined {
    return this.block;
  }

  toString() {
    return `flow${this.name ? ":" + this.name : ""}${this.block instanceof Array ? ' (item #' + this.sequence + ')' : ''}`;
  }

  stacktrace(indent=0) {
    let string = this.toString();
    if (this.step instanceof Flow) string += '\n' + ' '.repeat(indent) + '↳ ' + this.step.stacktrace(indent + 2);
    return string;
  }
}
