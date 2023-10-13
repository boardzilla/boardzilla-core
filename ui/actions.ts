import type { Player } from '../game'
import type { Action } from '../game/action'
import type { IncompleteMove } from '../game/action/types'

export function deriveSelections(player: Player, actions: Record<string, Action<any, any>>) {
  let move: IncompleteMove<Player> = { player, args: [] };
  const numberOfActions = Object.keys(actions).length;
  if (numberOfActions === 0) return {move, selections: {}}
  if (numberOfActions === 1) { // only one action to choose, so choose it
    const name = Object.keys(actions)[0]
    const action = actions[name];
    let [selection, forcedArgs] = action.forceArgs();

    return {
      move: {
        action: name,
        args: forcedArgs || [],
        player
      } as IncompleteMove<Player>,
      selections: {
        [name]: selection
      }
    };
  }

  return {
    move,
    selections: Object.fromEntries(Object.entries(actions).map(
      ([name, action]) => ([name, action.forceArgs()[0]])
    ))
  }
}
