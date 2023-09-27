import Selection from './selection';

import type {
  Argument,
  SelectionDefinition,
  ResolvedSelection,
} from './types';
import type { Player } from '../player';

/**
 * Actions represent discreet moves players can make. The Action object is responsible for:
 * - providing Selection objects to players to aid in supplying appropriate Arguments
 * - validating player Arguments and returning any Selections needed to complete
 * - accepting player Arguments and altering board state
 */
export default class Action<P extends Player> {
  prompt: string;
  selections: (Action<P>|Selection<P>)[];
  move?: (...a: Argument<P>[]) => void;
  condition?: (() => boolean) | boolean;

  constructor({ prompt, selections, condition, move }: {
    prompt: string,
    selections?: (Action<P> | SelectionDefinition<P>)[],
    condition?: (() => boolean) | boolean,
    move?: (...a: Argument<P>[]) => void,
  }) {
    this.prompt = prompt;
    this.selections = selections ? selections.map(s => s instanceof Action ? s : new Selection(s)) : [];
    this.condition = condition;
    this.move = move;
  }

  isPossible(): boolean {
    if ((typeof this.condition === 'function' ? this.condition() : this.condition) === false) return false;
    const selections = this.getSelections();
    if (selections.length === 0) return true;

    // easy shortcircuit if any selection is already resolved to an impossibility
    if (selections.some(s => s.isResolved() && !s.isPossible())) return false;
    const selection = selections[0].resolve();
    if (selection.isUnbounded()) return true;
    return selections[0].resolve().options().some(o => this.nextSelection(o));
  }

  /**
   * given a set of args, returns a selection object for continuation. returns
   * false if no continuation. returns true if no further selection required.
   */
  nextSelection(...args: Argument<P>[]): ResolvedSelection<P> | boolean {
    const selections = this.getSelections().slice(args.length);
    if (selections.length === 0) return true;
    const selection = selections[0].resolve(...args);

    if (selection.isUnbounded()) return selection;
    if (!selection.isPossible()) return false;
    const lastUnresolved = [...selections].reverse().find(s => !s.isResolved());
    if (!lastUnresolved) return selection;
    const depth = selections.indexOf(lastUnresolved);
    if (depth <= 0) return selection;

    const options = selection.options();
    const viableOptions = options.filter(o => this.nextSelection(...args, o));
    if (viableOptions.length < (selection.min || 1)) return false;
    if (viableOptions.length === options.length) return selection;
    return selection.overrideOptions(viableOptions);
  }

  // validate args and truncate if invalid, append any add'l args that are
  // forced and return next selection. return error if args fail validation. no
  // selection and no error means args are validated and processable
  forceArgs(...args: Argument<P>[]): [ResolvedSelection<P>?, Argument<P>[]?, string?] {
    const selections = this.getSelections();
    let error: string | undefined = undefined;
    args = args.slice(0, selections.length); // remove extra args. likely a confirmation step was added

    // truncate invalid args
    for (let i = 0; i !== args.length; i++) {
      error = selections[i].validate(args[i], args.slice(0, i));
      if (error) {
        args = args.slice(0, i);
        break;
      }
    }

    // check next selection for viable options. append any forced args
    let forcedArg: Argument<P> | undefined = undefined;
    let nextSelection: ResolvedSelection<P> | undefined = undefined;
    do {
      const selection = this.nextSelection(...args);
      if (selection === false) return [undefined, [], error || "Action invalid. How did you get here?"];
      if (selection === true) return [undefined, args, error];
      forcedArg = selection.isForced();
      if (forcedArg !== undefined) {
        args.push(forcedArg);
      } else {
        nextSelection = selection;
      }
    } while (forcedArg);
    return [nextSelection, args, error];
  }

  // skip validate for sub-actions?
  process(...args: Argument<P>[]): [ResolvedSelection<P>?, Argument<P>[]?, string?] {
    const [resolvedSelection, forcedArgs, error] = this.forceArgs(...args);
    if (resolvedSelection) return [resolvedSelection, forcedArgs, error];
    if (forcedArgs) args = forcedArgs;

    try {
      // map selections to sub-actions
      let i = 0;
      for (const selection of this.selections) {
        if (selection instanceof Action) {
          const [resolvedSelection, truncatedArgs, error] = selection.process(...args.slice(i, selection.selections.length));
          if (resolvedSelection) {
            console.warn("args passed validation but failed to process", resolvedSelection, truncatedArgs, error);
            throw Error("args passed validation but failed to process");
          }
          i += selection.selections.length;
        } else {
          i += 1;
        }
      }
      if (this.move) this.move(...args);
    } catch(e) {
      console.error(e.message, e.stack);
      return [this.getSelections()[0].resolve(), [], e.message];
    }
    return [];
  }

  getSelections(): Selection<P>[] {
    // selections each recursive flatten, add "defer" to dependant args?
    const flatten: (a: Action<P> | Selection<P>, s: Selection<P>[], prompt?: string) => Selection<P>[] = (a, s, prompt) => {
      if (a instanceof Action) {
        a.selections.map(a2 => flatten(a2, s, a.prompt))
      } else {
        a.prompt = a.prompt || prompt;
        s.push(a);
      }
      return s;
    };
    return flatten(this, []);
  }
}
