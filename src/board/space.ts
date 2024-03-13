import GameElement from './element.js'

import type Game from './game.js';
import type Player from '../player/player.js';
import type { ElementClass, ElementAttributes } from './element.js';

export type ElementEventHandler<T extends GameElement> = {callback: (el: T) => void} & Record<any, any>;

/**
 * Spaces are areas of the game. The spaces of your game are declared during
 * setup in {@link createGame} and never change during play.
 * @category Board
 */
export default class Space<G extends Game, P extends Player = NonNullable<G['player']>> extends GameElement<G, P> {
  _eventHandlers: {
    enter: ElementEventHandler<GameElement>[],
    exit: ElementEventHandler<GameElement>[],
  } = { enter: [], exit: [] };

  static unserializableAttributes = [...GameElement.unserializableAttributes, '_eventHandlers'];

  isSpace() { return true; }

  create<T extends GameElement>(className: ElementClass<T>, name: string, attributes?: ElementAttributes<T>): T {
    const el = super.create(className, name, attributes);
    this.triggerEvent("enter", el);
    return el;
  }

  addEventHandler<T extends GameElement>(type: keyof Space<G>['_eventHandlers'], handler: ElementEventHandler<T>) {
    if (this._ctx.gameManager?.phase === 'started') throw Error('Event handlers cannot be added once game has started.');
    this._eventHandlers[type].push(handler);
  }

  /**
   * Attach a callback to this space for every element that enters or is created
   * within.
   * @category Structure
   *
   * @param type - the class of element that will trigger this callback
   * @param callback - Callback will be called each time an element enters, with
   * the entering element as the only argument.
   *
   * @example
   * deck.onEnter(Card, card => card.hideFromAll()) // card placed in the deck are automatically turned face down
   */
  onEnter<T extends GameElement>(type: ElementClass<T>, callback: (el: T) => void) {
    this.addEventHandler<T>("enter", { callback, type });
  }

  /**
   * Attach a callback to this space for every element that is moved out of this
   * space.
   * @category Structure
   *
   * @param type - the class of element that will trigger this callback
   * @param callback - Callback will be called each time an element exits, with
   * the exiting element as the only argument.
   *
   * @example
   * deck.onExit(Card, card => card.showToAll()) // cards drawn from the deck are automatically turned face up
   */
  onExit<T extends GameElement>(type: ElementClass<T>, callback: (el: T) => void) {
    this.addEventHandler<T>("exit", { callback, type });
  }

  triggerEvent(event: keyof Space<G>['_eventHandlers'], element: GameElement) {
    for (const handler of this._eventHandlers[event]) {
      if (event === 'enter' && !(element instanceof handler.type)) continue;
      if (event === 'exit' && !(element instanceof handler.type)) continue;
      handler.callback(element);
    }
  }

  /**
   * Create a grid of spaces inside this space. These automatically have row and
   * column applied to them and have adjacencies created on them for the purpose
   * of all adjacency and distance methods and queries.
   *
   * @param gridConfig.rows - the number of rows
   * @param gridConfig.columns - the number of columns
   * @param gridConfig.style - the style of grid.
   * <ul>
   * <li>`"square"` - checker grid. adjacency counts as up, down, left, right.
   * <li>`"hex"` - hex grid. adjacency counts in 6 directions with a cell at {0,0} considered adjacent to {1,1}
   * <li>`"hex-inverse"` - hex grid. adjacency counts in 6 directions with a cell at {1,0} considered adjacent to {0,1}
   * </ul>
   * @param gridConfig.diagonalDistance - In the case of a square grid, optionally make diagonal squares adjacent with this distance.

   * @param className - Class to create. This class must be included in the `elementClasses` in {@link createGame}.
   * @param name - Sets {@link GameElement#name | name}
   * @param attributes - Sets any attributes of the class that are defined in
   * your own class that extend {@link Space}, {@link Piece}, or {@link
   * Game}. Can also include {@link player}.
   *
   * @category Structure
   */
  // createGrid<T extends Space<G, P>>(
  //   gridConfig: {
  //     rows: number,
  //     columns: number,
  //     style?: 'square' | 'hex' | 'hex-inverse',
  //     diagonalDistance?: number
  //   },
  //   className: ElementClass<T>,
  //   name: string,
  //   attributes?: ElementAttributes<T>
  // ): ElementCollection<T> {
  //   const {rows, columns, style, diagonalDistance} = gridConfig;
  //   if (diagonalDistance !== undefined && (style ?? 'square') !== 'square') throw Error("Hex grids cannot have diagonals");
  //   const grid = new ElementCollection<T>();
  //   times(rows, row =>
  //     times(columns, column => {
  //       const el = this.create(className, name, {row, column, ...attributes} as ElementAttributes<T>);
  //       grid[(row - 1) * columns + column - 1] = el;
  //       if (row > 1) el.connectTo(grid[(row - 2) * columns + column - 1]);
  //       if (column > 1) el.connectTo(grid[(row - 1) * columns + column - 2]);
  //       if ((diagonalDistance !== undefined || style === 'hex') && row > 1 && column > 1) {
  //         el.connectTo(grid[(row - 2) * columns + column - 2], diagonalDistance);
  //       }
  //       if ((diagonalDistance !== undefined || style === 'hex-inverse') && row > 1 && column < columns) {
  //         el.connectTo(grid[(row - 2) * columns + column], diagonalDistance);
  //       }
  //       return el;
  //     })
  //   );
  //   return grid;
  // }
}
