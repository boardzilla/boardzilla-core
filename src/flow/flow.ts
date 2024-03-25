import { LoopInterruptControl, loopInterrupt, FlowControl } from './enums.js';
import { Do } from './enums.js';

import type GameManager from '../game-manager.js';
import type { Player } from '../index.js';
import type { WhileLoopPosition } from './while-loop.js';
import type { ForLoopPosition } from './for-loop.js';
import type { ForEachPosition } from './for-each.js';
import type { SwitchCasePostion } from './switch-case.js';
import type { ActionStepPosition } from './action-step.js';
import type { EveryPlayerPosition } from './every-player.js';
import type { Argument, ActionStub } from '../action/action.js';
import type ActionStep from './action-step.js';
import type WhileLoop from './while-loop.js';

/**
 * Several flow methods accept an argument of this type. This is an object
 * containing keys for every flow function that the game is in the middle of
 * which recorded a value to the current scope. Functions that can add these
 * values are {@link forLoop}, {@link forEach}, {@link switchCase} and {@link
 * playerActions}. The name given to these functions will be the key used in the
 * FlowArguments and its value will be the value of the current loop for loops,
 * or the test value for switchCase, or the arguments to the action taken for
 * playerActions.
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
 * @category Flow
 */
export type FlowArguments = Record<string, any>;

/**
 * FlowStep's are provided to the game and to all flow function to provide
 * further flow logic inside the given flow. Any of the follow qualifies:
 * - a plain function that accepts {@link FlowArguments}
 * - one of the {@link Game#flowCommands}
 * @category Flow
 */
export type FlowStep = Flow | ((args: FlowArguments) => any);

/**
 * FlowDefinition's are provided to the game and to all flow function to provide
 * further flow logic inside the given flow. Any of the follow qualifies:
 * - a plain function that accepts {@link FlowArguments}
 * - one of the {@link Game#flowCommands}
 * - an array of any combination of the above
 * @category Flow
 */
export type FlowDefinition = FlowStep | FlowStep[]

export type FlowBranchNode = ({
  type: 'main',
} | {
  type: 'action',
  position: ActionStepPosition
} | {
  type: 'parallel',
  position: EveryPlayerPosition,
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
  type: 'main'
  position?: any,
} | {
  type: 'action' | 'loop' | 'foreach' | 'switch-case' | 'parallel'
  position: any,
}) & {
  name?: string,
  sequence?: number,
}

export type Position = (
  ActionStepPosition | ForLoopPosition<any> | WhileLoopPosition | ForEachPosition<any> | SwitchCasePostion<any> | EveryPlayerPosition
)

export type FlowVisualization = {
  type: string,
  name?: string,
  blocks: Record<string, (string | FlowVisualization)[] | undefined>,
  current: {
    block?: string,
    position?: any,
    sequence?: number,
  }
}

/** internal */
export default class Flow {
  name?: string;
  position?: Position;
  sequence?: number; // if block is an array, indicates the index of execution
  type: FlowBranchNode['type'] = 'main';
  step?: FlowStep; // cached by setPositionFromJSON
  block?: FlowDefinition;
  top: Flow;
  parent?: Flow;
  gameManager: GameManager;

