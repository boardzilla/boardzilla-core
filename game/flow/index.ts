import {default as ActionStep} from './action-step';
import {default as WhileLoop} from './while-loop';
import {default as ForLoop} from './for-loop';
import {default as ForEach} from './foreach';
import {default as EachPlayer} from './each-player';
import {default as SwitchCase} from './switch-case';
import {default as IfElse} from './if-else';

import type { Player } from '../player';
import type { Serializable } from '../action/types';
export { Do, FlowControl } from './enums';

/**
 * Stop the flow and wait for a player to act.
 *
 * @param options.actions - An object of possible actions. Each key is an action
 * name defined in the `actions` of {@link createGame}. The value is a further
 * flow defintion for the game to run if this action is taken. This can contain
 * any number of nested Flow functions. If no further action is needed, this can
 * be null.
 *
 * @param options.name - A unique name for this player action. If provided, this
 * can be used for the UI to determine placement of messages for this action in
 * {@link board.layoutStep}.
 *
 * @param options.prompt - A prompting message for the player taking the action
 * to decide between their choices.
 *
 * @param options.expand - If set to true, rather than select the action
 * directly, the player will be prompted to make the first choice in the action.
 * For example, if a `playCard` action was supplied here and the player had to
 * choose a card to play, rather than present the player with an explicit choice
 * to 'play' they would simply be asked to choose a card. Default true.
 *
 * @param options.skipIfOnlyOne - If set to true, if there is only valid action
 * to take amongst the choices given, the game will attempt to take the move
 * automatically, prompting the player for any choices that would need to be
 * made to complete this action. Default false.
 *
 * @category Flow
 */

export const playerActions = <P extends Player>(options: ConstructorParameters<typeof ActionStep<P>>[0]) => new ActionStep<P>(options);

/**
 * Create a loop that continues until some condition is true. This functions
 * like a standard `while` loop.
 *
 * @param options.do - The part that gets repeated. This can contain any number
 * of nested Flow functions. If this value is instead one of {@link Do.repeat},
 * {@link Do.exit} or {@link Do.skip}, or a function that returns one of these,
 * the current loop can be interupted.
 *
 * @param options.while - A condition function that must return true for the
 * loop to continue. If this evaluates to false when the loop begins, it will be
 * skipped entirely. The condition will be evaluates at the start of each loop
 * to determine whether it should continue.
 *
 * @example
 * whileLoop({ while: () => !bag.isEmpty(), do: (
 *   playerActions({ actions: {
 *     takeOneFromBag: null,
 *   }}),
 * )});
 *
 * @category Flow
 */

export const whileLoop = <P extends Player>(options: ConstructorParameters<typeof WhileLoop<P>>[0]) => new WhileLoop<P>(options);

/**
 * Create a loop that sets a value and continues until that value meets some
 * condition. This functions like a standard `for` loop.
 *
 * @param options.do - The part that gets repeated. This can contain any number
 * of nested Flow functions. If this value is instead one of {@link Do.repeat},
 * {@link Do.exit} or {@link Do.skip}, or a function that returns one of these,
 * the current loop can be interupted.
 *
 * @param options.name - The current value of the loop variable will be added to
 * the {@link FlowArguments} under a key with this name.
 *
 * @param options.initial - The initial value of the loop variable
 *
 * @param options.next - A function that will be run on each loop and must
 * return the new value of the loop variable
 *
 * @param options.while - A condition function that must return true for the
 * loop to continue. If this evaluates to false when the loop begins, it will be
 * skipped entirely. The condition will be evaluates at the start of each loop
 * to determine whether it should continue.
 *
 * @example
 * forLoop({
 *   name: 'x',
 *   initial: 0,
 *   next: x => x + 1,
 *   while: x => x < 3,
 *   do: ({ x }) => {
 *     // do something 3 times
 *   }
 * })
 *
 * @category Flow
 */

export const forLoop = <P extends Player, T = Serializable<P>>(options: ConstructorParameters<typeof ForLoop<P, T>>[0]) => new ForLoop<P, T>(options);

