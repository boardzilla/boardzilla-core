import {default as ActionStep} from './action-step.js';
import {default as WhileLoop} from './while-loop.js';
import {default as ForLoop} from './for-loop.js';
import {default as ForEach} from './for-each.js';
import {default as EachPlayer} from './each-player.js';
import {default as SwitchCase} from './switch-case.js';
import {default as IfElse} from './if-else.js';
import {default as EveryPlayer} from './every-player.js';

import type { Player } from '../player/index.js';
import type { Serializable } from '../action/utils.js';
import { FlowStep } from './flow.js';
import { Do, FlowControl } from './enums.js';
export {
  ActionStep,
  WhileLoop,
  ForLoop,
  ForEach,
  EachPlayer,
  SwitchCase,
  IfElse,
  EveryPlayer,
  Do,
  FlowControl
};

export type { FlowStep, FlowDefinition, FlowArguments } from './flow.js';

/**
 * Stop the flow and wait for a player to act.
 *
 * @param options.actions - An array of possible actions. Each action can be
 * either a string or on object. If a string, it is the name of the action as
 * defined in {@link Game#defineActions}. If an object, it consists of the
 * following keys:
 * <ul>
 * <li> `name`: the name of the action
 * <li> `do`: a further {@link FlowDefintion} for the game to run if this action is
 *   taken. This can contain any number of nested Flow functions.
 * <li> `args`: args to pass to the action, or function returning those args. If
 *   provided this pre-selects arguments to the action that the player does not
 *   select themselves. Also see {@link game#action} and {@link game#followUp}.
 * <li> `prompt`: a string prompt, or function returning a string. If provided this
 *   overrides the prompt defined in the action. This can be useful if the same
 *   action should prompt differently at different points in the game
 * </ul>
 *
 * @param options.name - A unique name for this player action. If provided, this
 * can be used for the UI to determine placement of messages for this action in
 * {@link Board#layoutStep}.
 *
 * @param options.prompt - A prompting message for the player taking the action
 * to decide between their choices. May be a string or a function accepting
 * {@link FlowArguments}
 *
 * @param options.description - A description of this step from a 3rd person
 * perspective, e.g. "choosing a card". The string will be automatically
 * prefixed with the player name and verb. If specified, will be used to convey
 * to non-acting players what step is happening.
 *
 * @param options.player - Which player can perform this action. If not
 * provided, this defaults to the {@link PlayerCollection#current | current
 * player}
 *
 * @param options.players - Which players can perform this action, if multiple.
 *
 * @param options.optional - If a string is passed, this becomes a prompt
 * players can use to 'pass' this step, performing no action and letting the
 * flow proceed. May be a string or a function accepting {@link FlowArguments}
 *
 * @param options.skipIf - One of 'always', 'never' or 'only-one' (Default
 * 'always').
 *
 * <ul>
 * <li> only-one: If there is only valid choice in the choices given, the game
 * will skip this choice, prompting the player for subsequent choices, if any,
 * or completing the action otherwise.
 * <li> always: Rather than present this choice directly, the player will be
 * prompted with choices from the *next choice* in each action here, essentially
 * expanding the choices ahead of time to save the player a step.
 * <li> never: Always present this choice, even if the choice is forced
 * </ul>
 *
 * @category Flow
 */
export const playerActions = <P extends Player>(options: ConstructorParameters<typeof ActionStep<P>>[0]) => new ActionStep<P>(options);

/**
 * Create a loop that continues until some condition is true. This functions
 * like a standard `while` loop.
 *
 * @param options.do - The part that gets repeated. This can contain any type of
 * {@link FlowDefintion}, a list of functions, or more Flow commands. The
 * functions {@link Do|Do.repeat}, {@link Do|Do.break} or {@link
 * Do|Do.continue}, can also be used here to cause the current loop to be
 * interupted.
 *
 * @param options.while - Either a simple boolean value or a condition function
 * that must return true for the loop to continue. If this evaluates to false
 * when the loop begins, it will be skipped entirely. The condition will be
 * evaluated at the start of each loop to determine whether it should continue.
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
 * Create a loop that continues until {@link Do|Do.break} is called
 *
 * @param options.do - The part that gets repeated. This can contain any type of
 * {@link FlowDefintion}, a list of functions, or more Flow commands. The
 * functions {@link Do|Do.repeat}, {@link Do|Do.break} or {@link
 * Do|Do.continue}, can also be used here to cause the current loop to be
 * interupted.
 *
 * @example
 * loop(playerActions({ actions: [
 *   'takeOneFromBag',
 *   { name: 'done', do: Do.break }
 * ]}));
 *
 * @category Flow
 */
export const loop = <P extends Player>(...block: FlowStep<P>[]) => new WhileLoop<P>({do: block, while: () => true});