  constructor({ name, do: block }: { name?: string, do?: FlowDefinition }) {
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
    let flow: FlowStep | undefined = this.top;
    while (flow instanceof Flow) {
      if ('position' in flow && flow.position) {
        // want to remove
        if (flow.type === 'action' && 'name' in flow.position) {
          const position = flow.position as {
            player: number,
            name: string,
            args: Record<string, Argument>,
            followups?: ActionStub[]
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
      this.step.gameManager = this.gameManager;
      this.step.top = this.top;
      this.step.parent = this;
      if (reset) this.step.reset();
    }
  }

  setPositionFromJSON(positionJSON: any, sequence?: number) {
    this.setPosition(this.fromJSON(positionJSON), sequence, false);
  }

  currentLoop(name?: string): WhileLoop | undefined {
    if ('interrupt' in this && (!name || name === this.name)) return this as unknown as WhileLoop;
    return this.parent?.currentLoop();
  }

  currentProcessor(): Flow | undefined {
    if (this.step instanceof Flow) return this.step.currentProcessor();
    if (this.type === 'action' || this.type === 'parallel') return this;
  }

  actionNeeded(player?: Player): {
    step?: string,
    prompt?: string,
    description?: string,
    actions: ActionStub[],
    skipIf: 'always' | 'never' | 'only-one';
  } | undefined {
    return this.currentProcessor()?.actionNeeded(player);
  }

  processMove(move: NonNullable<ActionStepPosition>): string | undefined {
    const step = this.currentProcessor();
    if (!step) throw Error(`Cannot process action currently ${JSON.stringify(this.branchJSON())}`);
    return step.processMove(move);
  }

  getStep(name: string): Flow | undefined {
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
   * FlowControl.ok if can continue, Do to interrupted the current
   * loop. Returns undefined if now waiting for player input. override
   * for self-contained flows that do not have subflows.
   */
  playOneStep(): {loop?: string, signal: LoopInterruptControl} | FlowControl | undefined {
    const step = this.step;
    let result: {loop?: string, signal: LoopInterruptControl} | FlowControl | undefined = FlowControl.complete;
    if (step instanceof Function) {
      if (!loopInterrupt[0]) step(this.flowStepArgs());
      result = FlowControl.complete;
      if (loopInterrupt[0]) result = loopInterrupt.shift();
    } else if (step instanceof Flow) {
      if ('awaitingAction' in step && (step as ActionStep).awaitingAction()) return; // awaiting action
      result = step.playOneStep();
    }
    if (result === FlowControl.ok || !result) return result;
    if (result !== FlowControl.complete) {
      if ('interrupt' in this && typeof this.interrupt === 'function' && (!result.loop || result.loop === this.name)) return this.interrupt(result.signal)
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
      if (this.gameManager.phase !== 'finished') step = this.playOneStep();
      if (step) console.debug(`Advancing flow:\n ${this.stacktrace()}`);
    } while (step === FlowControl.ok && this.gameManager.phase !== 'finished')
    //console.debug("Game Flow:\n" + this.stacktrace());
    if (typeof step === 'object') {
      if (step.signal === LoopInterruptControl.continue) throw Error("Cannot use Do.continue when not in a loop");
      if (step.signal === LoopInterruptControl.repeat) throw Error("Cannot use Do.repeat when not in a loop");
      if (step.signal === LoopInterruptControl.break) throw Error("Cannot use Do.break when not in a loop");
    }
    if (step === FlowControl.complete) this.gameManager.game.finish();
  }

  // must override. reset runs any logic needed and call setPosition. Must not modify own state.
  reset() {
    this.gameManager.players.setCurrent(Array.from(this.gameManager.players));
    this.setPosition(null);
  }

  // must override. must rely solely on this.position
  currentBlock(): FlowDefinition | undefined {
    return this.block;
  }

  // override if position contains objects that need serialization
  toJSON(_forPlayer=true): any {
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
  allSteps(): FlowDefinition | undefined {
    return this.block;
  }

  toString() {
    return `flow${this.name ? ":" + this.name : ""}${this.block instanceof Array && this.block.length > 1 ? ' (item #' + this.sequence + ')' : ''}`;
  }

  stacktrace(indent=0) {
    let string = this.toString();
    if (this.step instanceof Flow) string += '\n' + ' '.repeat(indent) + '↳ ' + this.step.stacktrace(indent + 2);
    return string;
  }

  visualize() {
    return this.visualizeBlocks({
      type: 'flow',
      blocks: {
        do: this.block ? (this.block instanceof Array ? this.block : [this.block]) : undefined
      },
      block: 'do'
    });
  }

  visualizeBlocks({ type, blocks, name, block, position }: {
    type: string,
    blocks: Record<string, FlowStep[] | undefined>,
    name?: string,
    block?: string,
    position?: any,
  }): FlowVisualization {
    const blockViz = Object.fromEntries(Object.entries(blocks).
      map(([key, block]) => [
        key, block?.map(s => {
          if (s instanceof Flow) return s.visualize();
          if (s === Do.break) return 'Do.break';
          if (s === Do.repeat) return 'Do.repeat';
          if (s === Do.continue) return 'Do.continue';
          return s.toString()
        })
      ])
    );

    return {
      type,
      name: name === undefined ? this.name : name,
      blocks: blockViz,
      current: {
        block,
        position,
        sequence: this.sequence
      }
    }
  }
}
