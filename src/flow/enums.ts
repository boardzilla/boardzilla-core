/**
 * Functions for interrupting flows
 *
 * These functions can be called from anywhere inside a looping flow ({@link loop}, {@link
 * whileLoop}, {@link forLoop}, {@link forEach}, {@link eachPlayer}) to
 * interrupt the flow, with each one resuming the flow differently.
 *
 * `Do.break` causes the flow to exit loop and resume after the loop, like the
   `break` keyword in Javascript.
 *
 * `Do.continue` causes the flow to skip the rest of the current loop iteration
 * and restart the loop at the next iteration, like the `continue` keyword in
 * Javascript.
 *
 * `Do.repeat` causes the flow to skip the rest of the current loop iteration
 * and restart the same iteration of the loop.
 *
 * @example
 * // each player can shout as many times as they like
 * eachPlayer({ name: 'player', do: (
 *   playerActions({ actions: [
 *     { name: 'shout', do: Do.repeat },
 *     'pass'
 *   ]}),
 * ]});
 *
 * // each player can decide to shout, and if so, may subsequently apologize
 * eachPlayer({ name: 'player', do: [
 *   playerActions({ actions: [
 *     { name: 'shout', do: Do.continue },  // if shouting, skip to the next player
 *     'pass'
 *   ]}),
 *   playerActions({ actions: [ 'apologize', 'pass' ] }),
 * ]});
 *
 * // each player can take a card but if the card is a match, it ends this round
 * eachPlayer({ name: 'player', do: (
 *   playerActions({ actions: [
 *     { name: 'takeCard', do: ({ takeCard }) => if (takeCard.card.isMatch()) Do.break() },
 *     'pass'
 *   ]}),
 * ]});
 *
 * @category Flow
 */
export const Do = {
  repeat: (loop?: string | Record<string, string>) => interrupt(LoopInterruptControl.repeat, typeof loop === 'string' ? loop : undefined),
  continue: (loop?: string | Record<string, string>) => interrupt(LoopInterruptControl.continue, typeof loop === 'string' ? loop : undefined),
  break: (loop?: string | Record<string, string>) => interrupt(LoopInterruptControl.break, typeof loop === 'string' ? loop : undefined),
}

/** @internal */
export const loopInterrupt: {loop?: string, signal: LoopInterruptControl}[] = [];

function interrupt(signal: LoopInterruptControl, loop?: string) {
  loopInterrupt[0] = {loop, signal};
}

/** @internal */
export enum LoopInterruptControl {
  repeat = "__REPEAT__",
  continue = "__CONTINUE__",
  break = "__BREAK__",
}

/** @internal */
export enum FlowControl {
  ok = "__OK__",
  complete = "__COMPLETE__"
}