/**
 * Create a loop that sets a value and continues until that value meets some
 * condition. This functions like a standard `for` loop.
 *
 * @param options.do - The part that gets repeated. This can contain any type of
 * {@link FlowDefintion}, a list of functions, or more Flow commands. The
 * functions {@link Do|Do.repeat}, {@link Do|Do.break} or {@link
 * Do|Do.continue}, can also be used here to cause the current loop to be
 * interupted.
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
 * @param options.do - The part that gets repeated. This can contain any type of
 * {@link FlowDefintion}, a list of functions, or more Flow commands. The
 * functions {@link Do|Do.repeat}, {@link Do|Do.break} or {@link
 * Do|Do.continue}, can also be used here to cause the current loop to be
 * interupted.
 *
 * @param options.name - The current value of collection will be added to the
 * {@link FlowArguments} under a key with this name.
 *
 * @param options.collection - A collection of values to loop over. This can be
 * declared as an array or as a method that accept the {@link FlowArguments}
 * used up to this point in the flow and return the collection Array. This
 * expression is evaluated *only once* at the start of the loop.
 *
 * @example
 * forEach({ name: 'card', collection: () => deck.all(Card), do: [
 *   // show each card from the deck to player in turn
 *   ({ card }) => card.showTo(player),
 *   playerActions({ actions: [
 *     'chooseCard',
 *     'pass',
 *   ]}),
 * ]});
 *
 * @category Flow
 */
export const forEach = <P extends Player, T extends Serializable<P>>(options: ConstructorParameters<typeof ForEach<P, T>>[0]) => new ForEach<P, T>(options);

/**
 * Create a loop that iterates over each player. This is the same as {@link
 * forEach} with the additional behaviour of setting the {@link
 * PlayerCollection#current | current player} on each iteration of the loop.
 *
 * @param options.do - The part that gets repeated for each player. This can
 * contain any type of {@link FlowDefintion}, a list of functions, or more Flow
 * commands. The functions {@link Do|Do.repeat}, {@link Do|Do.break} or {@link
 * Do|Do.continue}, can also be used here to cause the current loop to be
 * interupted.
 *
 * @param options.name - The current player will be added to the {@link
 * FlowArguments} under a key with this name.
 *
 * @param options.startingPlayer - Declare the player to start the loop. If not
 * specified, this will be the first player in turn order.
 *
 * @param options.nextPlayer - Declare a method to select the next player. If
 * not specified this will follow turn order. See {@link
 * PlayerCollection#sortby} for more information.
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
 * eachPlayer({ name: 'biddingPlayer', do: // each player in turn has a chance to bid
 *   playerActions({ actions: [ 'bid', 'pass' ] })
 * });
 *
 * @category Flow
 */
export const eachPlayer = <P extends Player>(options: ConstructorParameters<typeof EachPlayer<P>>[0]) => new EachPlayer<P>(options);

/**
 * Provides a branching flow on a condition. This operates like a standard
 * `if... else`
 *
 * @param options.if - Condition to test for true/false. This function accepts all
 * {@link FlowArguments}.
 *
 * @param options.do - The part that gets run if the condition is true. This can
 * contain any type of {@link FlowDefintion}, a list of functions, or more Flow
 * commands. The functions {@link Do|Do.repeat}, {@link Do|Do.break} or {@link
 * Do|Do.continue}, can also be used here to cause the current loop to be
 * interupted.
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
 * block. The case block can contain an `eq` which will test for equality with a
 * provided value, or `test` which will test the value using a provided function
 * that must return a boolean. Only the first one that meets the condition will
 * run. The `do` can contain any type of {@link FlowDefintion}.
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

/**
 * Create a flow for a set of players that can be done by all players
 * simulataneously in any order. This is similiar to {@link eachPlayer} except
 * that the players can act in any order.
 *
 * @param options.do - The part that each player can perform. This can contain
 * any type of {@link FlowDefintion}, a list of functions, or more Flow
 * commands. Each player will go through the defined flows individually and may
 * be at difference stages. The flow will complete when all players have
 * completed this flow. If {@link Do|Do.repeat}, {@link Do|Do.break} or {@link
 * Do|Do.continue} is called, the current loop can be interupted, *regardless of
 * what the other players have done*.
 *
 * @param options.name - The player acting will be added to the {@link
 * FlowArguments} under a key with this name for flows within this `do`.
 *
 * @param options.players - Declare the players to perform this `do`. If not
 * specified, this will be all players.
 *
 * @example
 * everyPlayer({ name: 'passCardPlayer', do: ( // each player selects a card from hand or passes
 *   playerActions({ actions: [ 'selectCard', 'pass' ]}),
 * ]});
 *
 * @category Flow
 */
export const everyPlayer = <P extends Player>(options: ConstructorParameters<typeof EveryPlayer<P>>[0]) => new EveryPlayer<P>(options);
