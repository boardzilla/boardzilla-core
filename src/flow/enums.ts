/**
 * Functions for interrupting flows
 *
 * @category Flow
 */
export const Do = {
  /**
   * Call `Do.repeat` from anywhere inside a looping flow ({@link loop}, {@link
   * whileLoop}, {@link forLoop}, {@link forEach}, {@link eachPlayer}) to
   * interrupt the flow, skip the rest of the current loop iteration and repeat
   * the current loop with the same value.
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
   * @category Flow
   */
  repeat: () => loopInterrupt[0] = LoopInterruptControl.repeat,

  /**
   * Call `Do.continue` from anywhere inside a looping flow ({@link loop}, {@link
   * whileLoop}, {@link forLoop}, {@link forEach}, {@link eachPlayer}) to
   * interrupt the flow, skip the rest of the current loop iteration and repeat
   * the loop with the next value. This acts like Javascript's `continue`.
   *
   * @example
   * // each player can decide to shout, and if so, may subsequently apologize
   * eachPlayer({ name: 'player', do: [
   *   playerActions({ actions: [
   *     { name: 'shout', do: Do.continue },  // if shouting, skip to the next player
   *     'pass'
   *   ]}),
   *   playerActions({ actions: [ 'apologize', 'pass' ] }),
   * ]});
   *
   * @category Flow
   */
  continue: () => loopInterrupt[0] = LoopInterruptControl.continue,

  /**
   * Call `Do.break` from anywhere inside a looping flow ({@link loop}, {@link
   * whileLoop}, {@link forLoop}, {@link forEach}, {@link eachPlayer}) to
   * interrupt the flow, skip the rest of the current loop iteration and exit
   * this loop. This acts like Javascript's `break`.
   *
   * @example
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
  break: () => loopInterrupt[0] = LoopInterruptControl.break,
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

/** @internal */
export const loopInterrupt: [LoopInterruptControl?] = [];
