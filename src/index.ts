import GameManager from './game-manager.js';
import { Game, Space } from './board/index.js';
import { Player } from './player/index.js';

export { Game, Space };

export { union } from './board/index.js';
export {
  Piece,
  Stack,
  ConnectedSpaceMap,
  AdjacencySpace,
  FixedGrid,
  SquareGrid,
  HexGrid,
  PieceGrid,
  GameElement
} from './board/index.js';

export { Do } from './flow/index.js';

export { createInterface, colors } from './interface.js';
export { times, range, shuffleArray } from './utils.js';
export { Player };
export { createGame } from './game-creator.js';
export {
  render,
  ProfileBadge,
  toggleSetting,
  numberSetting,
  textSetting,
  choiceSetting
} from './ui/index.js';

export { TestRunner } from './test-runner.js';

import type { ElementClass } from './board/element.js';
import type Action from './action/action.js';

export type { GameManager, Action, ElementClass };

declare global {
  /**
   * Global reference to all unique named spaces
   *
   * @example
   * game.create(Space, 'deck');
   * ...
   * $.deck // =>  equals the Space just created
   */
  var $: Record<string, Space<Game>>; // eslint-disable-line no-var
}
