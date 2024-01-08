/**
 * Return values for interrupting flows
 *
 * @category Flow
 */
export const Do = {
  /**
   * Return Do.repeat from anywhere inside a looping flow ({@link whileLoop},
   * {@link forLoop}, {@link forEach}, {@link eachPlayer}) to interrupt the flow,
   * skip the rest of the current loop iteration and repeat the current loop
   * with the same value.
   *
   * @example
   * // each player can shout as many times as they like
   * eachPlayer({ name: 'player', do: (
   *   playerActions({ actions: {
   *     shout: Do.repeat,
   *     pass: null
   *   }}),
   * ]});
   *
   * @category Flow
   */
  repeat: () => loopInterrupt[0] = LoopInterruptControl.repeat,

  /**
   * Return Do.continue from anywhere inside a looping flow ({@link whileLoop},
   * {@link forLoop}, {@link forEach}, {@link eachPlayer}) to interrupt the flow,
   * skip the rest of the current loop iteration and repeat the loop with the
   * next value. This acts like Javascript's `continue`.
   *
   * @example
   * // each player can decide to shout, and if so, may subsequently apologize
   * eachPlayer({ name: 'player', do: [
   *   playerActions({ actions: {
   *     shout: Do.continue, // if shouting, skip to the next player
   *     pass: null
   *   }}),
   *   playerActions({ actions: {
   *     apologize: null,
   *     pass: null
   *   }}),
   * ]});
   *
   * @category Flow
   */
  continue: () => loopInterrupt[0] = LoopInterruptControl.continue,

  /**
   * Return Do.break from anywhere inside a looping flow ({@link whileLoop},
   * {@link forLoop}, {@link forEach}, {@link eachPlayer}) to interrupt the flow,
   * skip the rest of the current loop iteration and exit this loop. This acts
   * like Javascript's `break`.
   *
   * @example
   * // each player can decide to shout but the first one that does ends the shouting round
   * eachPlayer({ name: 'player', do: (
   *   playerActions({ actions: {
   *     shout: Do.break,
   *     pass: null
   *   }}),
   * ]});
   *
   * @category Flow
   */
  break: () => loopInterrupt[0] = LoopInterruptControl.break,
}

/** internal */
export enum LoopInterruptControl {
  repeat = "__REPEAT__",
  continue = "__CONTINUE__",
  break = "__BREAK__",
}

/** internal */
export enum FlowControl {
  ok = "__OK__",
  complete = "__COMPLETE__"
}

/** internal */
export const loopInterrupt: [LoopInterruptControl?] = [];

/**
 * Several flow methods accept an argument of this type. This is an object
 * containing keys for every flow function that the game is in the middle of
 * which recorded a value to the current scope. Functions that can add these
 * values are {@link forLoop}, {@link forEach}, {@link switchCase}. The name
 * given to these functions will be the key in the FlowArguments and its value
 * will be the value of the current loop for loops, or the test value for
 * switchCase
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
 */
