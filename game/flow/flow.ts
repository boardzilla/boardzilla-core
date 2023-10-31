import { Player } from '../';
import { Board } from '../board';
import { Do, FlowControl } from './enums';

import type ActionStep from './action-step';
import type {
  FlowArguments,
  Position,
  FlowStep,
  FlowDefinition,
  FlowBranchNode,
  FlowBranchJSON,
  ActionStepPosition
} from './types';
import type Game from '../game';

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
        if (flow.type === 'action' && 'action' in flow.position && 'args' in flow.position) {
          args[flow.position.action!] = flow.position.args;
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
    if (!node) throw Error(`Insufficient position elements sent to flow for ${this.name}`);
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

  currentFlow(): Flow<P> {
    return !this.step || typeof this.step === 'function' || typeof this.step === 'string' ? this : this.step.currentFlow();
  }

  currentLoop(): Flow<P> & { repeat: Function, exit: Function } | undefined {
    return ('repeat' in this ? this : this.parent?.currentLoop()) as Flow<P> & { repeat: Function, exit: Function };
  }

  actionNeeded(): {step?: string, prompt?: string, actions: string[], skipIfOnlyOne: boolean, expand: boolean} | undefined {
    const flow = this.currentFlow() as ActionStep<P>;
    if ('awaitingAction' in flow) {
      const actions = flow.awaitingAction();
      if (actions) return {
        step: flow.name,
        prompt: flow.prompt,
        actions,
        skipIfOnlyOne: flow.skipIfOnlyOne,
        expand: flow.expand,
      };
    }
  }

  processMove(move: ActionStepPosition<P>): string | undefined {
    const step = this.currentFlow();
    if (!step || step.type !== 'action') throw Error(`Cannot process action currently ${JSON.stringify(this.branchJSON())}`);
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
   * loop. Return a list of actions if now waiting for player input. override
   * for self-contained flows that do not have subflows.
   */
  playOneStep(): Do | FlowControl | string[] {
    const step = this.step;
    let result: Do | FlowControl | string[] = FlowControl.complete;
    if (step instanceof Function) {
      result = step(this.flowStepArgs()) || FlowControl.complete;
    } else if (typeof step === 'string') {
      result = step;
    } else if (step instanceof Flow) {
      const actions = step.actionNeeded();
      if (actions?.actions) return actions.actions;
      result = step.playOneStep();
    }

    if (result === FlowControl.ok || result instanceof Array) return result;
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
  play(): string[] | void {
    let step;
    do { step = this.playOneStep() } while (step === FlowControl.ok && this.game.phase !== 'finished')
    if (step === Do.continue || step === Do.repeat || step === Do.break) throw Error("Cannot skip/repeat/break when not in a loop");
    if (step !== FlowControl.complete && step !== FlowControl.ok) return step;
  }

  // must override. reset runs any logic needed and call setPosition. Must not modify state.
  reset() {
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
  allSteps(): FlowDefinition<P> {
    return this.block ?? null;
  }

  toString(): string {
    return "";
  }
}
