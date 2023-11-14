import {default as Action} from './action.js';
export {default as Selection} from './selection.js';

import type { Player} from '../index.js';

export {
  Action,
}
export {
  humanizeArg,
  serializeArg,
  deserializeArg
} from './utils.js';

/**
 * Create an {@link Action}. An action is a single move that a player can
 * take. Some actions require choices, sometimes several, before they can be
 * executed. Some don't have any choices, like if a player can simply
 * 'pass'. What defines where one actions ends and another begins is how much
 * you as a player can decide before you "commit". For example, in chess you
 * select a piece to move and then a place to put it. These are a single move,
 * not separate. (Unless playing touch-move, which is rarely done in digital
 * chess.) In hearts, you pass 3 cards to another players. These are a single
 * move, not 3. You can change your mind as you select the cards, rather than
 * have to commit to each one. Similarly, other players do not see any
 * information about your choices until you actually commit the enture move.
 *
 * This function is called for each action in the game `actions` you define in
 * {@link createGame}. The actions is initially declared with only a name,
 * prompt and condition. Further information is added to the action by chaining
 * methods that add choices and behaviour. See (@link Action) for more.
 *
 * @param definition.prompt - The prompt that will appear for the player to
 * explain what the action does. Further prompts can be defined for each choice
 * they subsequently make to complete the action.
 *
 * @param definition.condition - A function returning a boolean that determines
 * whether the action is currently allowed. Note that the choices you define for
 * your action will further determine if the action is allowed. E.g. if you have
 * a play card action and you add a choice for cards in your hand, Boardzilla
 * will automatically disallow this action if there are no cards in your hand
 * based on the face that there are no valid choices to complete the action. YOu
 * do not need to specify a `condition` for these types of limitations.
 *
 * @example
 * action({
 *   prompt: 'Flip one of your cards'
 * }).chooseOnBoard({
 *   choices: board.find(Card, {mine: true})
 * }).do(
 *   card => card.hideFromAll()
 * )
 *
 * @category Actions
 */
export const action = <P extends Player>(definition: {
  prompt: string,
  condition?: Action<P>['_cfg']['condition'],
}) => new Action<P>(definition);
