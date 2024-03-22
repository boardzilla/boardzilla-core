import GameElement from './element.js'

import type { BaseGame } from './game.js';
import type Player from '../player/player.js';
import type { ElementClass, ElementAttributes } from './element.js';

export type ElementEventHandler<T extends GameElement> = {callback: (el: T) => void} & Record<any, any>;

/**
 * Spaces are areas of the game. The spaces of your game are declared during
 * setup in {@link createGame} and never change during play.
 * @category Board
 */
export default class Space<G extends BaseGame, P extends Player = NonNullable<G['player']>> extends GameElement<G, P> {
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
}