/**
 * Create a loop that iterates over an array. This functions like a standard
 * `Array#forEach` method.
 *
 * @param options.do - The part that gets repeated. This can contain any number
 * of nested Flow functions. If this value is instead one of {@link Do.repeat},
 * {@link Do.exit} or {@link Do.skip}, or a function that returns one of these,
 * the current loop can be interupted.
 *
 * @param options.name - The current value of colleciton will be added to the
 * {@link FlowArguments} under a key with this name.
 *
 * @param options.collection - A collection of values to loop over. This can be
 * declared as an array or as a method that accept the {@link FlowArguments}
 * used up to this point in the flow and return the collection Array.
 *
 * @example
 * forEach({ name: 'card', collection: deck.all(Card), do: [
 *   ({ card }) => card.showTo(player), // show each card from the deck to player in turn
 *   playerActions({ actions: {
 *     chooseCard: skip,
 *     pass: null
 *   }}),
 * ]});
 *
 * @category Flow
 */

export const forEach = <P extends Player, T extends Serializable<P>>(options: ConstructorParameters<typeof ForEach<P, T>>[0]) => new ForEach<P, T>(options);

/**
 * Create a loop that iterates over each player. This is the same as {@link
 * forEach} with the additional behaviour of setting the {@link
 * PlayerCollection#current | current player}.
 *
 * @param options.do - The part that gets repeated. This can contain any number
 * of nested Flow functions. If this value is instead one of {@link Do.repeat},
 * {@link Do.exit} or {@link Do.skip}, or a function that returns one of these,
 * the current loop can be interupted.
 *
 * @param options.name - The current player will be added to the {@link
 * FlowArguments} under a key with this name.
 *
 * @param options.startingPlayer - Declare the player to start the loop. If not
 * specified, this will be the {@link PlayerCollection#current | current
 * player}, or the player at position 1 if no current player has been set via
 * {@link PlayerCollection#setCurrent}.
 *
 * @param options.nextPlayer - Declare a method to select the next player. If
 * not specified this will follow turn order. See {@link
 * PlayerCollection#sortBy} for more information.
 *
 * @param options.turns - If specified, loop through each play this many
 * times. Default is 1.
 *
 * @param options.continueUntil - If specified, rather than loop through each
 * player for a certain number of turns, the loop will continue until the
 * provided condition is true. This function accepts the player for the current
 * loop as its only argument.
 *
 * @example
 * eachPlayer({ name: 'biddingPlayer', do: ( // each player in turn has a chance to bid
 *   playerActions({ actions: {
 *     bid: ({ player }) => {
 *       // player has bid
 *       return skip();
 *     },
 *     pass: null
 *   }}),
 * ]});
 *
 * @category Flow
 */
export const eachPlayer = <P extends Player>(options: ConstructorParameters<typeof EachPlayer<P>>[0]) => new EachPlayer<P>(options);

/**
 * Provides a branching flow on a condition. This operates like a standard
 * `if... else`
 *
 * @param options.test - Condition to test for true/false. This function accepts all
 * {@link FlowArguments}.
 *
 * @param options.do - The part that gets run if the condition is true. This can
 * contain any number of nested Flow functions. If this value is instead one of
 * {@link Do.repeat}, {@link Do.exit} or {@link Do.skip}, or a function that
 * returns one of these, the current loop can be interupted.
 *
 * @param options.else - As `do`, but runs if the condition is false. Optional.
 *
 * @category Flow
 */
export const ifElse = <P extends Player>(options: ConstructorParameters<typeof IfElse<P>>[0]) => new IfElse<P>(options);

/**
 * Provides a branching flow on a condition with multiple outcomes. This
 * operates like a standard `switch... case`
 *
 * @param options.switch - Expression to evaluate for determining which case
 * should run. This function accepts all {@link FlowArguments}.
 *
 * @param options.name - If a name is provided, the value that results from
 * evaluating `switch` will be added to the {@link FlowArguments} under a key
 * with this name.
 *
 * @param options.cases - An array of conditions that will test whether they
 * meet the conditions based on the evaluated `switch` and execute their `do`
 * block. Only the first one that qualifies will run. This can contain any
 * number of nested Flow functions.
 *
 * @param options.default - If no case qualifies, a `default` case can be
 * provided.
 *
 * @example
 * switchCase({
 *   name: 'switch',
 *   switch: () => deck.top(Card)?.suit,
 *   cases: [
 *     { eq: 'D', do: () => { /* ... diamonds *\/ },
 *     { eq: 'H', do: () => { /* ... hearts *\/ },
 *     { eq: 'S', do: () => { /* ... spades *\/ },
 *     { eq: 'C', do: () => { /* ... clubs *\/ }
 *   ],
 *   default: () => { /* ... there is no card *\/ }
 * })
 *
 * @category Flow
 */
export const switchCase = <P extends Player, T extends Serializable<P>>(options: ConstructorParameters<typeof SwitchCase<P, T>>[0]) => new SwitchCase<P, T>(options);
