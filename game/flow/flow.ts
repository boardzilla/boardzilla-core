import { Game, Player, Board } from '../';

import type Loop from './loop';
import type {
  FlowBranchNode,
  FlowBranchJSON,
  ActionStepPosition
} from './types';
import type { ResolvedSelection, Argument } from '../action/types';

// Abstract Base class
export default class Flow {
  name?: string;
  position?: any;
  type: string;
  parent: Flow;
  subflow?: Flow;
  ctx: {
    game: Game<Player, Board>,
    top: Flow
  };

  constructor({ name }: { name?: string }) {
    this.name = name;
    // each new can create its own context because they will be copied later by each parent as it loads its subflows
    this.ctx = {
      game: new Game(),
      top: this
    }
  }

  flowStepArgs(): Record<any, any> {
    const args: Record<any, any> = { game: this.ctx.game };
    this.ctx.top.branch().forEach(node => {
      if (node.type === 'action') {
        args[node.position.action] = node.position.args;
      }
      if (typeof node.position === 'object' && 'value' in node.position && node.name) {
        args[node.name] = node.position.value;
      }
    });

    return args;
  }

  /**
   * get the position of this flow and all subflows recursively
   */
  branch(): FlowBranchNode[] {
    if (this.position === undefined) return [];
    let branch = [
      {
        type: this.type,
        position: this.position
      } as FlowBranchNode
    ]
    if (this.name) branch[0].name = this.name;
    if (this.subflow) branch = branch.concat(this.subflow.branch());
    return branch;
  }

  branchJSON(): FlowBranchNode[] {
    if (this.position === undefined) return [];
    let branch = [
      {
        type: this.type,
        position: this.positionJSON()
      } as FlowBranchJSON
    ]
    if (this.name) branch[0].name = this.name;
    if (this.subflow) branch = branch.concat(this.subflow.branchJSON());
    return branch;
  }

  /**
   * set the position of this flow and all subflows recursively
   */
  setBranch(branch: FlowBranchNode[]) {
    const node = branch[0];
    if (node) {
      this.setPosition(node.position, false);
      if (branch.length) {
        if (!this.subflow) {
          console.error(this, branch.slice(1));
          throw Error('Excess position elements sent to flow');
        }
        this.subflow.setBranch(branch.slice(1)); // continue down the hierarchy
      }
    } else {
      this.reset();
    }
  }

  setBranchFromJSON(branch: FlowBranchJSON[]) {
    const node = branch[0];
    if (node) {
      this.setPositionFromJSON(node.position);
      if (branch.length) {
        if (!this.subflow) {
          console.error(this, branch.slice(1));
          throw Error('Excess position elements sent to flow');
        }
        this.subflow.setBranchFromJSON(branch.slice(1)); // continue down the hierarchy
      }
    } else {
      this.reset();
    }
  }

  setPosition(position: any, reset=true) {
    this.position = position;
    this.subflow = this.currentSubflow();
    if (this.subflow) {
      this.subflow.ctx = this.ctx;
      if (reset) this.subflow.reset();
    }
  }

  currentStep(): Flow {
    this.subflow = this.currentSubflow();
    if (this.subflow) {
      return this.subflow.currentStep();
    }
    return this;
  }

  // instantiateSubflow(): Flow | undefined {
  //   const flowDefinition = this.currentSubflow();
  //   let flow:Flow | undefined;
  //   if (flowDefinition instanceof Array) {
  //     flow = new Sequence({ steps: flowDefinition });
  //   } else if (flowDefinition instanceof Function) {
  //     flow = new Step({ command: flowDefinition });
  //   } else flow = flowDefinition;

  //   if (flow) {
  //     flow.ctx = this.ctx;
  //     flow.parent = this;
  //   }
  //   return flow;
  // }


  currentLoop(): Loop | undefined {
    let loop: Loop | undefined = undefined;
    let flow: Flow | undefined = this.ctx.top;
    while (flow) {
      if ('repeat' in flow) loop = flow as Loop;
      flow = flow.currentSubflow();
    }
    return loop;
  }

  actionNeeded(): string[] | void {
    return this.currentStep().awaitingAction();
  }

  processMove(move: ActionStepPosition): [ResolvedSelection?, Argument[]?, string?] {
    const step = this.currentStep();
    if (!step || step.type !== 'action') throw Error(`Cannot process action currently ${JSON.stringify(this.branch())}`);
    return step.processMove(move);
  }

  start() {
    this.reset();
    if (this.subflow) {
      this.subflow.ctx = this.ctx;
      this.subflow.start();
    }
  }

  // advance flow one step and return 'complete' if complete, 'ok' if can continue, 'skip'/'repeat' to skip/repeat the current loop
  // override for self-contained flows that do not have subflows
  playOneStep(): 'ok' | 'complete' | 'repeat' | 'skip' | string[] {
    if (this.subflow) {
      const actions = this.subflow.awaitingAction();
      if (actions) return actions;
      try {
        const result = this.subflow.playOneStep();
        if (result !== 'complete') return result;
      } catch (e) {
        if (e instanceof FlowInteruptAndRepeat || e instanceof FlowInteruptAndSkip) {
          const loop = this.currentLoop();
          if (!loop) throw Error("Cannot interupt loop when not in a loop");
          if (e instanceof FlowInteruptAndSkip) return loop.advance();
          return loop.repeat();
        }
        throw e;
      }
    }
    return this.advance();
  }

  // play until action required or game over
  play(): string[] | void {
    let step;
    do { step = this.playOneStep() } while (step === 'ok' || step === 'repeat' || step === 'skip')
    if (step !== 'complete') return step;
  }

  // must override and call super. reset runs any logic needed and call setPosition. Must not modify state besides position.
  reset() { }

  // must override. must rely on this.position
  currentSubflow(): Flow | undefined {
    return undefined;
  }

  // override if position contains objects that need serialization
  positionJSON() {
    return this.position;
  }

  // override if position contains objects that need serialization
  setPositionFromJSON(position: any) {
    this.setPosition(position, false);
  }

  // override for steps that await
  awaitingAction(): string[] | void {
  }

  // override for steps that advance through their subflows. call setPosition if needed. return ok/complete
  advance(): 'ok' | 'complete' {
    return 'complete';
  }

  toString(): string {
    return "";
  }
}

export class FlowInteruptAndRepeat extends Error {}
export class FlowInteruptAndSkip extends Error {}
