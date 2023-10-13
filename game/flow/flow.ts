import { Player } from '../';
import { Board } from '../board';

import type ActionStep from './action-step';
import type {
  Position,
  FlowStep,
  FlowDefinition,
  FlowBranchNode,
  FlowBranchJSON,
  ActionStepPosition
} from './types';
import type { ResolvedSelection, Argument } from '../action/types';
import type { Game } from '../';

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
    // each new can create its own context because they will be copied later by each parent as it loads its subflows
    this.top = this;
  }

  flowStepArgs(): Record<string, any> {
    const args: Record<string, any> = {};
    let flow: FlowStep<P> | undefined = this.top;
    while (flow instanceof Flow) {
      if ('position' in flow && flow.position) {
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
      if (sequence && sequence > 0) throw Error(`Sequence ${sequence} in position of ${this.type}:${this.name} but no sequence block`); // remove after debugging
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
    return !this.step || typeof this.step === 'function' ? this : this.step.currentFlow();
  }

  currentLoop(): Flow<P> & { repeat: Function } | undefined {
    return ('repeat' in this ? this : this.parent?.currentLoop()) as Flow<P> & { repeat: Function };
  }

  actionNeeded(): {prompt?: string, actions?: string[]} {
    const flow = this.currentFlow() as ActionStep<P>;
    if ('awaitingAction' in flow) return {
      prompt: flow.prompt,
      actions: flow.awaitingAction()
    };
    return {};
  }

  processMove(move: ActionStepPosition<P>): [ResolvedSelection<P>?, Argument<P>[]?, string?] {
    const step = this.currentFlow();
    if (!step || step.type !== 'action') throw Error(`Cannot process action currently ${JSON.stringify(this.branchJSON())}`);
    return step.processMove(move);
  }

  /**
   * advance flow one step and return 'complete' if complete, 'ok' if can
   * continue, 'skip'/'repeat' to skip/repeat the current loop. return a list of
   * actions if now waiting for player input. override for self-contained flows
   * that do not have subflows.
   */
  playOneStep(): 'ok' | 'complete' | string[] {
    const step = this.step;
    if (step instanceof Function) {
      try {
        step(this.flowStepArgs());
      } catch (e) {
        if (e instanceof FlowInterruptAndRepeat || e instanceof FlowInterruptAndSkip) {
          const loop = this.currentLoop();
          if (!loop) throw Error("Cannot skip/repeat when not in a loop");
          if (e instanceof FlowInterruptAndSkip) return loop.advance();
          return loop.repeat();
        }
        throw e;
      }
    } else if (step instanceof Flow) {
      const actions = step.actionNeeded();
      if (actions) return actions;
      const result = step.playOneStep();
      if (result !== 'complete') return result;
    }

    // completed step, advance this block if able
    const block = this.currentBlock();
    if (block instanceof Array) {
      if (this.sequence === undefined) throw Error('sequence unset'); // remove after debugging
      if (this.sequence + 1 !== block.length) {
        this.setPosition(this.position, this.sequence + 1);
        return 'ok';
      }
    }

    // completed block, advance self
    return this.advance();
  }

  // play until action required (returns list) or game over
  play(): string[] | void {
    let step;
    do { step = this.playOneStep() } while (step === 'ok')
    if (step !== 'complete') return step;
  }

  // must override and call super. reset runs any logic needed and call setPosition. Must not modify state.
  reset() {
    this.setPosition(undefined);
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
  advance(): 'ok' | 'complete' {
    return 'complete';
  }

  toString(): string {
    return "";
  }
}

export class FlowInterruptAndRepeat extends Error {}
export class FlowInterruptAndSkip extends Error {}
